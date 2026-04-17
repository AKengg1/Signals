const { query, getClient } = require('../db/pool');

// ── Helpers ──────────────────────────────────────────────────

/** Attach skills array to each project row */
async function attachSkills(projects) {
  if (!projects.length) return projects;
  const ids = projects.map((p) => p.id);
  const skillRes = await query(
    `SELECT ps.project_id, s.name
     FROM project_skills ps
     JOIN skills s ON s.id = ps.skill_id
     WHERE ps.project_id = ANY($1)`,
    [ids]
  );
  const map = {};
  skillRes.rows.forEach(({ project_id, name }) => {
    if (!map[project_id]) map[project_id] = [];
    map[project_id].push(name);
  });
  return projects.map((p) => ({ ...p, skills: map[p.id] || [] }));
}

/** Resolve skill names → skill IDs, creating new skills if needed */
async function resolveSkillIds(client, skillNames) {
  const ids = [];
  for (const name of skillNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    let res = await client.query('SELECT id FROM skills WHERE LOWER(name) = LOWER($1)', [trimmed]);
    if (res.rowCount === 0) {
      res = await client.query('INSERT INTO skills (name) VALUES ($1) RETURNING id', [trimmed]);
    }
    ids.push(res.rows[0].id);
  }
  return ids;
}

// ── Controllers ──────────────────────────────────────────────

/**
 * GET /api/projects
 * Query params: status, skill, student_id, page, limit
 * Public: returns only approved projects.
 * Admin: can filter by status.
 */
const listProjects = async (req, res) => {
  const { skill, student_id, page = 1, limit = 12 } = req.query;
  const role = req.user?.role;

  // Only admins see non-approved projects (unless it's own profile)
  let status = req.query.status;
  if (!status) status = 'approved';
  if (role !== 'admin' && status !== 'approved') {
    // students can see their own pending projects via /api/projects/mine
    status = 'approved';
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  let baseQuery = `
    FROM projects p
    JOIN users u ON u.id = p.student_id
    LEFT JOIN student_profiles sp ON sp.user_id = p.student_id
    WHERE p.status = $1
  `;
  const params = [status];
  let paramIdx = 2;

  if (skill) {
    baseQuery += ` AND EXISTS (
      SELECT 1 FROM project_skills ps JOIN skills s ON s.id = ps.skill_id
      WHERE ps.project_id = p.id AND LOWER(s.name) = LOWER($${paramIdx})
    )`;
    params.push(skill);
    paramIdx++;
  }

  if (student_id) {
    baseQuery += ` AND p.student_id = $${paramIdx}`;
    params.push(parseInt(student_id));
    paramIdx++;
  }

  const countRes = await query(`SELECT COUNT(*) ${baseQuery}`, params);
  const total = parseInt(countRes.rows[0].count);

  const dataRes = await query(
    `SELECT p.id, p.title, p.description, p.github_url, p.demo_url,
            p.emoji, p.merit_points, p.status, p.created_at,
            sp.anonymous_code, sp.merit_points AS author_points
     ${baseQuery}
     ORDER BY p.merit_points DESC, p.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, parseInt(limit), offset]
  );

  const projects = await attachSkills(dataRes.rows);

  return res.json({
    data: projects,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
};

/**
 * GET /api/projects/mine
 * Returns all projects for the authenticated student (any status).
 */
const myProjects = async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students have projects' });
  }

  const result = await query(
    `SELECT id, title, description, github_url, demo_url, emoji, merit_points, status, created_at
     FROM projects WHERE student_id = $1 ORDER BY created_at DESC`,
    [req.user.id]
  );

  const projects = await attachSkills(result.rows);
  return res.json({ data: projects });
};

/**
 * GET /api/projects/:id
 */
const getProject = async (req, res) => {
  const { id } = req.params;

  const result = await query(
    `SELECT p.id, p.title, p.description, p.github_url, p.demo_url,
            p.emoji, p.merit_points, p.status, p.created_at, p.student_id,
            sp.anonymous_code, sp.merit_points AS author_points, sp.global_rank
     FROM projects p
     LEFT JOIN student_profiles sp ON sp.user_id = p.student_id
     WHERE p.id = $1`,
    [id]
  );

  if (result.rowCount === 0) return res.status(404).json({ error: 'Project not found' });

  const project = result.rows[0];
  const [withSkills] = await attachSkills([project]);

  // Hide student_id from non-admin non-owner
  if (req.user?.role !== 'admin' && req.user?.id !== project.student_id) {
    delete withSkills.student_id;
  }

  return res.json(withSkills);
};

/**
 * POST /api/projects
 * Students only.
 * Body: { title, description, github_url?, demo_url?, emoji?, skills[] }
 */
const createProject = async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can create projects' });
  }

  const { title, description, github_url, demo_url, emoji = '🚀', skills = [] } = req.body;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const projRes = await client.query(
      `INSERT INTO projects (student_id, title, description, github_url, demo_url, emoji, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id, title, description, github_url, demo_url, emoji, status, created_at`,
      [req.user.id, title, description, github_url || null, demo_url || null, emoji]
    );
    const project = projRes.rows[0];

    if (skills.length) {
      const skillIds = await resolveSkillIds(client, skills);
      for (const skillId of skillIds) {
        await client.query(
          'INSERT INTO project_skills (project_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [project.id, skillId]
        );
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({ ...project, skills });

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * PUT /api/projects/:id
 * Student can update their own pending/rejected project.
 * Admin can update any project.
 */
const updateProject = async (req, res) => {
  const { id } = req.params;
  const { title, description, github_url, demo_url, emoji, skills } = req.body;

  const existing = await query('SELECT * FROM projects WHERE id = $1', [id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'Project not found' });

  const proj = existing.rows[0];

  if (req.user.role !== 'admin' && req.user.id !== proj.student_id) {
    return res.status(403).json({ error: 'Not authorised to edit this project' });
  }

  if (req.user.role !== 'admin' && proj.status === 'approved') {
    return res.status(400).json({ error: 'Approved projects cannot be edited. Contact admin.' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const updated = await client.query(
      `UPDATE projects SET
         title       = COALESCE($1, title),
         description = COALESCE($2, description),
         github_url  = COALESCE($3, github_url),
         demo_url    = COALESCE($4, demo_url),
         emoji       = COALESCE($5, emoji),
         status      = 'pending',
         updated_at  = NOW()
       WHERE id = $6
       RETURNING id, title, description, github_url, demo_url, emoji, status, updated_at`,
      [title, description, github_url, demo_url, emoji, id]
    );

    if (skills !== undefined) {
      await client.query('DELETE FROM project_skills WHERE project_id = $1', [id]);
      if (skills.length) {
        const skillIds = await resolveSkillIds(client, skills);
        for (const skillId of skillIds) {
          await client.query(
            'INSERT INTO project_skills (project_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, skillId]
          );
        }
      }
    }

    await client.query('COMMIT');
    return res.json(updated.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/projects/:id
 * Owner or admin.
 */
const deleteProject = async (req, res) => {
  const { id } = req.params;

  const existing = await query('SELECT student_id FROM projects WHERE id = $1', [id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'Project not found' });

  if (req.user.role !== 'admin' && req.user.id !== existing.rows[0].student_id) {
    return res.status(403).json({ error: 'Not authorised to delete this project' });
  }

  await query('DELETE FROM projects WHERE id = $1', [id]);
  return res.json({ message: 'Project deleted' });
};

/**
 * PATCH /api/projects/:id/status  (admin only)
 * Body: { status: 'approved' | 'rejected', merit_points? }
 */
const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, merit_points } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(422).json({ error: 'status must be approved or rejected' });
  }

  const existing = await query('SELECT student_id FROM projects WHERE id = $1', [id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'Project not found' });

  const pts = merit_points || (status === 'approved' ? 200 : 0);

  await query(
    `UPDATE projects SET status = $1, merit_points = $2, updated_at = NOW() WHERE id = $3`,
    [status, pts, id]
  );

  // Award merit points to student if approved
  if (status === 'approved') {
    await query(
      `UPDATE student_profiles SET merit_points = merit_points + $1 WHERE user_id = $2`,
      [pts, existing.rows[0].student_id]
    );
  }

  return res.json({ message: `Project ${status}`, merit_points: pts });
};

module.exports = { listProjects, myProjects, getProject, createProject, updateProject, deleteProject, updateStatus };