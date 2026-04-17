-- ============================================================
--  Signals Platform — PostgreSQL Schema
--  Run once: psql -U postgres -d signals_db -f schema.sql
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS ────────────────────────────────────────────────────
CREATE TYPE user_role   AS ENUM ('student', 'recruiter', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'pending', 'banned');

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(150) NOT NULL,
  role          user_role   NOT NULL DEFAULT 'student',
  status        user_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── STUDENT PROFILES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_profiles (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  anonymous_code VARCHAR(20) UNIQUE,          -- e.g. "A-047"
  bio            TEXT,
  merit_points   INTEGER NOT NULL DEFAULT 0,
  global_rank    INTEGER,
  level          INTEGER NOT NULL DEFAULT 1,
  xp             INTEGER NOT NULL DEFAULT 0,
  avatar_color   VARCHAR(20) DEFAULT 'av-purple',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RECRUITER PROFILES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS recruiter_profiles (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(150),
  industry     VARCHAR(100),
  employee_count INTEGER,
  location     VARCHAR(150),
  bio          TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SKILLS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL
);

INSERT INTO skills (name) VALUES
  ('React'),('Node.js'),('Python'),('PostgreSQL'),('TypeScript'),
  ('UI/UX'),('Figma'),('CSS'),('Docker'),('ML'),
  ('Data Science'),('GraphQL'),('AWS'),('Firebase'),('Redis'),
  ('Marketing'),('SEO'),('Analytics'),('React Native'),('JavaScript')
ON CONFLICT DO NOTHING;

-- ── STUDENT SKILLS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_skills (
  student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  skill_id   INTEGER REFERENCES skills(id) ON DELETE CASCADE,
  proficiency SMALLINT NOT NULL DEFAULT 50 CHECK (proficiency BETWEEN 0 AND 100),
  PRIMARY KEY (student_id, skill_id)
);

-- ── PROJECTS ─────────────────────────────────────────────────
CREATE TYPE project_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  github_url  VARCHAR(500),
  demo_url    VARCHAR(500),
  emoji       VARCHAR(10) DEFAULT '🚀',
  merit_points INTEGER NOT NULL DEFAULT 0,
  status      project_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PROJECT SKILLS (many-to-many) ────────────────────────────
CREATE TABLE IF NOT EXISTS project_skills (
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  skill_id   INTEGER REFERENCES skills(id)   ON DELETE CASCADE,
  PRIMARY KEY (project_id, skill_id)
);

-- ── SHORTLIST ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shortlist (
  recruiter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  student_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (recruiter_id, student_id)
);

-- ── BADGES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(80) UNIQUE NOT NULL,
  emoji VARCHAR(10),
  description TEXT
);

INSERT INTO badges (name, emoji, description) VALUES
  ('Top Dev',    '🏆', 'Ranked in the top 10 globally'),
  ('Fast Coder', '⚡', 'Completed a challenge in under half the time limit'),
  ('Precision',  '🎯', 'Received 5-star reviews on 3 consecutive projects'),
  ('Legend',     '🌟', 'Reached 5,000 merit points'),
  ('Streak',     '🔥', 'Submitted projects 7 days in a row'),
  ('Diamond',    '💎', 'Completed every challenge in a skill category')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS student_badges (
  student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  badge_id   INTEGER REFERENCES badges(id) ON DELETE CASCADE,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, badge_id)
);

-- ── REFRESH TOKENS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_student   ON projects(student_id);
CREATE INDEX IF NOT EXISTS idx_projects_status    ON projects(status);
CREATE INDEX IF NOT EXISTS idx_shortlist_recruiter ON shortlist(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_student_skills     ON student_skills(student_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token      ON refresh_tokens(token);

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_projects_updated
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();