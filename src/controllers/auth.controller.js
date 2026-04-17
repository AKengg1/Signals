const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query, getClient } = require('../db/pool');

// ── Helpers ──────────────────────────────────────────────────

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

/** Generate a unique anonymous code like "A-047" */
async function generateAnonymousCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code, exists;
  do {
    const letter = letters[Math.floor(Math.random() * letters.length)];
    const num    = String(Math.floor(Math.random() * 900) + 100);
    code  = `${letter}-${num}`;
    const res = await query('SELECT 1 FROM student_profiles WHERE anonymous_code = $1', [code]);
    exists = res.rowCount > 0;
  } while (exists);
  return code;
}

// ── Controllers ──────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Body: { email, password, full_name, role, company_name? }
 */
const register = async (req, res) => {
  const { email, password, full_name, role, company_name } = req.body;

  // Check duplicate email
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const password_hash = await bcrypt.hash(password, rounds);

  // Use a transaction so user + profile are created atomically
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING id, email, role, full_name, created_at`,
      [email, password_hash, full_name, role]
    );
    const user = userRes.rows[0];

    if (role === 'student') {
      const code = await generateAnonymousCode();
      await client.query(
        `INSERT INTO student_profiles (user_id, anonymous_code) VALUES ($1, $2)`,
        [user.id, code]
      );
    } else if (role === 'recruiter') {
      await client.query(
        `INSERT INTO recruiter_profiles (user_id, company_name) VALUES ($1, $2)`,
        [user.id, company_name || null]
      );
    }

    await client.query('COMMIT');

    const token = signToken(user);
    return res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } });

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  const result = await query(
    `SELECT id, email, password_hash, role, full_name, status FROM users WHERE email = $1`,
    [email]
  );

  if (result.rowCount === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = result.rows[0];

  if (user.status === 'banned') {
    return res.status(403).json({ error: 'Account suspended. Contact support.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);

  // Fetch role-specific profile data
  let profile = {};
  if (user.role === 'student') {
    const p = await query(
      `SELECT anonymous_code, merit_points, global_rank, level, xp FROM student_profiles WHERE user_id = $1`,
      [user.id]
    );
    if (p.rowCount > 0) profile = p.rows[0];
  } else if (user.role === 'recruiter') {
    const p = await query(
      `SELECT company_name, industry FROM recruiter_profiles WHERE user_id = $1`,
      [user.id]
    );
    if (p.rowCount > 0) profile = p.rows[0];
  }

  return res.json({
    token,
    user: {
      id:        user.id,
      email:     user.email,
      role:      user.role,
      full_name: user.full_name,
      ...profile,
    },
  });
};

/**
 * GET /api/auth/me
 * Returns current user info from token.
 */
const me = async (req, res) => {
  const result = await query(
    `SELECT id, email, role, full_name, status, created_at FROM users WHERE id = $1`,
    [req.user.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = result.rows[0];

  let profile = {};
  if (user.role === 'student') {
    const p = await query(
      `SELECT anonymous_code, merit_points, global_rank, level, xp, bio, avatar_color
       FROM student_profiles WHERE user_id = $1`,
      [user.id]
    );
    if (p.rowCount > 0) profile = p.rows[0];
  } else if (user.role === 'recruiter') {
    const p = await query(
      `SELECT company_name, industry, employee_count, location, bio
       FROM recruiter_profiles WHERE user_id = $1`,
      [user.id]
    );
    if (p.rowCount > 0) profile = p.rows[0];
  }

  return res.json({ ...user, ...profile });
};

/**
 * PUT /api/auth/me
 * Update own profile (bio, avatar_color, company_name, etc.)
 */
const updateMe = async (req, res) => {
  const { full_name, bio, avatar_color, company_name, industry, employee_count, location } = req.body;
  const { id, role } = req.user;

  if (full_name) {
    await query('UPDATE users SET full_name = $1 WHERE id = $2', [full_name, id]);
  }

  if (role === 'student') {
    await query(
      `UPDATE student_profiles SET bio = COALESCE($1, bio), avatar_color = COALESCE($2, avatar_color), updated_at = NOW()
       WHERE user_id = $3`,
      [bio, avatar_color, id]
    );
  } else if (role === 'recruiter') {
    await query(
      `UPDATE recruiter_profiles
       SET bio = COALESCE($1, bio), company_name = COALESCE($2, company_name),
           industry = COALESCE($3, industry), employee_count = COALESCE($4, employee_count),
           location = COALESCE($5, location), updated_at = NOW()
       WHERE user_id = $6`,
      [bio, company_name, industry, employee_count, location, id]
    );
  }

  return res.json({ message: 'Profile updated successfully' });
};

/**
 * POST /api/auth/change-password
 */
const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!new_password || new_password.length < 8) {
    return res.status(422).json({ error: 'New password must be at least 8 characters' });
  }

  const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const { password_hash } = result.rows[0];

  const valid = await bcrypt.compare(current_password, password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const newHash = await bcrypt.hash(new_password, rounds);

  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
  return res.json({ message: 'Password updated successfully' });
};

module.exports = { register, login, me, updateMe, changePassword };