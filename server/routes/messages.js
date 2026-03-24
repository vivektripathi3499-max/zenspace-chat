const express = require('express');
const Message = require('../models/Message');
const Setting = require('../models/Setting');
const { contentFilter } = require('../middleware/contentFilter');
const router = express.Router();

// GET recent messages
router.get('/', async (req, res) => {
  try {
    const messages = await Message.find({ roomId: 'default' })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name')
      .lean();
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new message
router.post('/', async (req, res) => {
  try {
    const { content, userId, userName, type } = req.body;

    // Check messaging disabled
    const setting = await Setting.findOne({ key: 'messaging_disabled' });
    if (setting?.value) {
      return res.status(403).json({ error: 'Messaging disabled by admin' });
    }

    // Content filter
    if (contentFilter(content)) {
      return res.status(400).json({ error: 'Content blocked by filter' });
    }

    const message = new Message({
      content,
      userId,
      userName,
      type: type || 'text',
      roomId: 'default'
    });
    await message.save();

    const populated = await Message.findById(message._id).populate('userId', 'name').lean();
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
