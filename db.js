const mongoose = require('mongoose');
const { MONGO_URI } = require('./config');

mongoose.set('strictQuery', true);

// Connection options for better reliability
const connectionOptions = {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 5, // Maintain at least 5 socket connections
};

// Mask password in logs for security
const maskedUri = MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

mongoose.connect(MONGO_URI, connectionOptions)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
    console.log('🔗 Connection URI:', maskedUri);
    console.log('🌐 Connection state:', mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('🔍 Connection URI used:', maskedUri);
    console.log('⚠️  Server will continue without MongoDB. Some features may not work.');
    console.log('💡 Check:');
    console.log('   1. MongoDB Atlas cluster is running');
    console.log('   2. IP address is whitelisted in MongoDB Atlas');
    console.log('   3. Database user credentials are correct');
    console.log('   4. Network connectivity to MongoDB Atlas');
    // Don't exit the process, allow server to start
  });

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('🔴 Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🟡 Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to app termination');
  process.exit(0);
});

module.exports = mongoose;
