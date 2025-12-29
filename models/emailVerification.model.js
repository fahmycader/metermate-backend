const mongoose = require('mongoose');

const emailVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['registration', 'password_reset'],
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    index: { expireAfterSeconds: 0 }, // Auto-delete expired documents
  },
  verified: {
    type: Boolean,
    default: false,
  },
  attempts: {
    type: Number,
    default: 0,
    max: 5, // Max 5 verification attempts
  },
}, {
  timestamps: true,
});

// Index for faster lookups
emailVerificationSchema.index({ email: 1, type: 1, verified: 1 });
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('EmailVerification', emailVerificationSchema);

