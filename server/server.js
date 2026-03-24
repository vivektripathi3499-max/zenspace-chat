const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// ✅ Socket setup
const io = socketIo(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json());

// ✅ MongoDB connect (Railway ENV)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ Mongo error:", err));

// ✅ Message Schema
const MessageSchema = new mongoose.Schema({
  content: String,
  userId: String,
  userName: String,
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);

// ✅ POST message
app.post('/api/messages', async (req, res) => {
  try {
    const { content, userId, userName } = req.body;

    const msg = new Message({ content, userId, userName });
    await msg.save();

    // Emit to all users
    io.emit("receiveMessage", msg);

    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ GET messages
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Socket connection
io.on("connection", (socket) => {
  console.log("👤 User connected");

  socket.on("disconnect", () => {
    console.log("❌ User disconnected");
  });
});

// ✅ Default route
app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});