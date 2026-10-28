const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization Bearer header or cookies
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'campus_auction_default_secret_key_2026'
    );

    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token. Please log in again.',
    });
  }
};

// Optional auth for endpoints where auth provides personalized data but guests are allowed
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'campus_auction_default_secret_key_2026'
      );
      req.user = await User.findById(decoded.id).select('-passwordHash');
    }
  } catch (err) {
    // If token invalid, simply proceed as guest
    req.user = null;
  }
  next();
};

module.exports = {
  protect,
  optionalAuth,
};
