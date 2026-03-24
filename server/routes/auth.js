const express = require('express');
const User = require('../models/User');
const BlockedUser = require('../models/BlockedUser');
const Setting = require('../models/Setting');
const { contentFilter } = require('../middleware/contentFilter');

const router = express.Router();

// Default invite code
const DEFAULT_INVITE = 'ZEN-2024';

// Join group
router.post('/join', async (req, res) => {
  try {
    const { name, inviteCode, userId } = req.body;

    if (!name || name.length > 30) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    // Check invite code
    const inviteSetting = await Setting.findOne({ key: 'invite_code' });
    const validInvite = inviteSetting?.value || DEFAULT_INVITE;
    if (inviteCode !== validInvite) {
      return res.status(400).json({ error: 'Invalid invite code' });
    }

    // Check blocked
    const blocked = await BlockedUser.findOne({ userId });
    if (blocked) {
      return res.status(403).json({ error: 'You are blocked from this group' });
    }

    // Save user (will be updated with socketId on connect)
    const user = await User.findOneAndUpdate(
      { name, inviteCode },
      { name, inviteCode, isOnline: true },
      { upsert: true, new: true }
    );

    res.json({ 
      success: true, 
      userId: user._id.toString(),
      message: `Welcome to ZenSpace, ${name}!`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get initial data (messages, users, online count)
router.get('/init/:roomId?', async (req, res) => {
  try {
    const messages = await Message.find({ roomId: 'default' })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name')
      .lean();

    const users = await User.find({ isOnline: true }).select('name isAdmin').lean();
    
    res.json({
      messages: messages.reverse(),
      users,
      settings: await Setting.find({}).lean()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

