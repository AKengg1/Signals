const router = require('express').Router();
const {
  listCandidates, getCandidate, leaderboard,
  getShortlist, addToShortlist, removeFromShortlist, checkShortlist,
} = require('../controllers/candidate.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Leaderboard is public
router.get('/leaderboard', asyncHandler(leaderboard));

// Recruiter & admin only — browse anonymous profiles
router.get('/', authenticate, authorize('recruiter', 'admin'), asyncHandler(listCandidates));
router.get('/:anonymousCode', authenticate, authorize('recruiter', 'admin'), asyncHandler(getCandidate));

// Shortlist — recruiter only
router.get('/shortlist',                     authenticate, authorize('recruiter'), asyncHandler(getShortlist));
router.post('/shortlist/:anonymousCode',     authenticate, authorize('recruiter'), asyncHandler(addToShortlist));
router.delete('/shortlist/:anonymousCode',   authenticate, authorize('recruiter'), asyncHandler(removeFromShortlist));
router.get('/shortlist/check/:anonymousCode',authenticate, authorize('recruiter'), asyncHandler(checkShortlist));

module.exports = router;