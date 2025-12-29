const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
  },
  firstName: {
    type: String,
    trim: true,
    default: '',
  },
  lastName: {
    type: String,
    trim: true,
    default: '',
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true, // Allows multiple null values but enforces uniqueness for non-null values
    validate: {
      validator: function(v) {
        // Only validate if email is provided
        if (!v) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please provide a valid email address'
    },
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  employeeId: {
    type: String,
    trim: true,
    default: '',
  },
  department: {
    type: String,
    trim: true,
    enum: ['admin', 'meter'],
    default: 'meter',
  },
  role: {
    type: String,
    trim: true,
    enum: ['admin', 'meter_reader'],
    default: 'meter_reader',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  jobsCompleted: {
    type: Number,
    default: 0,
  },
  weeklyPerformance: {
    type: Number,
    default: 0,
  },
  // Current location tracking
  currentLocation: {
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    timestamp: {
      type: Date,
      default: null,
    },
    accuracy: {
      type: Number,
      default: null,
    },
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to update last login
userSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  await this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User; 