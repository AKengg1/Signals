const { query } = require('../db/pool');

// ── Helpers ──────────────────────────────────────────────────

async function attachCandidateSkills(candidates) {
  if (!candidates.length) return candidates;
  const ids = candidates.map((c) => c.user_id);
  const res = await query(
    `SELECT ss.student_id, s.name, ss.proficiency
     FROM student_skills ss JOIN skills s ON s.id = ss.skill_id
     WHERE ss.student_id = ANY($1)
     ORDER BY ss.proficiency DESC`,
    [ids]
  );
  const map = {};
  res.rows.forEach(({ student_id, name, proficiency }) => {
    if (!map[student_id]) map[student_id] = [];
    map[student_id].push({ name, proficiency });
  });
  return candidates.map((c) => ({ ...c, skills: map[c.user_id] || [] }));
}

// ── Controllers ──────────────────────────────────────────────

/**
 * GET /api/candidates
 * Recruiters & admins only.
 * Returns ANONYMOUS profiles — no name, no email.
 * Query: skill, min_points, max_rank, page, limit
 */
const listCandidates = async (req, res) => {
  const { skill, min_points, max_rank, page = 1, limit = 12 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let baseQuery = `
    FROM student_profiles sp
    JOIN users u ON u.id = sp.user_id
    WHERE u.status = 'active'
  `;
  const params = [];
  let pi = 1;

  if (min_points) {
    baseQuery += ` AND sp.merit_points >= $${pi++}`;
    params.push(parseInt(min_points));
  }

  if (max_rank) {
    baseQuery += ` AND sp.global_rank <= $${pi++}`;
    params.push(parseInt(max_rank));
  }

  if (skill) {
    baseQuery += ` AND EXISTS (
      SELECT 1 FROM student_skills ss JOIN skills sk ON sk.id = ss.skill_id
      WHERE ss.student_id = u.id AND LOWER(sk.name) = LOWER($${pi++})
    )`;
    params.push(skill);
  }

  const countRes = await query(`SELECT COUNT(*) ${baseQuery}`, params);
  const total = parseInt(countRes.rows[0].count);

  const dataRes = await query(
    `SELECT sp.user_id, sp.anonymous_code, sp.merit_points,
            sp.global_rank, sp.level, sp.avatar_color,
            (SELECT COUNT(*) FROM projects p WHERE p.student_id = sp.user_id AND p.status = 'approved') AS project_count
     ${baseQuery}
     ORDER BY sp.merit_points DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, parseInt(limit), offset]
  );

  const candidates = await attachCandidateSkills(dataRes.rows);

  return res.json({
    data: candidates,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

/**
 * GET /api/candidates/:anonymousCode
 * Full anonymous profile for a single candidate.
 */
const getCandidate = async (req, res) => {
  const { anonymousCode } = req.params;

  const result = await query(
    `SELECT sp.user_id, sp.anonymous_code, sp.bio, sp.merit_points,
            sp.global_rank, sp.level, sp.xp, sp.avatar_color,
            (SELECT COUNT(*) FROM projects p WHERE p.student_id = sp.user_id AND p.status = 'approved') AS project_count
     FROM student_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.anonymous_code = $1 AND u.status = 'active'`,
    [anonymousCode]
  );

  if (result.rowCount === 0) return res.status(404).json({ error: 'Candidate not found' });

  const [candidate] = await attachCandidateSkills(result.rows);

  // Fetch approved projects (still anonymous)
  const projRes = await query(
    `SELECT p.id, p.title, p.description, p.github_url, p.demo_url,
            p.emoji, p.merit_points, p.created_at
     FROM projects p
     WHERE p.student_id = $1 AND p.status = 'approved'
     ORDER BY p.merit_points DESC`,
    [candidate.user_id]
  );

  return res.json({ ...candidate, projects: projRes.rows });
};

/**
 * GET /api/candidates/leaderboard
 * Top N students by merit points.
 */
const leaderboard = async (req, res) => {
  const { limit = 50, skill } = req.query;

  let baseQuery = `
    FROM student_profiles sp
    JOIN users u ON u.id = sp.user_id
    WHERE u.status = 'active' AND sp.merit_points > 0
  `;
  const params = [];
  let pi = 1;

  if (skill) {
    baseQuery += ` AND EXISTS (
      SELECT 1 FROM student_skills ss JOIN skills sk ON sk.id = ss.skill_id
      WHERE ss.student_id = u.id AND LOWER(sk.name) = LOWER($${pi++})
    )`;
    params.push(skill);
  }

  const result = await query(
    `SELECT sp.user_id, sp.anonymous_code, sp.merit_points,
            sp.global_rank, sp.level, sp.avatar_color,
            ROW_NUMBER() OVER (ORDER BY sp.merit_points DESC) AS position
     ${baseQuery}
     ORDER BY sp.merit_points DESC
     LIMIT $${pi}`,
    [...params, parseInt(limit)]
  );

  const candidates = await attachCandidateSkills(result.rows);
  return res.json({ data: candidates });
};

// ── Shortlist ────────────────────────────────────────────────

/**
 * GET /api/candidates/shortlist
 * Returns the recruiter's saved shortlist.
 */
const getShortlist = async (req, res) => {
  const result = await query(
    `SELECT sp.user_id, sp.anonymous_code, sp.merit_points,
            sp.global_rank, sp.level, sp.avatar_color, sl.created_at AS shortlisted_at,
            (SELECT COUNT(*) FROM projects p WHERE p.student_id = sp.user_id AND p.status = 'approved') AS project_count
     FROM shortlist sl
     JOIN student_profiles sp ON sp.user_id = sl.student_id
     JOIN users u ON u.id = sl.student_id
     WHERE sl.recruiter_id = $1 AND u.status = 'active'
     ORDER BY sl.created_at DESC`,
    [req.user.id]
  );

  const candidates = await attachCandidateSkills(result.rows);
  return res.json({ data: candidates });
};

/**
 * POST /api/candidates/shortlist/:anonymousCode
 * Add a candidate to recruiter's shortlist.
 */
const addToShortlist = async (req, res) => {
  const { anonymousCode } = req.params;

  const candidate = await query(
    `SELECT user_id FROM student_profiles WHERE anonymous_code = $1`,
    [anonymousCode]
  );
  if (candidate.rowCount === 0) return res.status(404).json({ error: 'Candidate not found' });

  const studentId = candidate.rows[0].user_id;

  await query(
    `INSERT INTO shortlist (recruiter_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.user.id, studentId]
  );

  return res.status(201).json({ message: 'Added to shortlist', anonymous_code: anonymousCode });
};

/**
 * DELETE /api/candidates/shortlist/:anonymousCode
 */
const removeFromShortlist = async (req, res) => {
  const { anonymousCode } = req.params;

  const candidate = await query(
    `SELECT user_id FROM student_profiles WHERE anonymous_code = $1`,
    [anonymousCode]
  );
  if (candidate.rowCount === 0) return res.status(404).json({ error: 'Candidate not found' });

  await query(
    `DELETE FROM shortlist WHERE recruiter_id = $1 AND student_id = $2`,
    [req.user.id, candidate.rows[0].user_id]
  );

  return res.json({ message: 'Removed from shortlist' });
};

/**
 * GET /api/candidates/shortlist/check/:anonymousCode
 * Quick check if a candidate is already shortlisted.
 */
const checkShortlist = async (req, res) => {
  const { anonymousCode } = req.params;

  const candidate = await query(
    `SELECT user_id FROM student_profiles WHERE anonymous_code = $1`,
    [anonymousCode]
  );
  if (candidate.rowCount === 0) return res.status(404).json({ error: 'Candidate not found' });

  const result = await query(
    `SELECT 1 FROM shortlist WHERE recruiter_id = $1 AND student_id = $2`,
    [req.user.id, candidate.rows[0].user_id]
  );

  return res.json({ shortlisted: result.rowCount > 0 });
};

module.exports = { listCandidates, getCandidate, leaderboard, getShortlist, addToShortlist, removeFromShortlist, checkShortlist };