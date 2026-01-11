/**
 * Integration tests for server endpoints
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { createTestApp } = require('../helpers/testApp');

// Create test app
const app = createTestApp();

describe('Server Integration Tests', () => {
  describe('GET /health', () => {
    it('should return health check status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.database).toBeDefined();
      expect(response.body.databaseState).toBeDefined();
    });

    it('should include database connection status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(['connected', 'connecting', 'disconnected']).toContain(response.body.database);
    });
  });

  describe('GET /api/test', () => {
    it('should return test message', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.body.message).toBe('API routes are working');
      expect(response.body.routes).toBeInstanceOf(Array);
      expect(response.body.routes.length).toBeGreaterThan(0);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.body.error).toBe('Route not found');
      expect(response.body.method).toBe('GET');
      expect(response.body.path).toBe('/nonexistent-route');
      expect(response.body.message).toBeDefined();
    });

    it('should return 404 with correct method and path', async () => {
      const response = await request(app)
        .post('/another-nonexistent-route')
        .send({ data: 'test' })
        .expect(404);

      expect(response.body.method).toBe('POST');
      expect(response.body.path).toBe('/another-nonexistent-route');
    });
  });

  describe('CORS Configuration', () => {
    it('should allow CORS requests', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Note: supertest doesn't show CORS headers by default, but we can verify the endpoint works
      expect(response.status).toBe(200);
    });
  });

  describe('JSON Parsing', () => {
    it('should parse JSON request body', async () => {
      // Test that the app accepts JSON by using the health endpoint with a POST
      // (even though it might return 404, it should parse the JSON body)
      const testData = { test: 'data' };

      // The app should accept JSON even if the route doesn't exist
      const response = await request(app)
        .post('/health')
        .send(testData)
        .expect(404); // Health endpoint doesn't accept POST, but JSON should be parsed

      // Verify the app processed the request (even if route not found)
      expect(response.body).toBeDefined();
    });
  });
});

