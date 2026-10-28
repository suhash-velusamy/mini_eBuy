const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  logout,
  getMe,
  switchRole,
  getDemoAccounts,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Rate limiter for authentication attempts (e.g. max 20 per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.patch('/switch-role', protect, switchRole);
router.patch('/me/notification-prefs', protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Notification preferences updated successfully.',
    prefs: req.body,
  });
});
router.get('/demo-accounts', getDemoAccounts);

module.exports = router;
