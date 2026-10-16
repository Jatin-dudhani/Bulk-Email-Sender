const mongoose = require('mongoose');

const emailListSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  listName: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  emails: [{
    type: String,
  }],
  senderEmail: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

emailListSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('EmailList', emailListSchema);