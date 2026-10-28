const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper to generate JWT token
const signToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'campus_auction_default_secret_key_2026',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

// Helper to set HTTP-only cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  };

  res.cookie('token', token, cookieOptions);

  res.status(statusCode).json({
    success: true,
    token,
    user: user.toPublicJSON(),
  });
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new student user
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate inputs
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check college email domain restriction if configured
    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
    if (allowedDomain && allowedDomain.trim() !== '') {
      const cleanDomain = allowedDomain.trim().toLowerCase();
      const domainWithAt = cleanDomain.startsWith('@') ? cleanDomain : `@${cleanDomain}`;
      if (!trimmedEmail.endsWith(domainWithAt)) {
        return res.status(400).json({
          success: false,
          message: `Registration is restricted to college email addresses ending in "${domainWithAt}".`,
        });
      }
    }

    // Check for existing user
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Validate role
    const validRoles = ['bidder', 'seller', 'both', 'admin'];
    const assignedRole = role && validRoles.includes(role.toLowerCase()) ? role.toLowerCase() : 'bidder';

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      passwordHash,
      role: assignedRole,
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration.',
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token (supports role-based login)
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Find user including passwordHash
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email and password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email and password.',
      });
    }

    // If explicit role is selected on login, update or align user's active role
    if (role) {
      const validRoles = ['bidder', 'seller', 'both', 'admin'];
      const normalizedRole = role.toLowerCase();
      if (validRoles.includes(normalizedRole)) {
        // If user is admin, allow logging into any role perspective
        if (user.role !== 'admin' && user.role !== normalizedRole && user.role !== 'both') {
          // Update role to requested role so the student can operate in that mode
          user.role = normalizedRole;
          await user.save();
        }
      }
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login.',
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Log out user and clear cookie
 * @access  Public
 */
const logout = async (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

/**
 * @route   GET /api/auth/me
 * @desc    Get currently logged in user
 * @access  Private
 */
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user.toPublicJSON(),
  });
};

/**
 * @route   PATCH /api/auth/switch-role
 * @desc    Switch user role between bidder, seller, etc.
 * @access  Private
 */
const switchRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['bidder', 'seller', 'both', 'admin'];

    if (!role || !validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role provided. Valid roles: bidder, seller, both.',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    user.role = role.toLowerCase();
    await user.save();

    res.status(200).json({
      success: true,
      message: `Role switched to ${user.role} successfully.`,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('Error switching role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to switch role.',
    });
  }
};

/**
 * @route   GET /api/auth/demo-accounts
 * @desc    Get registered student demo accounts dynamically from database
 * @access  Public
 */
const getDemoAccounts = async (req, res) => {
  try {
    const users = await User.find({})
      .select('name email role createdAt')
      .limit(8);

    res.status(200).json({
      success: true,
      users: users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role || 'bidder',
      })),
    });
  } catch (error) {
    console.error('Error fetching demo accounts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch demo accounts.' });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  switchRole,
  getDemoAccounts,
};
