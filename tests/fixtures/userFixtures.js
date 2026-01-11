/**
 * User fixtures for testing
 */

module.exports = {
  validUser: {
    username: 'testuser',
    password: 'Test123!@#',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    phone: '1234567890',
    employeeId: 'EMP001',
    department: 'meter',
    role: 'meter_reader',
  },

  validAdmin: {
    username: 'adminuser',
    password: 'Admin123!@#',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    phone: '0987654321',
    employeeId: 'ADMIN001',
    department: 'admin',
    role: 'admin',
  },

  invalidUsers: {
    missingUsername: {
      password: 'Test123!@#',
      email: 'test@example.com',
    },
    missingPassword: {
      username: 'testuser',
      email: 'test@example.com',
    },
    invalidEmail: {
      username: 'testuser',
      password: 'Test123!@#',
      email: 'invalid-email',
    },
    weakPassword: {
      username: 'testuser',
      password: '123', // Too short
      email: 'test@example.com',
    },
    passwordTooLong: {
      username: 'testuser',
      password: 'A1!'.repeat(20), // Too long
      email: 'test@example.com',
    },
    passwordNoUppercase: {
      username: 'testuser',
      password: 'test123!@#', // No uppercase
      email: 'test@example.com',
    },
    passwordNoLowercase: {
      username: 'testuser',
      password: 'TEST123!@#', // No lowercase
      email: 'test@example.com',
    },
    passwordNoNumber: {
      username: 'testuser',
      password: 'TestPass!@#', // No number
      email: 'test@example.com',
    },
    passwordNoSymbol: {
      username: 'testuser',
      password: 'Test12345', // No symbol
      email: 'test@example.com',
    },
  },

  loginCredentials: {
    valid: {
      username: 'testuser',
      password: 'Test123!@#',
    },
    invalidUsername: {
      username: 'nonexistent',
      password: 'Test123!@#',
    },
    invalidPassword: {
      username: 'testuser',
      password: 'WrongPass123!@#',
    },
    missingUsername: {
      password: 'Test123!@#',
    },
    missingPassword: {
      username: 'testuser',
    },
  },
};

