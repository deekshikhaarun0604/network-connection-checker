const mongoose = require('mongoose');

// Schema for tracking connection check results
const connectionSchema = new mongoose.Schema({
  hostname: {
    type: String,
    required: [true, 'Hostname is required'],
    trim: true,
  },
  status: {
    type: String,
    enum: ['Success', 'Failed'],
    required: [true, 'Status is required'],
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
  },
  responseTime: {
    type: Number,
    default: null, // response time in milliseconds (null if connection could not be established)
  },
  checkedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create Mongoose model
const Connection = mongoose.model('Connection', connectionSchema);

module.exports = Connection;
