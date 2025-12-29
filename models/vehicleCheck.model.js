const mongoose = require('mongoose');

const vehicleCheckSchema = new mongoose.Schema({
  operative: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Operative is required'],
  },
  checkDate: {
    type: Date,
    default: Date.now,
    required: true,
  },
  tyres: {
    type: String,
    enum: ['good', 'fair', 'poor', 'needs_replacement'],
    required: [true, 'Tyre condition is required'],
  },
  hazardLights: {
    type: String,
    enum: ['working', 'not_working', 'partial'],
    required: [true, 'Hazard lights status is required'],
  },
  brakeLights: {
    type: String,
    enum: ['working', 'not_working', 'partial'],
    required: [true, 'Brake lights status is required'],
  },
  bodyCondition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor', 'damaged'],
    required: [true, 'Body condition is required'],
  },
  engineOil: {
    type: String,
    enum: ['good', 'low', 'needs_change', 'critical'],
    required: [true, 'Engine oil status is required'],
  },
  dashboardLights: {
    type: String,
    enum: ['none', 'warning', 'error', 'multiple'],
    required: [true, 'Dashboard lights status is required'],
  },
  comments: {
    type: String,
    trim: true,
    default: '',
  },
  shiftStartTime: {
    type: Date,
    default: Date.now,
  },
  shiftEndTime: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
vehicleCheckSchema.index({ operative: 1, checkDate: -1 });

module.exports = mongoose.model('VehicleCheck', vehicleCheckSchema);

