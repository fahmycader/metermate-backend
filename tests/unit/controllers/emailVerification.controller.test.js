/**
 * Unit tests for emailVerification controller
 */

// Mock dependencies BEFORE requiring the controller
jest.mock('../../../models/emailVerification.model', () => ({
  findOne: jest.fn(),
  findByIdAndDelete: jest.fn(),
  deleteMany: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../../models/user.model', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../../utils/emailService', () => ({
  sendVerificationCode: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock('../../../controllers/auth.controller', () => ({
  validatePassword: jest.fn(),
}));

const emailVerificationController = require('../../../controllers/emailVerification.controller');
const EmailVerification = require('../../../models/emailVerification.model');
const User = require('../../../models/user.model');
const emailService = require('../../../utils/emailService');
const authController = require('../../../controllers/auth.controller');
const {
  mockRequest,
  mockResponse,
} = require('../../helpers/testHelpers');

describe('emailVerification controller', () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();
  });

  describe('sendVerificationCode', () => {
    it('should send verification code successfully for registration', async () => {
      req.body = {
        email: 'test@example.com',
        type: 'registration',
      };

      User.findOne.mockResolvedValue(null); // Email doesn't exist
      EmailVerification.deleteMany.mockResolvedValue({ deletedCount: 0 });
      
      const mockVerification = {
        _id: 'verification-id',
        email: 'test@example.com',
        code: '123456',
        type: 'registration',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };
      EmailVerification.create.mockResolvedValue(mockVerification);
      EmailVerification.findByIdAndDelete.mockResolvedValue({});
      
      emailService.sendVerificationCode.mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
      });

      await emailVerificationController.sendVerificationCode(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(EmailVerification.deleteMany).toHaveBeenCalled();
      expect(EmailVerification.create).toHaveBeenCalled();
      expect(emailService.sendVerificationCode).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Verification code sent to your email',
        expiresIn: 600,
      });
    });

    it('should return 400 when email is missing', async () => {
      req.body = { type: 'registration' };

      await emailVerificationController.sendVerificationCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email is required',
      });
    });

    it('should return 400 when email format is invalid', async () => {
      req.body = {
        email: 'invalid-email',
        type: 'registration',
      };

      await emailVerificationController.sendVerificationCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid email format',
      });
    });

    it('should return 400 when email already exists for registration', async () => {
      // Create mock user object (don't use createTestUser when User is mocked)
      const existingUser = {
        _id: '507f1f77bcf86cd799439011',
        username: 'existinguser',
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
      };
      
      req.body = {
        email: 'existing@example.com',
        type: 'registration',
      };

      User.findOne.mockResolvedValue(existingUser);

      await emailVerificationController.sendVerificationCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email is already associated with another account',
      });
    });

    it('should return success even when email does not exist for password reset (security)', async () => {
      req.body = {
        email: 'nonexistent@example.com',
        type: 'password_reset',
      };

      User.findOne.mockResolvedValue(null);

      await emailVerificationController.sendVerificationCode(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'If the email exists, a verification code has been sent',
        sent: true,
      });
    });

    it('should delete verification record if email sending fails', async () => {
      req.body = {
        email: 'test@example.com',
        type: 'registration',
      };

      User.findOne.mockResolvedValue(null);
      EmailVerification.deleteMany.mockResolvedValue({ deletedCount: 0 });
      
      const mockVerification = {
        _id: 'verification-id',
        email: 'test@example.com',
      };
      EmailVerification.create.mockResolvedValue(mockVerification);
      EmailVerification.findByIdAndDelete.mockResolvedValue({});
      
      emailService.sendVerificationCode.mockRejectedValue(
        new Error('Email sending failed')
      );

      await emailVerificationController.sendVerificationCode(req, res);

      expect(EmailVerification.findByIdAndDelete).toHaveBeenCalledWith('verification-id');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/Failed to send|Email sending failed/i),
        })
      );
    });
  });

  describe('verifyCode', () => {
    it('should verify code successfully', async () => {
      req.body = {
        email: 'test@example.com',
        code: '123456',
        type: 'registration',
      };

      const mockVerification = {
        _id: 'verification-id',
        email: 'test@example.com',
        code: '123456',
        type: 'registration',
        verified: false,
        attempts: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        save: jest.fn().mockResolvedValue(true),
      };

      EmailVerification.findOne.mockResolvedValue(mockVerification);

      await emailVerificationController.verifyCode(req, res);

      expect(EmailVerification.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
        code: '123456',
        type: 'registration',
        verified: false,
      });
      expect(mockVerification.verified).toBe(true);
      expect(mockVerification.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email verified successfully',
        verified: true,
      });
    });

    it('should return 400 when email is missing', async () => {
      req.body = { code: '123456', type: 'registration' };

      await emailVerificationController.verifyCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email and code are required',
      });
    });

    it('should return 400 when code is missing', async () => {
      req.body = { email: 'test@example.com', type: 'registration' };

      await emailVerificationController.verifyCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email and code are required',
      });
    });

    it('should return 400 when verification code is invalid', async () => {
      req.body = {
        email: 'test@example.com',
        code: 'wrong-code',
        type: 'registration',
      };

      EmailVerification.findOne.mockResolvedValue(null);

      await emailVerificationController.verifyCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid or expired verification code',
      });
    });

    it('should return 400 when code has expired', async () => {
      req.body = {
        email: 'test@example.com',
        code: '123456',
        type: 'registration',
      };

      const expiredVerification = {
        _id: 'verification-id',
        email: 'test@example.com',
        code: '123456',
        type: 'registration',
        verified: false,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      EmailVerification.findOne.mockResolvedValue(expiredVerification);
      EmailVerification.findByIdAndDelete.mockResolvedValue({});

      await emailVerificationController.verifyCode(req, res);

      expect(EmailVerification.findByIdAndDelete).toHaveBeenCalledWith('verification-id');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Verification code has expired',
      });
    });

    it('should return 400 when attempts exceed limit', async () => {
      req.body = {
        email: 'test@example.com',
        code: '123456',
        type: 'registration',
      };

      const verification = {
        _id: 'verification-id',
        email: 'test@example.com',
        code: '123456',
        type: 'registration',
        verified: false,
        attempts: 5, // Max attempts
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      EmailVerification.findOne.mockResolvedValue(verification);
      EmailVerification.findByIdAndDelete.mockResolvedValue({});

      await emailVerificationController.verifyCode(req, res);

      expect(EmailVerification.findByIdAndDelete).toHaveBeenCalledWith('verification-id');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Too many failed attempts. Please request a new code.',
      });
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset code successfully', async () => {
      // Create mock user object (don't use createTestUser when User is mocked)
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
      };
      
      req.body = { email: 'user@example.com' };

      User.findOne.mockResolvedValue(mockUser);
      EmailVerification.deleteMany.mockResolvedValue({ deletedCount: 0 });
      
      const mockVerification = {
        _id: 'verification-id',
        email: 'user@example.com',
        code: '123456',
        type: 'password_reset',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };
      EmailVerification.create.mockResolvedValue(mockVerification);
      EmailVerification.findByIdAndDelete.mockResolvedValue({});
      
      emailService.sendVerificationCode.mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
      });

      await emailVerificationController.forgotPassword(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
      expect(EmailVerification.deleteMany).toHaveBeenCalled();
      expect(EmailVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
          type: 'password_reset',
        })
      );
      expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
        'password_reset'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'If the email exists, a verification code has been sent',
        sent: true,
        expiresIn: 600,
      });
    });

    it('should return success even when email does not exist (security)', async () => {
      req.body = { email: 'nonexistent@example.com' };

      User.findOne.mockResolvedValue(null);

      await emailVerificationController.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'If the email exists, a verification code has been sent',
        sent: true,
      });
      expect(EmailVerification.create).not.toHaveBeenCalled();
    });

    it('should return 400 when email is missing', async () => {
      req.body = {};

      await emailVerificationController.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email is required',
      });
    });

    it('should return 400 when email format is invalid', async () => {
      req.body = { email: 'invalid-email' };

      await emailVerificationController.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid email format',
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully with valid code', async () => {
      // Create mock user object (don't use createTestUser when User is mocked)
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'old-hashed-password',
        save: jest.fn().mockResolvedValue(true),
      };
      
      req.body = {
        email: 'user@example.com',
        code: '123456',
        newPassword: 'NewPass123!@#',
      };

      const mockVerification = {
        _id: 'verification-id',
        email: 'user@example.com',
        code: '123456',
        type: 'password_reset',
        verified: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      EmailVerification.findOne.mockResolvedValue(mockVerification);
      User.findOne.mockResolvedValue(mockUser);
      EmailVerification.findByIdAndDelete.mockResolvedValue({});
      
      // Mock validatePassword from auth.controller
      const authController = require('../../../controllers/auth.controller');
      jest.spyOn(authController, 'validatePassword').mockReturnValue(null); // Valid password

      await emailVerificationController.resetPassword(req, res);

      expect(EmailVerification.findOne).toHaveBeenCalledWith({
        email: 'user@example.com',
        code: '123456',
        type: 'password_reset',
        verified: true,
      });
      expect(authController.validatePassword).toHaveBeenCalledWith('NewPass123!@#');
      expect(mockUser.password).toBe('NewPass123!@#');
      expect(mockUser.save).toHaveBeenCalled();
      expect(EmailVerification.findByIdAndDelete).toHaveBeenCalledWith('verification-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Password reset successfully',
      });
    });

    it('should return 400 when email is missing', async () => {
      req.body = { code: '123456', newPassword: 'NewPass123!@#' };

      await emailVerificationController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email, code, and new password are required',
      });
    });

    it('should return 400 when code is missing', async () => {
      req.body = { email: 'user@example.com', newPassword: 'NewPass123!@#' };

      await emailVerificationController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email, code, and new password are required',
      });
    });

    it('should return 400 when newPassword is missing', async () => {
      req.body = { email: 'user@example.com', code: '123456' };

      await emailVerificationController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email, code, and new password are required',
      });
    });

    it('should return 400 when password is weak', async () => {
      req.body = {
        email: 'user@example.com',
        code: '123456',
        newPassword: 'weak',
      };

      authController.validatePassword.mockReturnValue('Password must be between 6 and 10 characters');

      await emailVerificationController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Password must be between 6 and 10 characters',
      });
    });

    it('should return 400 when verification code is invalid', async () => {
      req.body = {
        email: 'user@example.com',
        code: 'wrong-code',
        newPassword: 'NewPass123!@#',
      };

      EmailVerification.findOne.mockResolvedValue(null);
      authController.validatePassword.mockReturnValue(null);

      await emailVerificationController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid or unverified code. Please verify your email first.',
      });
    });

    it('should return 400 when code has expired', async () => {
      req.body = {
        email: 'user@example.com',
        code: '123456',
        newPassword: 'NewPass123!@#',
      };

      const expiredVerification = {
        _id: 'verification-id',
        email: 'user@example.com',
        code: '123456',
        type: 'password_reset',
        verified: true,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      EmailVerification.findOne.mockResolvedValue(expiredVerification);
      EmailVerification.findByIdAndDelete.mockResolvedValue({});
      authController.validatePassword.mockReturnValue(null);

      await emailVerificationController.resetPassword(req, res);

      expect(EmailVerification.findByIdAndDelete).toHaveBeenCalledWith('verification-id');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Verification code has expired. Please request a new one.',
      });
    });

    it('should return 404 when user is not found', async () => {
      req.body = {
        email: 'nonexistent@example.com',
        code: '123456',
        newPassword: 'NewPass123!@#',
      };

      const mockVerification = {
        _id: 'verification-id',
        email: 'nonexistent@example.com',
        code: '123456',
        type: 'password_reset',
        verified: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      EmailVerification.findOne.mockResolvedValue(mockVerification);
      User.findOne.mockResolvedValue(null);
      authController.validatePassword.mockReturnValue(null);

      await emailVerificationController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });
  });
});

