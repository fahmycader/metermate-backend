/**
 * Unit tests for User model
 */

const mongoose = require('mongoose');
const User = require('../../../models/user.model');
const bcrypt = require('bcryptjs');

describe('User Model', () => {
  beforeAll(async () => {
    // Ensure we're using the test database
  });

  afterEach(async () => {
    // Clean up after each test
    await User.deleteMany({});
  });

  describe('User Schema Validation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        username: 'testuser',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '1234567890',
        employeeId: 'EMP001',
        department: 'meter',
        role: 'meter_reader',
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.username).toBe(userData.username.toLowerCase());
      expect(savedUser.firstName).toBe(userData.firstName);
      expect(savedUser.lastName).toBe(userData.lastName);
      expect(savedUser.email).toBe(userData.email.toLowerCase());
      expect(savedUser.phone).toBe(userData.phone);
      expect(savedUser.employeeId).toBe(userData.employeeId);
      expect(savedUser.department).toBe(userData.department);
      expect(savedUser.role).toBe(userData.role);
      expect(savedUser.isActive).toBe(true);
      expect(savedUser.jobsCompleted).toBe(0);
      expect(savedUser.weeklyPerformance).toBe(0);
      expect(savedUser.password).not.toBe(userData.password); // Should be hashed
    });

    it('should require username', async () => {
      const user = new User({
        password: 'Test123!@#',
      });

      await expect(user.save()).rejects.toThrow('Username is required');
    });

    it('should require password', async () => {
      const user = new User({
        username: 'testuser',
      });

      await expect(user.save()).rejects.toThrow('Password is required');
    });

    it('should enforce unique username', async () => {
      const userData = {
        username: 'testuser',
        password: 'Test123!@#',
      };

      await User.create(userData);

      const duplicateUser = new User(userData);
      await expect(duplicateUser.save()).rejects.toThrow();
    });

    it('should enforce unique email', async () => {
      const userData1 = {
        username: 'user1',
        password: 'Test123!@#',
        email: 'test@example.com',
      };

      const userData2 = {
        username: 'user2',
        password: 'Test123!@#',
        email: 'test@example.com',
      };

      await User.create(userData1);
      const duplicateUser = new User(userData2);

      await expect(duplicateUser.save()).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const user = new User({
        username: 'testuser',
        password: 'Test123!@#',
        email: 'invalid-email',
      });

      await expect(user.save()).rejects.toThrow('valid email address');
    });

    it('should set default values correctly', async () => {
      const user = new User({
        username: 'testuser',
        password: 'Test123!@#',
      });

      const savedUser = await user.save();

      expect(savedUser.department).toBe('meter');
      expect(savedUser.role).toBe('meter_reader');
      expect(savedUser.isActive).toBe(true);
      expect(savedUser.jobsCompleted).toBe(0);
      expect(savedUser.weeklyPerformance).toBe(0);
    });

    it('should trim and lowercase username', async () => {
      const user = new User({
        username: '  TESTUSER  ',
        password: 'Test123!@#',
      });

      const savedUser = await user.save();
      expect(savedUser.username).toBe('testuser');
    });

    it('should trim and lowercase email', async () => {
      const user = new User({
        username: 'testuser',
        password: 'Test123!@#',
        email: '  TEST@EXAMPLE.COM  ',
      });

      const savedUser = await user.save();
      expect(savedUser.email).toBe('test@example.com');
    });

    it('should validate department enum', async () => {
      const user = new User({
        username: 'testuser',
        password: 'Test123!@#',
        department: 'invalid',
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should validate role enum', async () => {
      const user = new User({
        username: 'testuser',
        password: 'Test123!@#',
        role: 'invalid',
      });

      await expect(user.save()).rejects.toThrow();
    });
  });

  describe('Password Hashing', () => {
    it('should hash password before saving', async () => {
      const password = 'Test123!@#';
      const user = new User({
        username: 'testuser',
        password: password,
      });

      const savedUser = await user.save();

      expect(savedUser.password).not.toBe(password);
      expect(savedUser.password.length).toBeGreaterThan(20); // bcrypt hash length
    });

    it('should not rehash password if not modified', async () => {
      const password = 'Test123!@#';
      const user = new User({
        username: 'testuser',
        password: password,
      });

      const savedUser = await user.save();
      const originalPassword = savedUser.password;

      savedUser.firstName = 'Updated';
      await savedUser.save();

      expect(savedUser.password).toBe(originalPassword);
    });
  });

  describe('matchPassword method', () => {
    it('should return true for correct password', async () => {
      const password = 'Test123!@#';
      const user = new User({
        username: 'testuser',
        password: password,
      });

      const savedUser = await user.save();
      const isMatch = await savedUser.matchPassword(password);

      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'Test123!@#';
      const user = new User({
        username: 'testuser',
        password: password,
      });

      const savedUser = await user.save();
      const isMatch = await savedUser.matchPassword('WrongPassword123!@#');

      expect(isMatch).toBe(false);
    });
  });

  describe('updateLastLogin method', () => {
    it('should update lastLogin timestamp', async () => {
      const user = new User({
        username: 'testuser',
        password: 'Test123!@#',
      });

      const savedUser = await user.save();
      expect(savedUser.lastLogin).toBeNull();

      await savedUser.updateLastLogin();
      const updatedUser = await User.findById(savedUser._id);

      expect(updatedUser.lastLogin).toBeInstanceOf(Date);
      expect(updatedUser.lastLogin.getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
    });
  });

  describe('Timestamps', () => {
    it('should add createdAt and updatedAt timestamps', async () => {
      const user = new User({
        username: 'testuser',
        password: 'Test123!@#',
      });

      const savedUser = await user.save();

      expect(savedUser.createdAt).toBeInstanceOf(Date);
      expect(savedUser.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on save', async () => {
      const user = new User({
        username: 'testuser',
        password: 'Test123!@#',
      });

      const savedUser = await user.save();
      const originalUpdatedAt = savedUser.updatedAt;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 100));

      savedUser.firstName = 'Updated';
      await savedUser.save();

      expect(savedUser.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Current Location', () => {
    it('should save current location data', async () => {
      const user = new User({
        username: 'testuser',
        password: 'Test123!@#',
        currentLocation: {
          latitude: 40.7128,
          longitude: -74.0060,
          timestamp: new Date(),
          accuracy: 10,
        },
      });

      const savedUser = await user.save();

      expect(savedUser.currentLocation.latitude).toBe(40.7128);
      expect(savedUser.currentLocation.longitude).toBe(-74.0060);
      expect(savedUser.currentLocation.accuracy).toBe(10);
      expect(savedUser.currentLocation.timestamp).toBeInstanceOf(Date);
    });
  });
});

