const mongoose = require('mongoose');

const blockedUserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // socketId or generated ID
  name: { type: String, required: true },
  blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String },
  blockedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('BlockedUser', blockedUserSchema);

