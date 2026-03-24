const User = require('../models/User');
const Message = require('../models/Message');
const PendingMedia = require('../models/PendingMedia');
const Setting = require('../models/Setting');
const { contentFilter } = require('../middleware/contentFilter');

let onlineUsers = new Map(); // socketId -> userId

function initializeSocket(io) {
  io.on('connection', async (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join room (single group chat)
    socket.join('default');

    // Handle user join
    socket.on('user_join', async (data) => {
      try {
        // Check if blocked
        const blocked = await BlockedUser.findOne({ userId: data.userId });
        if (blocked) {
          socket.emit('blocked', { message: 'You are blocked from this group' });
          socket.disconnect();
          return;
        }

        // Update/create user
        const user = await User.findOneAndUpdate(
          { socketId: socket.id },
          {
            socketId: socket.id,
            name: data.name,
            inviteCode: data.inviteCode,
            isOnline: true,
            lastSeen: new Date()
          },
          { upsert: true, new: true }
        );

        onlineUsers.set(socket.id, user._id);
        
        // Broadcast user joined
        socket.to('default').emit('user_joined', { userId: user._id, name: user.name });
        
        // Update online count
        io.to('default').emit('online_count', { count: onlineUsers.size });
        
        socket.emit('joined_success', { userId: user._id });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Handle message
    socket.on('send_message', async (data) => {
      try {
        // Check messaging disabled
        const messagingDisabled = await Setting.findOne({ key: 'messaging_disabled' });
        if (messagingDisabled?.value) {
          socket.emit('error', { message: 'Messaging disabled by admin' });
          return;
        }

        // Content filtering
        if (contentFilter(data.content)) {
          socket.emit('error', { message: 'Content contains blocked information' });
          return;
        }

        // Save message
        const message = new Message({
          content: data.content,
          userId: data.userId,
          userName: data.userName,
          type: data.type || 'text',
          roomId: 'default'
        });
        await message.save();

        // Broadcast to room
        socket.to('default').emit('new_message', message);
        socket.emit('message_sent', message);

      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Typing indicator
    socket.on('typing', () => {
      socket.to('default').emit('user_typing', { userId: socket.id });
    });

    socket.on('stop_typing', () => {
      socket.to('default').emit('stop_typing', { userId: socket.id });
    });

    // Admin events
    socket.on('admin_update', async (data) => {
      // Broadcast admin actions to all
      io.to('default').emit('admin_update', data);
    });

    // Disconnect
    socket.on('disconnect', async () => {
      const userId = onlineUsers.get(socket.id);
      if (userId) {
        await User.findByIdAndUpdate(userId, { 
          isOnline: false, 
          lastSeen: new Date() 
        });
        onlineUsers.delete(socket.id);
        
        socket.to('default').emit('user_left', { userId });
        io.to('default').emit('online_count', { count: onlineUsers.size });
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initializeSocket };

