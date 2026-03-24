const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  roomId: { type: String, default: 'default' },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Ensure default settings
const defaultSettings = [
  { key: 'messaging_disabled', value: false },
  { key: 'invite_code', value: 'ZEN-2024' }
];

module.exports = mongoose.model('Setting', settingSchema);
module.exports.defaultSettings = defaultSettings;

