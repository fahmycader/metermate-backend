const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
  },
  postcode: {
    type: String,
    required: [true, 'Postcode is required'],
    trim: true,
    uppercase: true,
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
  },
  county: {
    type: String,
    required: [true, 'County is required'],
    trim: true,
  },
  latitude: {
    type: Number,
    required: false,
  },
  longitude: {
    type: Number,
    required: false,
  },
  meterType: {
    type: String,
    enum: ['electric', 'gas', 'water', 'all'],
    default: 'all',
  },
  lastReading: {
    type: Date,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  notes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

const House = mongoose.model('House', houseSchema);

module.exports = House;
