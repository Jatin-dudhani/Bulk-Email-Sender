const mongoose = require('mongoose');

const emailListSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  listName: {
    type: String,
    required: true
  },
  emails: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  senderEmail: {
    type: String,
    required: true,
    verified: Boolean
  }
});

module.exports = mongoose.model('EmailList', emailListSchema);