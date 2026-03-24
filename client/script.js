// ZenSpace Real Backend Integration
// Keeps all existing UI/behavior, replaces localStorage with APIs/Socket.io

const API_BASE = '/api';
const SOCKET_SERVER = location.origin.replace(/^http/, 'ws');

let socket = null;
let isConnected = false;
const APP_STATE = {
  currentUser: null,
  userId: null,
  isAdmin: false,
  theme: 'light',
  messages: [],
  users: [],
  pendingMedia: [],
  blockedUsers: [],
  typingUsers: new Set()
};

// Socket.io client
function connectSocket() {
  const script = document.createElement('script');
  script.src = '/socket.io/socket.io.js';
  script.onload = initSocket;
  document.head.appendChild(script);
}

function initSocket() {
  socket = io(SOCKET_SERVER, { 
    withCredentials: true,
    transports: ['websocket']
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected');
    isConnected = true;
    if (APP_STATE.userId) {
      socket.emit('user_join', {
        userId: APP_STATE.userId,
        name: APP_STATE.currentUser.name,
        inviteCode: 'ZEN-2024'
      });
    }
  });

  socket.on('joined_success', (data) => {
    APP_STATE.userId = data.userId;
    localStorage.setItem('zenspace_current_user', JSON.stringify(APP_STATE.currentUser));
    showToast('Connected to server!', 'success');
  });

  socket.on('new_message', (message) => {
    APP_STATE.messages.push(message);
    renderMessages();
    scrollToBottom();
  });

  socket.on('message_sent', (message) => {
    // Update local optimistic message
    const localMsg = APP_STATE.messages.find(m => !m._id);
    if (localMsg) Object.assign(localMsg, message);
    renderMessages();
  });

  socket.on('online_count', ({ count }) => {
    document.getElementById('onlineCount').textContent = `${count} online`;
  });

  socket.on('user_typing', ({ userId }) => {
    APP_STATE.typingUsers.add(userId);
    renderTypingIndicator();
  });

  socket.on('stop_typing', ({ userId }) => {
    APP_STATE.typingUsers.delete(userId);
    renderTypingIndicator();
  });

  socket.on('admin_update', (data) => {
    showToast(data.message, data.type || 'info');
    loadAdminData();
  });

  socket.on('blocked', (data) => {
    showToast(data.message, 'error');
    // Redirect to join screen
    document.getElementById('chatScreen').classList.add('hidden');
    document.getElementById('joinScreen').classList.remove('hidden');
  });

  socket.on('error', (data) => {
    showToast(data.message, 'error');
  });
}

// Load initial data from server
async function loadInitialData() {
  try {
    const response = await fetch(`${API_BASE}/auth/init/default`);
    const data = await response.json();
    APP_STATE.messages = data.messages || [];
    APP_STATE.users = data.users || [];
    renderMessages();
    updateOnlineCount();
  } catch (err) {
    console.error('Init load error:', err);
  }
}

// Join with backend
async function handleJoin(e) {
  e.preventDefault();
  
  const username = document.getElementById('usernameInput').value.trim();
  if (!username) return showToast('Enter username', 'error');

  try {
    const response = await fetch(`${API_BASE}/auth/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: username,
        inviteCode: document.getElementById('inviteCodeInput').value,
        userId: generateUserId()
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    APP_STATE.currentUser = { name: username };
    showChatScreen();
    loadInitialData();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Send message with backend
async function sendMessage() {
  const content = document.getElementById('messageInput').value.trim();
  if (!content && !APP_STATE.selectedMedia) return;

  const data = {
    content,
    userId: APP_STATE.userId,
    userName: APP_STATE.currentUser.name,
    type: APP_STATE.selectedMedia ? APP_STATE.selectedMedia.type : 'text'
  };

  // Optimistic UI update
  const optimisticMsg = { ...data, id: 'temp_' + Date.now(), temp: true };
  APP_STATE.messages.push(optimisticMsg);

  try {
    if (APP_STATE.selectedMedia) {
      // Upload media first
      const formData = new FormData();
      formData.append('media', data.mediaFile);
      formData.append('caption', content);
      formData.append('userId', APP_STATE.userId);

      const uploadRes = await fetch(`${API_BASE}/admin/upload-media`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      showToast('Media pending approval', 'info');
      APP_STATE.messages.pop(); // Remove optimistic

    } else {
      // Text message via socket
      socket.emit('send_message', data);
    }

    document.getElementById('messageInput').value = '';
    document.getElementById('sendBtn').disabled = true;

  } catch (err) {
    showToast(err.message, 'error');
    APP_STATE.messages.pop(); // Remove failed optimistic
  }
}

// Admin login with backend
async function handleAdminLogin(e) {
  e.preventDefault();
  
  const password = document.getElementById('adminPasswordInput').value;
  try {
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    APP_STATE.isAdmin = true;
    closeAdminLogin();
    openAdminPanel();
    loadAdminData();
    showToast('Admin access granted', 'success');

  } catch (err) {
    document.getElementById('adminLoginError').classList.remove('hidden');
  }
}

// Load admin data
async function loadAdminData() {
  if (!APP_STATE.isAdmin) return;

  try {
    const [mediaRes, blockedRes] = await Promise.all([
      fetch(`${API_BASE}/admin/pending-media`),
      fetch(`${API_BASE}/admin/blocked-users`)
    ]);

    const media = await mediaRes.json();
    const blocked = await blockedRes.json();
    
    APP_STATE.pendingMedia = media;
    renderPendingMedia();
    // Update blocked users list in admin panel

  } catch (err) {
    console.error('Admin data load error:', err);
  }
}

// Approve media (admin)
async function approveMedia(mediaId) {
  try {
    const response = await fetch(`${API_BASE}/admin/media/${mediaId}/approve`, {
      method: 'POST'
    });
    if (response.ok) {
      socket.emit('admin_update', { message: 'Media approved', type: 'success' });
    }
  } catch (err) {
    showToast('Approval failed', 'error');
  }
}

// All other existing functions (renderMessages, renderUsers, etc.) remain IDENTICAL
// Just replace localStorage calls with API/socket calls above

// Existing UI functions (unchanged from original)...
function renderMessages() {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = APP_STATE.messages.map(msg => {
    const isOwn = msg.userId === APP_STATE.userId;
    // Same HTML template as original
    return `
      <div class="flex ${isOwn ? 'justify-end' : ''}">
        <div class="message-bubble ${isOwn ? 'message-own' : 'message-other'}">
          ${msg.content}
          <div class="text-xs mt-1">${new Date(msg.timestamp).toLocaleTimeString()}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ... (all other render functions, event listeners identical to original)
// Just connectSocket() at init instead of localStorage

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  connectSocket();
});

