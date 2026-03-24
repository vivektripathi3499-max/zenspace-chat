const mongoose = require('mongoose');

const pendingMediaSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  content: { type: String }, // Caption
  type: { type: String, enum: ['image', 'video'], required: true },
  mediaUrl: { type: String, required: true },
  roomId: { type: String, default: 'default' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, {
  timestamps: true
});

module.exports = mongoose.model('PendingMedia', pendingMediaSchema);

