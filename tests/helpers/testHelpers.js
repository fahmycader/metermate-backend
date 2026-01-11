/**
 * Test helper functions for common test operations
 */

const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');

/**
 * Generate a test JWT token
 * @param {string} userId - User ID to encode in token
 * @param {string} role - User role (optional)
 * @returns {string} JWT token
 */
const generateTestToken = (userId, role = 'meter_reader') => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only',
    { expiresIn: '1h' }
  );
};

/**
 * Create a test user in the database
 * @param {Object} userData - User data (optional)
 * @returns {Promise<Object>} Created user
 */
const createTestUser = async (userData = {}) => {
  const defaultUserData = {
    username: `testuser_${Date.now()}`,
    password: 'Test123!@#',
    firstName: 'Test',
    lastName: 'User',
    email: `test_${Date.now()}@example.com`,
    phone: '1234567890',
    employeeId: `EMP${Date.now()}`,
    department: 'meter',
    role: 'meter_reader',
    ...userData,
  };

  const user = await User.create(defaultUserData);
  return user;
};

/**
 * Create a test admin user
 * @returns {Promise<Object>} Created admin user
 */
const createTestAdmin = async () => {
  return createTestUser({
    username: `admin_${Date.now()}`,
    department: 'admin',
    role: 'admin',
  });
};

/**
 * Get authentication header with token
 * @param {string} token - JWT token
 * @returns {Object} Authorization header
 */
const getAuthHeader = (token) => {
  return {
    Authorization: `Bearer ${token}`,
  };
};

/**
 * Create authenticated request headers
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Object} Headers with Authorization
 */
const getAuthHeaders = (userId, role = 'meter_reader') => {
  const token = generateTestToken(userId, role);
  return getAuthHeader(token);
};

/**
 * Wait for a specified amount of time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise}
 */
const wait = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Mock Express request object
 * @param {Object} data - Request data
 * @returns {Object} Mock request object
 */
const mockRequest = (data = {}) => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...data,
  };
};

/**
 * Mock Express response object
 * @returns {Object} Mock response object
 */
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Mock Express next function
 * @returns {Function} Mock next function
 */
const mockNext = () => {
  return jest.fn();
};

module.exports = {
  generateTestToken,
  createTestUser,
  createTestAdmin,
  getAuthHeader,
  getAuthHeaders,
  wait,
  mockRequest,
  mockResponse,
  mockNext,
};

