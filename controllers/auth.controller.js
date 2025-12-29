const User = require('../models/user.model');
const jwt = require('jsonwebtoken');

// Password validation function (exported for use in other controllers)
const validatePassword = (password) => {
  if (!password || password.length < 6 || password.length > 10) {
    return 'Password must be between 6 and 10 characters';
  }
  
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one symbol';
  }
  
  return null;
};

// Export for use in other controllers
exports.validatePassword = validatePassword;

// @desc    Register a new user (requires email verification)
// @route   POST /api/users/reg
// @access  Public
exports.registerUser = async (req, res) => {
  try {
    const { username, password, firstName, lastName, email, phone, employeeId, department, verificationCode } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide username and password' });
    }

    // Email is now required for registration
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Verify email verification code
    if (!verificationCode) {
      return res.status(400).json({ message: 'Email verification code is required. Please verify your email first.' });
    }

    const EmailVerification = require('../models/emailVerification.model');
    const verification = await EmailVerification.findOne({
      email: email.toLowerCase().trim(),
      code: verificationCode,
      type: 'registration',
      verified: true,
    });

    if (!verification) {
      return res.status(400).json({ message: 'Invalid or unverified email code. Please verify your email first.' });
    }

    // Check if code has expired
    if (new Date() > verification.expiresAt) {
      await EmailVerification.findByIdAndDelete(verification._id);
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    // Check if username already exists
    const userExists = await User.findOne({ username });

    if (userExists) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Check if email is already associated with another user
    const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (emailExists) {
      return res.status(400).json({ message: 'Email is already associated with another account' });
    }

    const user = await User.create({
      username,
      password,
      firstName: firstName || '',
      lastName: lastName || '',
      email: email.toLowerCase().trim(),
      phone: phone || '',
      employeeId: employeeId || '',
      department: department || 'meter',
      role: department === 'admin' ? 'admin' : 'meter_reader',
    });

    // Delete verification record after successful registration
    await EmailVerification.findByIdAndDelete(verification._id);

    if (user) {
      // Update last login
      await user.updateLastLogin();
      
      res.status(201).json({
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        employeeId: user.employeeId,
        department: user.department,
        role: user.role,
        jobsCompleted: user.jobsCompleted,
        weeklyPerformance: user.weeklyPerformance,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Register user error:', error);
    // Handle duplicate key error (username already exists)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};


// @desc    Authenticate user & get token (Login)
// @route   POST /api/users/login
// @access  Public
exports.loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide username and password' });
    }

    const user = await User.findOne({ username });

    if (!user || !(await user.matchPassword(password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login and set isActive to true when operative logs in
    user.lastLogin = new Date();
    user.isActive = true; // Set active when they log in
    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      employeeId: user.employeeId,
      department: user.department,
      role: user.role,
      jobsCompleted: user.jobsCompleted,
      weeklyPerformance: user.weeklyPerformance,
      lastLogin: user.lastLogin,
      token: generateToken(user._id),
    });

  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      employeeId: user.employeeId,
      department: user.department,
      role: user.role,
      jobsCompleted: user.jobsCompleted,
      weeklyPerformance: user.weeklyPerformance,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, department } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.email = email || user.email;
    user.phone = phone || user.phone;
    user.department = department || user.department;

    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      employeeId: user.employeeId,
      department: user.department,
      role: user.role,
      jobsCompleted: user.jobsCompleted,
      weeklyPerformance: user.weeklyPerformance,
      lastLogin: user.lastLogin,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
}; 