const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
  mediaUrl: { type: String },
  status: { type: String, enum: ['approved', 'deleted'], default: 'approved' },
  roomId: { type: String, default: 'default' } // Single group chat
}, {
  timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);

