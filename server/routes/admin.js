const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const User = require('../models/User');
const Message = require('../models/Message');
const PendingMedia = require('../models/PendingMedia');
const BlockedUser = require('../models/BlockedUser');
const Setting = require('../models/Setting');
const { contentFilter } = require('../middleware/contentFilter');

const router = express.Router();

// Multer setup for media uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/pending';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos allowed'), false);
    }
  }
});

// Admin login (session-based)
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Check admin session
router.get('/check', (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

// Block user
router.post('/block-user', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin required' });

  const { userId, name, reason } = req.body;
  try {
    const blockedUser = new BlockedUser({ userId, name, reason });
    await blockedUser.save();
    
    // Remove from online users
    await User.findOneAndUpdate({ socketId: userId }, { isOnline: false });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle messaging
router.post('/toggle-messaging', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin required' });

  const { disabled } = req.body;
  try {
    await Setting.findOneAndUpdate(
      { key: 'messaging_disabled' },
      { value: disabled },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve/reject media
router.post('/media/:id/approve', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin required' });

  try {
    const media = await PendingMedia.findById(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    media.status = 'approved';
    await media.save();

    // Move file to approved
    const approvedPath = media.mediaUrl.replace('pending', 'approved');
    fs.renameSync(media.mediaUrl, approvedPath);
    media.mediaUrl = approvedPath;
    await media.save();

    // Add as message
    const message = new Message({
      content: media.content || 'Shared media',
      userId: media.userId,
      userName: media.userName,
      type: media.type,
      mediaUrl: media.mediaUrl,
      roomId: 'default'
    });
    await message.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/media/:id/reject', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin required' });

  try {
    const media = await PendingMedia.findById(req.params.id);
    if (media) {
      // Delete file
      fs.unlinkSync(media.mediaUrl);
      await media.deleteOne();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload media (pending)
router.post('/upload-media', upload.single('media'), async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check messaging disabled
    const messagingDisabled = await Setting.findOne({ key: 'messaging_disabled' });
    if (messagingDisabled?.value) {
      return res.status(403).json({ error: 'Messaging disabled' });
    }

    // Save pending media
    const pendingMedia = new PendingMedia({
      userId: user._id,
      userName: user.name,
      content: req.body.caption || '',
      type: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
      mediaUrl: req.file.path
    });
    await pendingMedia.save();

    res.json({ 
      success: true, 
      mediaId: pendingMedia._id,
      message: 'Media uploaded for admin approval'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete message
router.delete('/messages/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin required' });

  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending media
router.get('/pending-media', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin required' });

  try {
    const media = await PendingMedia.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('userId', 'name')
      .lean();
    res.json(media);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get blocked users
router.get('/blocked-users', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin required' });

  try {
    const blocked = await BlockedUser.find().sort({ blockedAt: -1 }).lean();
    res.json(blocked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

