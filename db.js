const mongoose = require('mongoose');
const { MONGO_URI } = require('./config');

mongoose.set('strictQuery', true);

mongoose.connect(MONGO_URI, { })
  .then(() => console.log('✅ MongoDB connected:', MONGO_URI))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Server will continue without MongoDB. Some features may not work.');
    // Don't exit the process, allow server to start
  });

module.exports = mongoose;
