# MeterMate Backend Testing Guide

This comprehensive guide covers unit testing, integration testing, and best practices for the MeterMate backend.

## Table of Contents

1. [Overview](#overview)
2. [Test Setup](#test-setup)
3. [Running Tests](#running-tests)
4. [Test Structure](#test-structure)
5. [Unit Tests](#unit-tests)
6. [Integration Tests](#integration-tests)
7. [Writing New Tests](#writing-new-tests)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Overview

The MeterMate backend uses **Jest** as the testing framework and **Supertest** for API integration testing. The test suite includes:

- **Unit Tests**: Test individual functions, methods, and utilities in isolation
- **Integration Tests**: Test complete API routes and workflows end-to-end
- **Test Coverage**: Aim for 70%+ coverage of branches, functions, lines, and statements

### Testing Dependencies

- `jest`: Test framework
- `supertest`: HTTP assertion library for API testing
- `mongodb-memory-server`: In-memory MongoDB instance for testing
- `@jest/globals`: Jest globals for better TypeScript support

## Test Setup

### Installation

All testing dependencies are already included in `package.json`. Install them with:

```bash
npm install
```

### Configuration

The test configuration is defined in `jest.config.js`:

- **Test Environment**: Node.js
- **Root Directory**: `tests/`
- **Setup File**: `tests/setup.js` (runs before all tests)
- **Test Timeout**: 30 seconds
- **Coverage Thresholds**: 70% for branches, functions, lines, and statements

### Environment Variables

Test environment variables are automatically set in `tests/setup.js`:

```javascript
NODE_ENV=test
JWT_SECRET=test-jwt-secret-for-testing-only
EMAIL_USER=test@example.com
EMAIL_PASS=test-password
CLOUDINARY_CLOUD_NAME=test-cloud
CLOUDINARY_API_KEY=test-key
CLOUDINARY_API_SECRET=test-secret
```

## Running Tests

### Run All Tests

```bash
npm test
```

This runs all tests with coverage report.

### Run Tests in Watch Mode

```bash
npm run test:watch
```

Automatically re-runs tests when files change. Great for TDD (Test-Driven Development).

### Run Only Unit Tests

```bash
npm run test:unit
```

Runs tests in the `tests/unit/` directory.

### Run Only Integration Tests

```bash
npm run test:integration
```

Runs tests in the `tests/integration/` directory.

### Generate Coverage Report

```bash
npm run test:coverage
```

Generates a detailed coverage report in the `coverage/` directory. Open `coverage/lcov-report/index.html` in your browser for a visual report.

### Run Specific Test File

```bash
npm test -- tests/unit/controllers/auth.controller.test.js
```

### Run Tests Matching a Pattern

```bash
npm test -- --testNamePattern="should login user"
```

## Test Structure

```
tests/
├── setup.js                      # Test setup and teardown
├── fixtures/                     # Test data fixtures
│   └── userFixtures.js
├── helpers/                      # Test helper functions
│   └── testHelpers.js
├── unit/                         # Unit tests
│   ├── controllers/
│   │   └── auth.controller.test.js
│   ├── middleware/
│   │   └── auth.test.js
│   ├── models/
│   │   └── user.model.test.js
│   └── utils/
│       ├── emailService.test.js
│       └── cloudinary.test.js
└── integration/                  # Integration tests
    ├── auth.routes.test.js
    └── server.test.js
```

## Unit Tests

Unit tests test individual functions, methods, and utilities in isolation, with dependencies mocked.

### Example: Utility Function Test

```javascript
// tests/unit/utils/emailService.test.js
const emailService = require('../../../utils/emailService');

describe('emailService', () => {
  describe('sendVerificationCode', () => {
    it('should send verification code email successfully', async () => {
      // Test implementation
    });
  });
});
```

### Example: Middleware Test

```javascript
// tests/unit/middleware/auth.test.js
const { protect } = require('../../../middleware/auth');

describe('auth middleware', () => {
  it('should call next() when valid token is provided', async () => {
    // Test implementation
  });
});
```

### Example: Controller Test

```javascript
// tests/unit/controllers/auth.controller.test.js
const authController = require('../../../controllers/auth.controller');

describe('auth controller', () => {
  it('should register user successfully', async () => {
    // Test implementation
  });
});
```

### Example: Model Test

```javascript
// tests/unit/models/user.model.test.js
const User = require('../../../models/user.model');

describe('User Model', () => {
  it('should create a user with valid data', async () => {
    const user = new User({ username: 'test', password: 'Test123!@#' });
    const savedUser = await user.save();
    expect(savedUser._id).toBeDefined();
  });
});
```

## Integration Tests

Integration tests test complete API routes and workflows end-to-end, using a real database connection (in-memory MongoDB) and actual HTTP requests.

### Example: API Route Test

```javascript
// tests/integration/auth.routes.test.js
const request = require('supertest');
const app = require('../../../server'); // Your Express app

describe('Authentication Routes', () => {
  it('should login user successfully', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'Test123!@#' })
      .expect(200);

    expect(response.body.token).toBeDefined();
  });
});
```

### Test Helpers

Use helper functions from `tests/helpers/testHelpers.js`:

```javascript
const {
  createTestUser,
  createTestAdmin,
  generateTestToken,
  getAuthHeaders,
} = require('../helpers/testHelpers');

// Create a test user
const user = await createTestUser({ username: 'testuser' });

// Generate a test JWT token
const token = generateTestToken(user._id);

// Get authentication headers
const headers = getAuthHeaders(user._id);
```

### Test Fixtures

Use test data from `tests/fixtures/`:

```javascript
const userFixtures = require('../fixtures/userFixtures');

const userData = userFixtures.validUser;
```

## Writing New Tests

### Step 1: Create Test File

Create a test file following the naming convention: `*.test.js` in the appropriate directory:

- Unit tests: `tests/unit/[module]/[name].test.js`
- Integration tests: `tests/integration/[name].test.js`

### Step 2: Write Test Cases

Follow the AAA pattern: **Arrange, Act, Assert**

```javascript
describe('Feature Name', () => {
  it('should do something when condition is met', async () => {
    // Arrange: Set up test data and mocks
    const userData = { username: 'test', password: 'Test123!@#' };

    // Act: Execute the function/endpoint being tested
    const result = await someFunction(userData);

    // Assert: Verify the results
    expect(result).toBeDefined();
    expect(result.username).toBe('test');
  });
});
```

### Step 3: Use Mocks for External Dependencies

Mock external services and dependencies:

```javascript
// Mock email service
jest.mock('../../../utils/emailService', () => ({
  sendVerificationCode: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'test-id',
  }),
}));
```

### Step 4: Clean Up After Tests

```javascript
afterEach(async () => {
  // Clean up database
  await User.deleteMany({});
  await EmailVerification.deleteMany({});
  
  // Clear mocks
  jest.clearAllMocks();
});
```

### Example: Complete Test File

```javascript
/**
 * Unit tests for MyController
 */
const myController = require('../../../controllers/my.controller');
const { mockRequest, mockResponse } = require('../../helpers/testHelpers');

describe('MyController', () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();
  });

  describe('myFunction', () => {
    it('should handle valid input', async () => {
      req.body = { data: 'valid' };
      
      await myController.myFunction(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('should handle invalid input', async () => {
      req.body = { data: null };
      
      await myController.myFunction(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid data' })
      );
    });
  });
});
```

## Best Practices

### 1. Test Isolation

- Each test should be independent and not rely on other tests
- Clean up database and mocks after each test
- Use `beforeEach` and `afterEach` for setup and teardown

### 2. Descriptive Test Names

Use clear, descriptive test names that explain what is being tested:

```javascript
// Good
it('should return 400 when email is missing', async () => { });

// Bad
it('should work', async () => { });
```

### 3. Test One Thing at a Time

Each test should verify one specific behavior:

```javascript
// Good
it('should return 400 when username is missing', async () => { });
it('should return 400 when password is missing', async () => { });

// Bad
it('should validate input', async () => {
  // Testing multiple things
});
```

### 4. Use Arrange-Act-Assert Pattern

```javascript
it('should do something', async () => {
  // Arrange: Set up test data
  const user = await createTestUser();
  
  // Act: Execute the function
  const result = await someFunction(user);
  
  // Assert: Verify results
  expect(result).toBeDefined();
});
```

### 5. Mock External Dependencies

Mock external services, APIs, and database calls in unit tests:

```javascript
jest.mock('../../../utils/emailService');
jest.mock('../../../models/user.model');
```

### 6. Test Edge Cases

Test both happy paths and error cases:

- Valid inputs
- Invalid inputs
- Missing inputs
- Boundary conditions
- Error handling

### 7. Use Test Fixtures

Use fixtures for reusable test data:

```javascript
const userFixtures = require('../fixtures/userFixtures');
const userData = userFixtures.validUser;
```

### 8. Keep Tests Fast

- Use in-memory database for tests
- Mock external API calls
- Avoid unnecessary waits and timeouts

### 9. Maintain Test Coverage

Aim for at least 70% coverage:
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

### 10. Clean Up

Always clean up after tests:

```javascript
afterEach(async () => {
  await User.deleteMany({});
  jest.clearAllMocks();
});
```

## Troubleshooting

### Tests Failing with Database Connection Errors

**Problem**: Tests fail with MongoDB connection errors.

**Solution**: Ensure `mongodb-memory-server` is installed and the setup file is configured correctly. The in-memory server should start automatically in `tests/setup.js`.

### Tests Timing Out

**Problem**: Tests exceed the 30-second timeout.

**Solution**: 
- Check for hanging promises or unclosed connections
- Increase timeout for specific tests: `jest.setTimeout(60000);`
- Ensure database cleanup is happening

### Mock Not Working

**Problem**: Mocked functions are not being called or returning unexpected values.

**Solution**:
- Ensure `jest.mock()` is called before imports
- Clear mocks between tests: `jest.clearAllMocks()`
- Verify mock implementation matches the actual function signature

### Coverage Not Generating

**Problem**: Coverage report is not generated or incomplete.

**Solution**:
- Ensure files are not ignored in `jest.config.js`
- Check `collectCoverageFrom` configuration
- Verify test files are actually running

### Port Already in Use

**Problem**: Integration tests fail with "Port already in use" error.

**Solution**:
- Ensure tests are using different ports
- Kill any processes using the test port: `lsof -ti:3001 | xargs kill -9`
- Use dynamic port assignment in tests

### Environment Variables Not Set

**Problem**: Tests fail because environment variables are missing.

**Solution**:
- Check `tests/setup.js` for environment variable setup
- Ensure test environment variables are set before tests run
- Use `.env.test` file if needed (load it in setup.js)

## Continuous Integration

For CI/CD pipelines, add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test:ci": "jest --coverage --ci --maxWorkers=2"
  }
}
```

Run tests in CI:

```bash
npm run test:ci
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Summary

- **Unit Tests**: Test individual functions in isolation with mocks
- **Integration Tests**: Test complete API workflows end-to-end
- **Coverage**: Aim for 70%+ coverage across all metrics
- **Best Practices**: Follow AAA pattern, test isolation, descriptive names
- **Troubleshooting**: Common issues and solutions are documented above

Happy Testing! 🚀

