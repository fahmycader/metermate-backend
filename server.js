const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('./db');
const { PORT, JWT_SECRET, BACKEND_IP, BASE_URL } = require('./config');
const userRoutes = require('./routes/user.routes');
const usersRoutes = require('./routes/users.routes');
const jobRoutes = require('./routes/job.routes');
const houseRoutes = require('./routes/houses.routes');
const uploadRoutes = require('./routes/upload.routes');
const meterReadingRoutes = require('./routes/meterReading.routes');
const messageRoutes = require('./routes/messages.routes');
const vehicleCheckRoutes = require('./routes/vehicleCheck.routes'); 

// Set JWT_SECRET in environment variables for jwt.sign
process.env.JWT_SECRET = JWT_SECRET;

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://192.168.1.99:3001', 'http://127.0.0.1:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files from uploads directory
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
console.log('Registering routes...');
app.use('/api/auth', userRoutes);      // Auth routes (login, register, profile)
console.log('Auth routes registered at /api/auth');
app.use('/api/users', usersRoutes);    // User management routes
console.log('Users routes registered at /api/users (includes /api/users/meter)');
app.use('/api/jobs', jobRoutes);
app.use('/api/houses', houseRoutes);
app.use('/api/upload', uploadRoutes);   // File upload routes
app.use('/api/meter-readings', meterReadingRoutes); // Meter reading routes
app.use('/api/messages', messageRoutes);
app.use('/api/vehicle-checks', vehicleCheckRoutes); // Vehicle check routes

app.get('/', (req, res) => {
    res.send('MeterMate Backend is running!');
});

// Health check endpoint for connectivity testing
app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: dbStatus,
        databaseName: mongoose.connection.db?.databaseName || 'unknown',
        databaseState: dbState, // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
        backend: {
            ip: BACKEND_IP,
            port: PORT,
            baseUrl: BASE_URL
        }
    });
});

// Debug route to test API routing
app.get('/api/test', (req, res) => {
    res.status(200).json({ message: 'API routes are working', routes: ['/api/auth/login', '/api/auth/register'] });
});

// Debug: Log all incoming requests (placed after routes to see what's being requested)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// 404 handler for unmatched routes
app.use((req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ 
        error: 'Route not found', 
        method: req.method, 
        path: req.path,
        message: `The route ${req.method} ${req.path} was not found on this server.`,
        availableRoutes: [
            'POST /api/auth/login',
            'POST /api/auth/register',
            'GET /api/auth/profile',
            'GET /health',
            'GET /api/test'
        ]
    });
});

const servicePort = process.env.PORT || PORT || 3001;
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://192.168.1.99:3001", "http://127.0.0.1:3001"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected via WebSocket`);
  
  // Join user to their personal room
  socket.join(`user_${socket.userId}`);
  
  // Join admin users to admin room
  if (socket.userRole === 'admin') {
    socket.join('admin_room');
  }
  
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected from WebSocket`);
  });
});

// Make io available globally for emitting events
global.io = io;

// Listen on 0.0.0.0 to accept connections from any network interface
server.listen(servicePort, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${servicePort}`);
  console.log(`Access the API at: ${BASE_URL}`);
  console.log(`Local access: http://localhost:${servicePort}`);
  console.log(`Network access: http://${BACKEND_IP}:${servicePort}`);
  console.log(`WebSocket server running on ws://${BACKEND_IP}:${servicePort}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${servicePort} is already in use!`);
    console.error(`   Another process is using port ${servicePort}.`);
    console.error(`   To fix this, run: lsof -ti:${servicePort} | xargs kill -9`);
    console.error(`   Or find the process using: lsof -i:${servicePort}`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

// Keep the server running
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 