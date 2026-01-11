/**
 * Unit tests for auth middleware
 */

const { protect } = require('../../../middleware/auth');
const User = require('../../../models/user.model');
const jwt = require('jsonwebtoken');
const {
  mockRequest,
  mockResponse,
  mockNext,
  generateTestToken,
} = require('../../helpers/testHelpers');

// Mock User model
jest.mock('../../../models/user.model');

describe('auth middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
    jest.clearAllMocks();
  });

  describe('protect middleware', () => {
    it('should call next() when valid token is provided', async () => {
      // Create mock user object (don't use createTestUser when User is mocked)
      const mockUserId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: mockUserId,
        username: 'testuser',
        email: 'test@example.com',
        role: 'meter_reader',
        toObject: () => ({ _id: mockUserId, username: 'testuser', email: 'test@example.com', role: 'meter_reader' }),
      };
      const token = generateTestToken(mockUserId);

      req.headers.authorization = `Bearer ${token}`;

      // Mock jwt.verify to return decoded token
      const decoded = { id: mockUserId };
      jest.spyOn(jwt, 'verify').mockReturnValue(decoded);

      // Mock User.findById().select() chain
      const userWithoutPassword = {
        _id: mockUserId,
        username: 'testuser',
        email: 'test@example.com',
        role: 'meter_reader',
      };
      
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithoutPassword),
      });

      await protect(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(
        token,
        process.env.JWT_SECRET
      );
      expect(User.findById).toHaveBeenCalledWith(decoded.id);
      expect(User.findById(decoded.id).select).toHaveBeenCalledWith('-password');
      expect(req.user).toEqual(userWithoutPassword);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 when no token is provided', async () => {
      req.headers.authorization = undefined;

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not authorized, no token',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header does not start with Bearer', async () => {
      req.headers.authorization = 'Invalid token';

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not authorized, no token',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      const invalidToken = 'invalid-token';
      req.headers.authorization = `Bearer ${invalidToken}`;

      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not authorized, token failed',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not found', async () => {
      const token = generateTestToken('507f1f77bcf86cd799439011');
      req.headers.authorization = `Bearer ${token}`;

      const decoded = { id: '507f1f77bcf86cd799439011' };
      jest.spyOn(jwt, 'verify').mockReturnValue(decoded);

      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not authorized, user not found',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const token = generateTestToken('507f1f77bcf86cd799439011');
      req.headers.authorization = `Bearer ${token}`;

      const decoded = { id: '507f1f77bcf86cd799439011' };
      jest.spyOn(jwt, 'verify').mockReturnValue(decoded);

      const dbError = new Error('Database connection error');
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockRejectedValue(dbError),
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not authorized, token failed',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should extract token correctly from Authorization header', async () => {
      const mockUserId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: mockUserId,
        username: 'testuser',
        email: 'test@example.com',
        role: 'meter_reader',
      };
      const token = generateTestToken(mockUserId);
      req.headers.authorization = `Bearer ${token}`;

      const decoded = { id: mockUserId };
      jest.spyOn(jwt, 'verify').mockReturnValue(decoded);
      
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await protect(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(
        token,
        expect.any(String)
      );
    });

    it('should exclude password field from user object', async () => {
      const mockUserId = '507f1f77bcf86cd799439011';
      const token = generateTestToken(mockUserId);
      req.headers.authorization = `Bearer ${token}`;

      const decoded = { id: mockUserId };
      jest.spyOn(jwt, 'verify').mockReturnValue(decoded);

      const userWithoutPassword = {
        _id: mockUserId,
        username: 'testuser',
        email: 'test@example.com',
        role: 'meter_reader',
      };
      
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithoutPassword),
      });

      await protect(req, res, next);

      expect(User.findById).toHaveBeenCalledWith(decoded.id);
      expect(User.findById(decoded.id).select).toHaveBeenCalledWith('-password');
      expect(req.user).not.toHaveProperty('password');
      expect(req.user).toEqual(userWithoutPassword);
    });
  });
});

