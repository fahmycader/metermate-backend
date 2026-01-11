/**
 * Helper to create a test Express app with all routes
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('../../routes/auth.routes');
const userRoutes = require('../../routes/user.routes');
const usersRoutes = require('../../routes/users.routes');
const jobRoutes = require('../../routes/job.routes');
const messageRoutes = require('../../routes/messages.routes');

/**
 * Create a test Express app with routes configured
 * @returns {Express} Express app instance
 */
const createTestApp = () => {
  const app = express();

  // Middleware
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json());

  // Serve static files
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

  // Routes - matching server.js structure
  app.use('/api/auth', authRoutes);
  app.use('/api/auth', userRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/messages', messageRoutes);

  // Health check endpoint
  app.get('/health', (req, res) => {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      databaseName: mongoose.connection.db?.databaseName || 'unknown',
      databaseState: dbState,
    });
  });

  // Test endpoint
  app.get('/api/test', (req, res) => {
    res.status(200).json({
      message: 'API routes are working',
      routes: ['/api/auth/login', '/api/auth/register']
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Route not found',
      method: req.method,
      path: req.path,
      message: `The route ${req.method} ${req.path} was not found on this server.`,
    });
  });

  return app;
};

module.exports = { createTestApp };

