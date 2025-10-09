const mongoose = require('mongoose');

const meterReadingSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job ID is required'],
  },
  sup: {
    type: String,
    required: [true, 'Sup is required'],
    trim: true,
  },
  jt: {
    type: String,
    required: [true, 'JT is required'],
    trim: true,
  },
  cust: {
    type: String,
    required: [true, 'Cust is required'],
    trim: true,
  },
  address1: {
    type: String,
    required: [true, 'Address1 is required'],
    trim: true,
  },
  address2: {
    type: String,
    trim: true,
  },
  address3: {
    type: String,
    trim: true,
  },
  customerRead: {
    type: String,
    enum: [
      'Yes',
      'No',
      'No access',
      'Refuse access',
      'Failed first visit',
      'Meter blocked',
      'Unable to locate the meter',
      'Unmanned',
      'Demolished',
      'Unsafe premises',
      'Meter inspected',
      'Risk assessment'
    ],
    required: [true, 'Customer Read status is required'],
  },
  noR: {
    type: String,
    trim: true,
  },
  rc: {
    type: String,
    trim: true,
  },
  makeOfMeter: {
    type: String,
    trim: true,
  },
  model: {
    type: String,
    trim: true,
  },
  regID1: {
    type: String,
    trim: true,
  },
  reg1: {
    type: String,
    trim: true,
  },
  meterReader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Meter reader is required'],
  },
  readingDate: {
    type: Date,
    default: Date.now,
  },
  location: {
    latitude: Number,
    longitude: Number,
  },
  photos: [String], // Array of photo URLs
  notes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Index for efficient querying
meterReadingSchema.index({ jobId: 1 });
meterReadingSchema.index({ meterReader: 1 });
meterReadingSchema.index({ readingDate: -1 });

const MeterReading = mongoose.model('MeterReading', meterReadingSchema);

module.exports = MeterReading;
