/**
 * Integration tests for authentication routes
 */

// Mock emailService BEFORE requiring anything else to prevent actual emails
jest.mock('../../utils/emailService', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'test-message-id',
  }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'test-message-id',
  }),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../../models/user.model');
const EmailVerification = require('../../models/emailVerification.model');
const { createTestApp } = require('../helpers/testApp');
const { createTestUser, generateTestToken } = require('../helpers/testHelpers');

// Create test app
const app = createTestApp();

describe('Authentication Routes Integration Tests', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Test user will be created in beforeEach
  });

  afterEach(async () => {
    // Clean up after each test
    await User.deleteMany({});
    await EmailVerification.deleteMany({});
  });

  describe('POST /api/auth/send-verification-code', () => {
    it('should send verification code successfully', async () => {
      const email = 'test@example.com';
      const emailService = require('../../utils/emailService');

      const response = await request(app)
        .post('/api/auth/send-verification-code')
        .send({ email, type: 'registration' })
        .expect(200);

      expect(response.body.message).toContain('sent');
      expect(response.body.expiresIn).toBe(600); // 10 minutes

      // Verify verification record was created
      const verification = await EmailVerification.findOne({ email });
      expect(verification).toBeTruthy();
      expect(verification.code).toBeDefined();
      expect(verification.type).toBe('registration');
      expect(verification.verified).toBe(false);
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/send-verification-code')
        .send({ type: 'registration' })
        .expect(400);

      expect(response.body.message).toBe('Email is required');
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/send-verification-code')
        .send({ email: 'invalid-email', type: 'registration' })
        .expect(400);

      expect(response.body.message).toBe('Invalid email format');
    });

    it('should return 400 when email already exists for registration', async () => {
      const user = await createTestUser({ email: 'existing@example.com' });

      const response = await request(app)
        .post('/api/auth/send-verification-code')
        .send({ email: 'existing@example.com', type: 'registration' })
        .expect(400);

      expect(response.body.message).toContain('already associated');
    });
  });

  describe('POST /api/auth/verify-code', () => {
    it('should verify code successfully', async () => {
      const email = 'test@example.com';
      const code = '123456';

      const verification = await EmailVerification.create({
        email,
        code,
        type: 'registration',
        verified: false,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      });

      const response = await request(app)
        .post('/api/auth/verify-code')
        .send({ email, code, type: 'registration' })
        .expect(200);

      expect(response.body.message).toBe('Email verified successfully');
      expect(response.body.verified).toBe(true);

      // Verify verification record was updated
      const updatedVerification = await EmailVerification.findById(verification._id);
      expect(updatedVerification.verified).toBe(true);
    });

    it('should return 400 when code is invalid', async () => {
      const email = 'test@example.com';

      await EmailVerification.create({
        email,
        code: '123456',
        type: 'registration',
        verified: false,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const response = await request(app)
        .post('/api/auth/verify-code')
        .send({ email, code: 'wrong-code', type: 'registration' })
        .expect(400);

      expect(response.body.message).toContain('Invalid or expired');
    });

    it('should return 400 when code has expired', async () => {
      const email = 'test@example.com';
      const code = '123456';

      await EmailVerification.create({
        email,
        code,
        type: 'registration',
        verified: false,
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      const response = await request(app)
        .post('/api/auth/verify-code')
        .send({ email, code, type: 'registration' })
        .expect(400);

      expect(response.body.message).toContain('expired');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register user successfully with valid verification code', async () => {
      const email = 'newuser@example.com';
      const code = '123456';

      // Create verified verification record
      const verification = await EmailVerification.create({
        email,
        code,
        type: 'registration',
        verified: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const userData = {
        username: 'newuser',
        password: 'Test123!@#',
        email,
        firstName: 'New',
        lastName: 'User',
        verificationCode: code,
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.username).toBe(userData.username);
      expect(response.body.email).toBe(email);
      expect(response.body.token).toBeDefined();
      expect(response.body._id).toBeDefined();

      // Verify user was created
      const user = await User.findOne({ username: userData.username });
      expect(user).toBeTruthy();
      expect(user.email).toBe(email.toLowerCase());

      // Verify verification record was deleted
      const deletedVerification = await EmailVerification.findById(verification._id);
      expect(deletedVerification).toBeNull();
    });

    it('should return 400 when verification code is missing', async () => {
      const userData = {
        username: 'newuser',
        password: 'Test123!@#',
        email: 'newuser@example.com',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.message).toContain('verification code is required');
    });

    it('should return 400 when password is weak', async () => {
      const email = 'newuser@example.com';
      const code = '123456';

      await EmailVerification.create({
        email,
        code,
        type: 'registration',
        verified: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const userData = {
        username: 'newuser',
        password: 'weak', // Weak password
        email,
        verificationCode: code,
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.message).toContain('Password must');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      testUser = await createTestUser({
        username: 'testuser',
        password: 'Test123!@#',
      });
    });

    it('should login user successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'Test123!@#',
        })
        .expect(200);

      expect(response.body.username).toBe('testuser');
      expect(response.body.token).toBeDefined();
      expect(response.body._id).toBeDefined();

      // Verify user is now active and lastLogin is updated
      const user = await User.findById(testUser._id);
      expect(user.isActive).toBe(true);
      expect(user.lastLogin).toBeInstanceOf(Date);
    });

    it('should return 400 when username is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Test123!@#' })
        .expect(400);

      expect(response.body.message).toContain('username and password');
    });

    it('should return 401 when credentials are invalid', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'WrongPassword123!@#',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 401 when user does not exist', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'Test123!@#',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/profile', () => {
    beforeEach(async () => {
      testUser = await createTestUser();
      authToken = generateTestToken(testUser._id);
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.username).toBe(testUser.username);
      expect(response.body._id).toBe(testUser._id.toString());
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 when token is missing', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.message).toContain('Not authorized');
    });

    it('should return 401 when token is invalid', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).toContain('Not authorized');
    });
  });

  describe('PUT /api/auth/profile', () => {
    beforeEach(async () => {
      testUser = await createTestUser();
      authToken = generateTestToken(testUser._id);
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com',
        phone: '9876543210',
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.firstName).toBe(updateData.firstName);
      expect(response.body.lastName).toBe(updateData.lastName);
      expect(response.body.email).toBe(updateData.email);
      expect(response.body.phone).toBe(updateData.phone);

      // Verify user was updated in database
      const user = await User.findById(testUser._id);
      expect(user.firstName).toBe(updateData.firstName);
    });

    it('should return 401 when token is missing', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .send({ firstName: 'Updated' })
        .expect(401);

      expect(response.body.message).toContain('Not authorized');
    });

    it('should only update provided fields', async () => {
      const originalEmail = testUser.email;

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Updated' })
        .expect(200);

      expect(response.body.firstName).toBe('Updated');
      expect(response.body.email).toBe(originalEmail); // Should remain unchanged
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset code successfully', async () => {
      const user = await createTestUser({ email: 'user@example.com' });
      const emailService = require('../../utils/emailService');

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(200);

      expect(response.body.message).toContain('sent');
      expect(response.body.sent).toBe(true);

      // Verify verification record was created
      const verification = await EmailVerification.findOne({
        email: 'user@example.com',
        type: 'password_reset',
      });
      expect(verification).toBeTruthy();
    });

    it('should return success even when email does not exist (security)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.message).toContain('sent');
      expect(response.body.sent).toBe(true);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password successfully with valid code', async () => {
      const user = await createTestUser({ email: 'user@example.com' });
      const code = '123456';

      // Create verified verification record
      await EmailVerification.create({
        email: 'user@example.com',
        code,
        type: 'password_reset',
        verified: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const newPassword = 'NewPass1!'; // 9 characters - within limit

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'user@example.com',
          code,
          newPassword,
        })
        .expect(200);

      expect(response.body.message).toBe('Password reset successfully');

      // Verify password was changed
      const updatedUser = await User.findById(user._id);
      const isPasswordChanged = await updatedUser.matchPassword(newPassword);
      expect(isPasswordChanged).toBe(true);

      // Verify old password doesn't work
      const isOldPasswordValid = await updatedUser.matchPassword('Test123!@#');
      expect(isOldPasswordValid).toBe(false);
    });

    it('should return 400 when code is invalid', async () => {
      // Use a valid password format so password validation passes and code validation is checked
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'user@example.com',
          code: 'wrong-code',
          newPassword: 'NewPass1!', // Valid password (9 chars) so code validation is checked
        })
        .expect(400);

      // Password validation happens first, but with valid password, code validation should fail
      expect(response.body.message).toContain('Invalid or unverified');
    });

    it('should return 400 when new password is weak', async () => {
      const user = await createTestUser({ email: 'user@example.com' });
      const code = '123456';

      await EmailVerification.create({
        email: 'user@example.com',
        code,
        type: 'password_reset',
        verified: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'user@example.com',
          code,
          newPassword: 'weak', // Weak password
        })
        .expect(400);

      expect(response.body.message).toContain('Password must');
    });
  });
});

