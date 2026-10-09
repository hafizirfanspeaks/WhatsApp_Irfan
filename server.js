// // Backend/server.js
// const express = require('express');
// const http = require('http');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const socketIo = require('socket.io');
// const dns = require('dns');
// dns.setServers(['1.1.1.1', '1.0.0.1']);

// dotenv.config();

// const authRoutes = require('./routes/authRoutes');
// const userRoutes = require('./routes/userRoutes');
// const messageRoutes = require('./routes/messageRoutes');

// const app = express();
// const server = http.createServer(app);

// const io = socketIo(server, {
//   cors: {
//     origin: process.env.CLIENT_URL || 'http://localhost:5173',
//     methods: ['GET', 'POST', 'PUT'],
//     credentials: true,
//   },
// });

// // ✅ Socket.IO instance ko Express app ke sath attach karein
// app.set('io', io);

// app.use(
//   cors({
//     origin: process.env.CLIENT_URL || 'http://localhost:5173',
//     credentials: true,
//   })
// );
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGO_URI);
//     console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.error(`❌ MongoDB Connection Error: ${error.message}`);
//     process.exit(1);
//   }
// };
// connectDB();

// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/messages', messageRoutes);

// app.get('/', (req, res) => {
//   res.status(200).json({ message: 'WhatsApp Clone API is running professionally' });
// });

// // ================= SOCKET.IO LOGIC =================
// let onlineUsers = new Map(); // userId -> socketId

// io.on('connection', (socket) => {
//   console.log(`🔌 User connected: ${socket.id}`);

//   const userId = socket.handshake.query.userId;
//   if (userId) {
//     onlineUsers.set(userId, socket.id);
//     socket.join(userId);
//     console.log(`🟢 User ${userId} joined room`);
//   }

//   io.emit('getOnlineUsers', Array.from(onlineUsers.keys()));

//   // ✅ Typing Event
//   socket.on('typing', ({ senderId, receiverId }) => {
//     try {
//       if (!senderId || !receiverId) return;
//       io.to(receiverId).emit('userTyping', { senderId });
//     } catch (error) {
//       console.error('Socket typing Error:', error.message);
//     }
//   });

//   // ✅ Stop Typing Event
//   socket.on('stopTyping', ({ senderId, receiverId }) => {
//     try {
//       if (!senderId || !receiverId) return;
//       io.to(receiverId).emit('userStopTyping', { senderId });
//     } catch (error) {
//       console.error('Socket stopTyping Error:', error.message);
//     }
//   });

//   // ✅ Message Read Event (Blue Tick)
//   socket.on('messageRead', ({ senderId, receiverId }) => {
//     try {
//       if (!senderId || !receiverId) throw new Error('Invalid read payload');
//       const senderSocketId = onlineUsers.get(senderId);
//       if (senderSocketId) {
//         io.to(senderSocketId).emit('messagesMarkedAsRead', {
//           by: receiverId,
//         });
//       }
//     } catch (error) {
//       console.error('Socket messageRead Error:', error.message);
//     }
//   });

//   // ✅ Disconnect
//   socket.on('disconnect', () => {
//     if (userId) {
//       onlineUsers.delete(userId);
//     }
//     io.emit('getOnlineUsers', Array.from(onlineUsers.keys()));
//     console.log(`🔴 User disconnected: ${socket.id}`);
//   });
// });

// // ================= GLOBAL ERROR HANDLING =================
// app.use((req, res, next) => {
//   res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
// });

// app.use((err, req, res, next) => {
//   console.error('🔥 Server Error:', err.stack);
//   res.status(err.statusCode || 500).json({
//     success: false,
//     message: err.message || 'Internal Server Error',
//     stack: process.env.NODE_ENV === 'production' ? null : err.stack,
//   });
// });

// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => {
//   console.log(
//     `🚀 Server running in ${process.env.NODE_ENV === 'production' ? 'production' : 'development'} mode on port ${PORT}`
//   );
// });


// Backend/server.js
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const socketIo = require('socket.io');
const dns = require('dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');

const app = express();
const server = http.createServer(app);

// ✅ Allowed origins array (local + production)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean); // undefined values hata dega

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// ✅ Socket.IO instance ko Express app ke sath attach karein
app.set('io', io);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ✅ Vercel 4.5MB limit ko exceed na karne ke liye 4mb set karein
// (Express limit zyada rakhenge toh Vercel khud reject kar dega aur confusing error dega)
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// ================= DATABASE CONNECTION =================
let isConnected = false;

const connectDB = async () => {
  // ✅ Ek baar connect hone ke baad dobara connect na karein
  if (isConnected) {
    console.log('✅ Using existing MongoDB connection');
    return;
  }
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
    });
    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // ✅ process.exit(1) HATA DIYA - yeh Vercel serverless ko crash karta tha
    throw new Error('Database connection failed');
  }
};

// ✅ Middleware jo har request se pehle DB connect karega (Vercel serverless ke liye zaroori)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed. Please try again.',
    });
  }
});

// ================= ROUTES =================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ message: 'Connectly API is running professionally' });
});

// ================= SOCKET.IO LOGIC =================
let onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  const userId = socket.handshake.query.userId;
  if (userId) {
    onlineUsers.set(userId, socket.id);
    socket.join(userId);
    console.log(`🟢 User ${userId} joined room`);
  }

  io.emit('getOnlineUsers', Array.from(onlineUsers.keys()));

  // ✅ Typing Event
  socket.on('typing', ({ senderId, receiverId }) => {
    try {
      if (!senderId || !receiverId) return;
      io.to(receiverId).emit('userTyping', { senderId });
    } catch (error) {
      console.error('Socket typing Error:', error.message);
    }
  });

  // ✅ Stop Typing Event
  socket.on('stopTyping', ({ senderId, receiverId }) => {
    try {
      if (!senderId || !receiverId) return;
      io.to(receiverId).emit('userStopTyping', { senderId });
    } catch (error) {
      console.error('Socket stopTyping Error:', error.message);
    }
  });

  // ✅ Message Read Event (Blue Tick)
  socket.on('messageRead', ({ senderId, receiverId }) => {
    try {
      if (!senderId || !receiverId) throw new Error('Invalid read payload');
      const senderSocketId = onlineUsers.get(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('messagesMarkedAsRead', {
          by: receiverId,
        });
      }
    } catch (error) {
      console.error('Socket messageRead Error:', error.message);
    }
  });

  // ✅ Disconnect
  socket.on('disconnect', () => {
    if (userId) {
      onlineUsers.delete(userId);
    }
    io.emit('getOnlineUsers', Array.from(onlineUsers.keys()));
    console.log(`🔴 User disconnected: ${socket.id}`);
  });
});

// ================= GLOBAL ERROR HANDLING =================
app.use((req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// ================= SERVER LISTEN =================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(
    `🚀 Server running in ${
      process.env.NODE_ENV === 'production' ? 'production' : 'development'
    } mode on port ${PORT}`
  );
});

// ✅ Vercel serverless ke liye export zaroori hai
module.exports = app;