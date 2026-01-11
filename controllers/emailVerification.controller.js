const EmailVerification = require('../models/emailVerification.model');
const User = require('../models/user.model');
const { sendVerificationCode } = require('../utils/emailService');
const crypto = require('crypto');

/**
 * Generate a 6-digit verification code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Send verification code to email
 * @route POST /api/auth/send-verification-code
 */
exports.sendVerificationCode = async (req, res) => {
  try {
    const { email, type = 'registration' } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check if email already exists (for registration)
    if (type === 'registration') {
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        return res.status(400).json({ message: 'Email is already associated with another account' });
      }
    }

    // Check if email exists (for password reset)
    if (type === 'password_reset') {
      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        // Don't reveal if email exists or not for security
        return res.status(200).json({ 
          message: 'If the email exists, a verification code has been sent',
          sent: true 
        });
      }
    }

    // Generate verification code
    const code = generateVerificationCode();

    // Delete any existing unverified codes for this email and type
    await EmailVerification.deleteMany({
      email: email.toLowerCase().trim(),
      type: type,
      verified: false,
    });

    // Create new verification record
    const verification = await EmailVerification.create({
      email: email.toLowerCase().trim(),
      code: code,
      type: type,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Send email
    try {
      await sendVerificationCode(email, code, type);
      res.status(200).json({
        message: 'Verification code sent to your email',
        expiresIn: 600, // 10 minutes in seconds
      });
    } catch (emailError) {
      // Delete verification record if email fails
      await EmailVerification.findByIdAndDelete(verification._id);
      console.error('Email sending failed:', emailError);
      
      // Return a more helpful error message
      const errorMessage = emailError.message || 'Failed to send verification email. Please check your email configuration.';
      return res.status(500).json({
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? emailError.message : undefined,
      });
    }
  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

/**
 * Verify email code
 * @route POST /api/auth/verify-code
 */
exports.verifyCode = async (req, res) => {
  try {
    const { email, code, type = 'registration' } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }

    // Find verification record
    const verification = await EmailVerification.findOne({
      email: email.toLowerCase().trim(),
      code: code,
      type: type,
      verified: false,
    });

    if (!verification) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Check if code has expired
    if (new Date() > verification.expiresAt) {
      await EmailVerification.findByIdAndDelete(verification._id);
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    // Check attempt limit
    if (verification.attempts >= 5) {
      await EmailVerification.findByIdAndDelete(verification._id);
      return res.status(400).json({ message: 'Too many failed attempts. Please request a new code.' });
    }

    // Mark as verified
    verification.verified = true;
    await verification.save();

    res.status(200).json({
      message: 'Email verified successfully',
      verified: true,
    });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

/**
 * Request password reset
 * @route POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Don't reveal if email exists or not (security best practice)
    // Always return success message
    if (!user) {
      return res.status(200).json({
        message: 'If the email exists, a verification code has been sent',
        sent: true,
      });
    }

    // Generate verification code
    const code = generateVerificationCode();

    // Delete any existing password reset codes for this email
    await EmailVerification.deleteMany({
      email: email.toLowerCase().trim(),
      type: 'password_reset',
      verified: false,
    });

    // Create verification record
    const verification = await EmailVerification.create({
      email: email.toLowerCase().trim(),
      code: code,
      type: 'password_reset',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Send email
    try {
      await sendVerificationCode(email, code, 'password_reset');
      res.status(200).json({
        message: 'If the email exists, a verification code has been sent',
        sent: true,
        expiresIn: 600, // 10 minutes in seconds
      });
    } catch (emailError) {
      await EmailVerification.findByIdAndDelete(verification._id);
      console.error('Email sending failed:', emailError);
      
      // Provide user-friendly error message
      let errorMessage = 'Failed to send verification email. Please check your email configuration.';
      
      if (emailError.message.includes('Email service not configured') || 
          emailError.message.includes('Email configuration is missing')) {
        errorMessage = 'Email service is not configured. Please contact the administrator.';
      } else if (emailError.message.includes('Invalid login') || 
                 emailError.message.includes('authentication failed')) {
        errorMessage = 'Email authentication failed. Please contact the administrator.';
      } else if (emailError.message.includes('ECONNREFUSED') || 
                 emailError.message.includes('ETIMEDOUT')) {
        errorMessage = 'Cannot connect to email server. Please try again later or contact the administrator.';
      }
      
      return res.status(500).json({
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? emailError.message : undefined,
        code: 'EMAIL_SEND_FAILED',
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

/**
 * Reset password with verification code
 * @route POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Email, code, and new password are required' });
    }

    // Validate password
    const { validatePassword } = require('./auth.controller');
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    // Find verified verification record
    const verification = await EmailVerification.findOne({
      email: email.toLowerCase().trim(),
      code: code,
      type: 'password_reset',
      verified: true,
    });

    if (!verification) {
      return res.status(400).json({ message: 'Invalid or unverified code. Please verify your email first.' });
    }

    // Check if code has expired
    if (new Date() > verification.expiresAt) {
      await EmailVerification.findByIdAndDelete(verification._id);
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Delete verification record
    await EmailVerification.findByIdAndDelete(verification._id);

    res.status(200).json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

