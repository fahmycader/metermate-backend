/**
 * Unit tests for auth controller
 */

// Mock dependencies BEFORE requiring the controller
jest.mock('../../../models/user.model', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../../models/emailVerification.model', () => ({
  findOne: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../../../utils/emailService', () => ({
  sendVerificationCode: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

const authController = require('../../../controllers/auth.controller');
const User = require('../../../models/user.model');
const EmailVerification = require('../../../models/emailVerification.model');
const emailService = require('../../../utils/emailService');
const {
  mockRequest,
  mockResponse,
  generateTestToken,
} = require('../../helpers/testHelpers');
const userFixtures = require('../../fixtures/userFixtures');

describe('auth controller', () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();
  });

  describe('validatePassword', () => {
    it('should return null for valid password', () => {
      const validPassword = 'Test123!@#';
      const result = authController.validatePassword(validPassword);
      expect(result).toBeNull();
    });

    it('should return error for password less than 6 characters', () => {
      const shortPassword = 'Test1';
      const result = authController.validatePassword(shortPassword);
      expect(result).toBe('Password must be between 6 and 10 characters');
    });

    it('should return error for password more than 10 characters', () => {
      const longPassword = 'Test123!@#Extra';
      const result = authController.validatePassword(longPassword);
      expect(result).toBe('Password must be between 6 and 10 characters');
    });

    it('should return error for password without uppercase', () => {
      const noUppercase = 'test123!@#';
      const result = authController.validatePassword(noUppercase);
      expect(result).toBe('Password must contain at least one uppercase letter');
    });

    it('should return error for password without lowercase', () => {
      const noLowercase = 'TEST123!@#';
      const result = authController.validatePassword(noLowercase);
      expect(result).toBe('Password must contain at least one lowercase letter');
    });

    it('should return error for password without number', () => {
      const noNumber = 'TestPass!@'; // 9 characters - within length but no number
      const result = authController.validatePassword(noNumber);
      expect(result).toBe('Password must contain at least one number');
    });

    it('should return error for password without symbol', () => {
      const noSymbol = 'Test12345';
      const result = authController.validatePassword(noSymbol);
      expect(result).toBe('Password must contain at least one symbol');
    });
  });

  describe('registerUser', () => {
    it('should register user successfully with valid data', async () => {
      const userData = userFixtures.validUser;
      req.body = {
        ...userData,
        verificationCode: '123456',
      };

      const mockVerification = {
        _id: 'verification-id',
        email: userData.email.toLowerCase(),
        code: '123456',
        type: 'registration',
        verified: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      const mockUser = {
        _id: 'user-id',
        ...userData,
        toObject: () => ({ ...userData, _id: 'user-id' }),
        updateLastLogin: jest.fn().mockResolvedValue(),
      };

      EmailVerification.findOne.mockResolvedValue(mockVerification);
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      EmailVerification.findByIdAndDelete.mockResolvedValue({});

      // Mock jwt.sign (generateToken uses jwt.sign internally)
      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'sign').mockReturnValue('mock-token');

      await authController.registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: mockUser._id,
          username: userData.username,
          token: 'mock-token',
        })
      );
      expect(EmailVerification.findByIdAndDelete).toHaveBeenCalled();
    });

    it('should return 400 when username is missing', async () => {
      req.body = { password: 'Test123!@#' };

      await authController.registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Please provide username and password',
      });
    });

    it('should return 400 when password is missing', async () => {
      req.body = { username: 'testuser' };

      await authController.registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Please provide username and password',
      });
    });

    it('should return 400 when email is missing', async () => {
      req.body = {
        username: 'testuser',
        password: 'Test123!@#',
      };

      await authController.registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email is required',
      });
    });

    it('should return 400 when email format is invalid', async () => {
      req.body = {
        username: 'testuser',
        password: 'Test123!@#',
        email: 'invalid-email',
      };

      await authController.registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid email format',
      });
    });

    it('should return 400 when verification code is missing', async () => {
      req.body = {
        username: 'testuser',
        password: 'Test123!@#',
        email: 'test@example.com',
      };

      await authController.registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email verification code is required. Please verify your email first.',
      });
    });

    it('should return 400 when verification code is invalid', async () => {
      req.body = {
        username: 'testuser',
        password: 'Test123!@#',
        email: 'test@example.com',
        verificationCode: 'wrong-code',
      };

      EmailVerification.findOne.mockResolvedValue(null);

      await authController.registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid or unverified email code. Please verify your email first.',
      });
    });

    it('should return 400 when verification code has expired', async () => {
      req.body = {
        username: 'testuser',
        password: 'Test123!@#',
        email: 'test@example.com',
        verificationCode: '123456',
      };

      const expiredVerification = {
        _id: 'verification-id',
        email: 'test@example.com',
        code: '123456',
        type: 'registration',
        verified: true,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      EmailVerification.findOne.mockResolvedValue(expiredVerification);
      EmailVerification.findByIdAndDelete.mockResolvedValue({});

      await authController.registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Verification code has expired. Please request a new one.',
      });
    });

    it('should return 400 when password is weak', async () => {
      req.body = {
        username: 'testuser',
        password: 'weak',
        email: 'test@example.com',
        verificationCode: '123456',
      };

      const mockVerification = {
        _id: 'verification-id',
        email: 'test@example.com',
        code: '123456',
        type: 'registration',
        verified: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      EmailVerification.findOne.mockResolvedValue(mockVerification);

      await authController.registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining('Password must'),
      });
    });

    it('should return 400 when username already exists', async () => {
      req.body = {
        username: 'existinguser',
        password: 'Test123!@#',
        email: 'test@example.com',
        verificationCode: '123456',
      };

      const mockVerification = {
        _id: 'verification-id',
        email: 'test@example.com',
        code: '123456',
        type: 'registration',
        verified: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      EmailVerification.findOne.mockResolvedValue(mockVerification);
      User.findOne.mockResolvedValue({ username: 'existinguser' });

      await authController.registerUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Username already exists',
      });
    });
  });

  describe('loginUser', () => {
    it('should login user successfully with valid credentials', async () => {
      // Create mock user object (don't use createTestUser when User is mocked)
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '1234567890',
        employeeId: 'EMP001',
        department: 'meter',
        role: 'meter_reader',
        jobsCompleted: 0,
        weeklyPerformance: 0,
        isActive: false,
        matchPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      req.body = {
        username: mockUser.username,
        password: 'Test123!@#',
      };

      User.findOne.mockResolvedValue(mockUser);

      // Mock generateToken - need to check how it's exported
      // Since generateToken is not exported, we'll mock jwt.sign instead
      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'sign').mockReturnValue('mock-token');

      await authController.loginUser(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ username: mockUser.username });
      expect(mockUser.matchPassword).toHaveBeenCalledWith('Test123!@#');
      expect(mockUser.isActive).toBe(true);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: mockUser._id,
          username: mockUser.username,
          token: 'mock-token',
        })
      );
    });

    it('should return 400 when username is missing', async () => {
      req.body = { password: 'Test123!@#' };

      await authController.loginUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Please provide username and password',
      });
    });

    it('should return 401 when credentials are invalid', async () => {
      req.body = {
        username: 'nonexistent',
        password: 'wrongpassword',
      };

      User.findOne.mockResolvedValue(null);

      await authController.loginUser(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid credentials',
      });
    });

    it('should return 401 when password is incorrect', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        password: 'hashed-password',
        matchPassword: jest.fn().mockResolvedValue(false),
      };

      req.body = {
        username: mockUser.username,
        password: 'wrongpassword',
      };

      User.findOne.mockResolvedValue(mockUser);

      await authController.loginUser(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid credentials',
      });
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile successfully', async () => {
      const mockUserId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: mockUserId,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '1234567890',
        employeeId: 'EMP001',
        department: 'meter',
        role: 'meter_reader',
        jobsCompleted: 0,
        weeklyPerformance: 0,
        lastLogin: new Date(),
        createdAt: new Date(),
      };
      
      req.user = { id: mockUserId };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await authController.getUserProfile(req, res);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: mockUserId,
          username: mockUser.username,
        })
      );
      expect(res.json.mock.calls[0][0]).not.toHaveProperty('password');
    });

    it('should return 404 when user is not found', async () => {
      req.user = { id: 'nonexistent-id' };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await authController.getUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      const mockUserId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: mockUserId,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '1234567890',
        employeeId: 'EMP001',
        department: 'meter',
        role: 'meter_reader',
        jobsCompleted: 0,
        weeklyPerformance: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      req.user = { id: mockUserId };
      req.body = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com',
        phone: '9876543210',
      };

      User.findById.mockResolvedValue(mockUser);

      await authController.updateUserProfile(req, res);

      expect(mockUser.firstName).toBe('Updated');
      expect(mockUser.lastName).toBe('Name');
      expect(mockUser.email).toBe('updated@example.com');
      expect(mockUser.phone).toBe('9876543210');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Updated',
        })
      );
    });

    it('should return 404 when user is not found', async () => {
      req.user = { id: 'nonexistent-id' };
      req.body = { firstName: 'Updated' };

      User.findById.mockResolvedValue(null);

      await authController.updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });

    it('should only update provided fields', async () => {
      const mockUserId = '507f1f77bcf86cd799439011';
      const originalEmail = 'test@example.com';
      const mockUser = {
        _id: mockUserId,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        email: originalEmail,
        phone: '1234567890',
        employeeId: 'EMP001',
        department: 'meter',
        role: 'meter_reader',
        jobsCompleted: 0,
        weeklyPerformance: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      req.user = { id: mockUserId };
      req.body = {
        firstName: 'Updated',
      };

      User.findById.mockResolvedValue(mockUser);

      await authController.updateUserProfile(req, res);

      expect(mockUser.firstName).toBe('Updated');
      expect(mockUser.email).toBe(originalEmail); // Should remain unchanged
    });
  });
});

