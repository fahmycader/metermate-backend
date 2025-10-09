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
require('./db'); 

// Set JWT_SECRET in environment variables for jwt.sign
process.env.JWT_SECRET = JWT_SECRET;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', userRoutes);      // Auth routes (login, register, profile)
app.use('/api/users', usersRoutes);    // User management routes
app.use('/api/jobs', jobRoutes);
app.use('/api/houses', houseRoutes);
app.use('/api/upload', uploadRoutes);   // File upload routes
app.use('/api/meter-readings', meterReadingRoutes); // Meter reading routes

app.get('/', (req, res) => {
    res.send('MeterMate Backend is running!');
});

const servicePort = process.env.PORT || PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://192.168.8.163:3000"],
    methods: ["GET", "POST"],
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

server.listen(servicePort, BACKEND_IP, () => {
  console.log(`Server running on ${BACKEND_IP}:${servicePort}`);
  console.log(`Access the API at: ${BASE_URL}`);
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