const router = require('express').Router();
const { register, login, me, updateMe, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { registerRules, loginRules, validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

// Public
router.post('/register', registerRules, validate, asyncHandler(register));
router.post('/login',    loginRules,    validate, asyncHandler(login));

// Protected
router.get('/me',               authenticate, asyncHandler(me));
router.put('/me',               authenticate, asyncHandler(updateMe));
router.post('/change-password', authenticate, asyncHandler(changePassword));

module.exports = router;