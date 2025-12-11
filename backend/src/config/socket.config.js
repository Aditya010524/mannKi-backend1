import { Server } from 'socket.io';
import http from 'http';
import express from 'express';
import { ENV } from './env.js';
import { socketAuthMiddleware } from '../middleware/socket.auth.middleware.js';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Apply authentication middleware to all socket connections
io.use(socketAuthMiddleware);

// Store online users - in production, use Redis for scalability
const userSocketMap = {}; // {userId: socketId}

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.fullName} (${socket.userId})`);

  const userId = socket.userId;
  userSocketMap[userId] = socket.id;

  // Join user to their personal room for notifications
  socket.join(userId);

  // Emit updated online users list
  io.emit('getOnlineUsers', Object.keys(userSocketMap));

  // Handle typing indicators
  socket.on('typing', ({ receiverId, isTyping }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userTyping', {
        senderId: userId,
        isTyping,
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.fullName} (${socket.userId})`);
    delete userSocketMap[userId];

    // Emit updated online users list
    io.emit('getOnlineUsers', Object.keys(userSocketMap));
  });
});

export { io, app, server };
