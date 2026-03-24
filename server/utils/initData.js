const Setting = require('../models/Setting');
const { defaultSettings } = require('../models/Setting');

async function initializeDefaultData() {
  try {
    // Create default settings
    for (const setting of defaultSettings) {
      await Setting.findOneAndUpdate(
        { key: setting.key },
        setting,
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
    console.log('✅ Default settings initialized');
  } catch (err) {
    console.error('❌ Init data error:', err);
  }
}

module.exports = { initializeDefaultData };

