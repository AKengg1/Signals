const router = require('express').Router();
const {
  listProjects, myProjects, getProject,
  createProject, updateProject, deleteProject, updateStatus,
} = require('../controllers/project.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { projectRules, validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

// Public (approved projects visible to all)
router.get('/', asyncHandler(listProjects));
router.get('/mine', authenticate, authorize('student'), asyncHandler(myProjects));
router.get('/:id', asyncHandler(getProject));

// Student — own projects
router.post('/', authenticate, authorize('student'), projectRules, validate, asyncHandler(createProject));
router.put('/:id', authenticate, projectRules, validate, asyncHandler(updateProject));
router.delete('/:id', authenticate, asyncHandler(deleteProject));

// Admin — moderate
router.patch('/:id/status', authenticate, authorize('admin'), asyncHandler(updateStatus));

module.exports = router;