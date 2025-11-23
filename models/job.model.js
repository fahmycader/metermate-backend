const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobType: {
    type: String,
    enum: ['electricity', 'gas', 'water'],
    required: [true, 'Job type is required'],
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    zipCode: {
      type: String,
      required: [true, 'Zip code is required'],
      trim: true,
    },
    country: {
      type: String,
      default: 'USA',
      trim: true,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
  },
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'House',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigned user is required'],
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required'],
  },
  jobId: {
    type: String,
    unique: true,
    sparse: true, // Allow null values but enforce uniqueness when present
    trim: true,
  },
  sequenceNumber: {
    type: Number,
    default: null, // null means not sequenced, numbers indicate order
  },
  completedDate: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
  },
  sup: {
    type: String,
    trim: true,
    default: '',
  },
  jt: {
    type: String,
    trim: true,
    default: '',
  },
  cust: {
    type: String,
    trim: true,
    default: '',
  },
  meterMake: {
    type: String,
    trim: true,
    default: '',
  },
  meterModel: {
    type: String,
    trim: true,
    default: '',
  },
  meterSerialNumber: {
    type: String,
    trim: true,
    default: '',
  },
  risk: { type: Boolean, default: false },
  mInspec: { type: Boolean, default: false },
  numRegisters: { type: Number, default: 1 },
  registerIds: [String],
  registerValues: [Number],
  meterReadings: {
    electric: Number,
    gas: Number,
    water: Number,
  },
  photos: [String],
  location: {
    latitude: Number,
    longitude: Number,
  },
  // Location tracking fields
  startLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date,
  },
  endLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date,
  },
  distanceTraveled: {
    type: Number,
    default: 0, // in kilometers
  },
  locationHistory: [{
    latitude: Number,
    longitude: Number,
    timestamp: Date,
  }],
  meterPhotos: [{
    meterType: String, // 'electric', 'gas', 'water'
    photoUrl: String,
    serialNumber: String,
    reading: Number,
    timestamp: Date,
  }],
}, {
  timestamps: true,
});

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
