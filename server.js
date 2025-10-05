const express = require('express');
const cors = require('cors');
const { PORT, JWT_SECRET, BACKEND_IP, BASE_URL } = require('./config');
const userRoutes = require('./routes/user.routes');
const usersRoutes = require('./routes/users.routes');
const jobRoutes = require('./routes/job.routes');
const houseRoutes = require('./routes/houses.routes');
const uploadRoutes = require('./routes/upload.routes');
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

app.get('/', (req, res) => {
    res.send('MeterMate Backend is running!');
});

const servicePort = process.env.PORT || PORT || 5000;
const server = app.listen(servicePort, BACKEND_IP, () => {
  console.log(`Server running on ${BACKEND_IP}:${servicePort}`);
  console.log(`Access the API at: ${BASE_URL}`);
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