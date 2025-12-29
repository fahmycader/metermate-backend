const express = require('express');
const router = express.Router();
const {
  sendVerificationCode,
  verifyCode,
  forgotPassword,
  resetPassword,
} = require('../controllers/emailVerification.controller');

// @route   POST /api/auth/send-verification-code
// @desc    Send verification code to email
// @access  Public
router.post('/send-verification-code', sendVerificationCode);

// @route   POST /api/auth/verify-code
// @desc    Verify email code
// @access  Public
router.post('/verify-code', verifyCode);

// @route   POST /api/auth/forgot-password
// @desc    Request password reset (sends verification code)
// @access  Public
router.post('/forgot-password', forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset password with verification code
// @access  Public
router.post('/reset-password', resetPassword);

module.exports = router;

