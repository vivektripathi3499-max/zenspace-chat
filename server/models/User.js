const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  socketId: { type: String, default: null },
  name: { type: String, required: true, maxlength: 30 },
  inviteCode: { type: String, required: true },
  isOnline: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);

