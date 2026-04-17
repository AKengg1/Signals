const { validationResult, body } = require('express-validator');

/** Runs after validation chains — returns 422 if any error exists */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
};

// ── Auth validators ──────────────────────────────────────────
const registerRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('role').isIn(['student', 'recruiter']).withMessage('Role must be student or recruiter'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Project validators ───────────────────────────────────────
const projectRules = [
  body('title').trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title max 200 chars'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('github_url').optional({ checkFalsy: true }).isURL().withMessage('Invalid GitHub URL'),
  body('demo_url').optional({ checkFalsy: true }).isURL().withMessage('Invalid demo URL'),
  body('skills').optional().isArray().withMessage('Skills must be an array of skill names'),
];

module.exports = { validate, registerRules, loginRules, projectRules };