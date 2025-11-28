const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { PORT, JWT_SECRET, BACKEND_IP, BASE_URL } = require('./config');
const userRoutes = require('./routes/user.routes');
const usersRoutes = require('./routes/users.routes');
const jobRoutes = require('./routes/job.routes');
const houseRoutes = require('./routes/houses.routes');
const uploadRoutes = require('./routes/upload.routes');
const meterReadingRoutes = require('./routes/meterReading.routes');
const messageRoutes = require('./routes/messages.routes');
const vehicleCheckRoutes = require('./routes/vehicleCheck.routes');
require('./db'); 

// Set JWT_SECRET in environment variables for jwt.sign
process.env.JWT_SECRET = JWT_SECRET;

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://192.168.1.99:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files from uploads directory
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', userRoutes);      // Auth routes (login, register, profile)
app.use('/api/users', usersRoutes);    // User management routes
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
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const servicePort = process.env.PORT || PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://192.168.1.99:3000", "http://localhost:3001"],
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
});

// Keep the server running
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 