# MeterMate Backend Tests

Quick reference guide for running and writing tests.

## Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Generate coverage report
npm run test:coverage
```

## Test Structure

```
tests/
├── setup.js                    # Global test setup (runs before all tests)
├── fixtures/                   # Test data fixtures
│   └── userFixtures.js        # User test data
├── helpers/                    # Test helper functions
│   ├── testApp.js             # Express app factory for tests
│   └── testHelpers.js         # Common test utilities
├── unit/                       # Unit tests
│   ├── controllers/           # Controller tests
│   ├── middleware/            # Middleware tests
│   ├── models/                # Model tests
│   └── utils/                 # Utility tests
└── integration/                # Integration tests
    ├── auth.routes.test.js    # Auth API tests
    └── server.test.js         # Server endpoint tests
```

## Writing Tests

### Unit Test Example

```javascript
const myController = require('../../../controllers/my.controller');
const { mockRequest, mockResponse } = require('../../helpers/testHelpers');

describe('MyController', () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();
  });

  it('should handle valid input', async () => {
    req.body = { data: 'valid' };
    await myController.myFunction(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
```

### Integration Test Example

```javascript
const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { createTestUser, generateTestToken } = require('../helpers/testHelpers');

const app = createTestApp();

describe('My API Routes', () => {
  it('should return 200 for valid request', async () => {
    const user = await createTestUser();
    const token = generateTestToken(user._id);

    const response = await request(app)
      .get('/api/my-endpoint')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
```

## Test Helpers

### Creating Test Data

```javascript
const { createTestUser, createTestAdmin } = require('../helpers/testHelpers');

// Create a regular user
const user = await createTestUser({ username: 'testuser' });

// Create an admin user
const admin = await createTestAdmin();
```

### Generating Tokens

```javascript
const { generateTestToken, getAuthHeaders } = require('../helpers/testHelpers');

// Generate a JWT token
const token = generateTestToken(userId, 'meter_reader');

// Get authentication headers
const headers = getAuthHeaders(userId, 'admin');
```

### Mocking Express Objects

```javascript
const { mockRequest, mockResponse, mockNext } = require('../helpers/testHelpers');

const req = mockRequest({ body: { data: 'test' } });
const res = mockResponse();
const next = mockNext();
```

## Test Fixtures

```javascript
const userFixtures = require('../fixtures/userFixtures');

// Use predefined test data
const userData = userFixtures.validUser;
const invalidData = userFixtures.invalidUsers.missingUsername;
```

## Coverage

Coverage reports are generated in the `coverage/` directory. Open `coverage/lcov-report/index.html` in your browser for a visual report.

Target coverage: **70%** for branches, functions, lines, and statements.

## Troubleshooting

### Tests failing with database errors
- Ensure `mongodb-memory-server` is installed
- Check that `tests/setup.js` is configured correctly

### Tests timing out
- Check for hanging promises
- Ensure database cleanup in `afterEach`

### Mock not working
- Ensure `jest.mock()` is called before imports
- Use `jest.clearAllMocks()` in `beforeEach`

For more detailed information, see [TESTING_GUIDE.md](../TESTING_GUIDE.md).

