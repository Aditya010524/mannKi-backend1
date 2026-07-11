// socket/socket.service.js
import { Server } from 'socket.io';
import http from 'http';
import app from '../app.js'; // ✅ use your main app here
import configEnv from '../config/env.config.js';
import { socketAuthMiddleware } from '../middleware/socket.auth.middleware.js';
import Follow from '../models/follow.model.js';
import User from '../models/user.model.js';

const server = http.createServer(app); // ✅ attach socket.io to this app

// ✅ OPTIMIZED Socket.IO configuration for better scalability
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins (or restrict to specific domains)
    credentials: true,
  },
  // ✅ Support both websocket and polling for better compatibility
  // Mobile (React Native) sometimes needs polling as fallback
  transports: ['websocket', 'polling'],
  
  // ✅ Tuned connection settings
  pingTimeout: 60000, // Increased from 30s to reduce false disconnections
  pingInterval: 25000, // Increased from 15s to reduce overhead
  
  // ✅ Performance optimizations
  maxHttpBufferSize: 1e6, // 1MB buffer (prevent large payloads)
  allowEIO3: false, // Only allow EIO4 (latest version)
  
  // ✅ Connection queue settings
  connectTimeout: 45000,
});

// middleware + socket logic as before
io.use(socketAuthMiddleware);

// Keep mapping for direct socket id lookups (helpful for one-to-one messaging)
const userSocketMap = {};
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

/**
 * Helper: emit a notification payload to a user's personal room
 * Use this from notification.service.js (or any place that imports this module).
 * payload should be the client-friendly notification object.
 */
export function emitNotification(userId, payload) {
  try {
    if (!userId) return;
    io.to(`user:${userId}`).emit('notification', payload);
  } catch (err) {
    console.error('emitNotification error', err);
  }
}

/**
 * Helper: notify client that a notification was removed (e.g., on unlike)
 */
export function emitNotificationRemoved(userId, payload) {
  try {
    if (!userId) return;
    io.to(`user:${userId}`).emit('notification_removed', payload);
  } catch (err) {
    console.error('emitNotificationRemoved error', err);
  }
}

/**
 * Helper: emit unread count update to user
 */
export function emitUnreadCount(userId, count) {
  try {
    if (!userId) return;
    io.to(`user:${userId}`).emit('unread_count', { unread: count });
  } catch (err) {
    console.error('emitUnreadCount error', err);
  }
}

/**
 * ✅ Get online users that current user can message (following/followers)
 * ✅ OPTIMIZED: Use lean() and select only needed fields
 */
export async function getOnlineContactsForUser(userId) {
  try {
    // Get users that current user follows or is followed by
    const [following, followers] = await Promise.all([
      Follow.find({ follower: userId })
        .populate('following', 'username displayName avatar isVerified')
        .lean(), // ✅ Use lean() for read-only query optimization
      Follow.find({ following: userId })
        .populate('follower', 'username displayName avatar isVerified')
        .lean(), // ✅ Use lean() for read-only query optimization
    ]);

    const contactIds = new Set([
      ...following.map((f) => f.following._id.toString()),
      ...followers.map((f) => f.follower._id.toString()),
    ]);

    // Filter online contacts
    const onlineContacts = Array.from(contactIds)
      .filter((contactId) => userSocketMap[contactId])
      .map((contactId) => {
        const contact = [
          ...following.map((f) => f.following),
          ...followers.map((f) => f.follower),
        ].find((user) => user._id.toString() === contactId);

        return {
          _id: contactId,
          username: contact.username,
          displayName: contact.displayName,
          avatar: contact.avatar,
          isVerified: contact.isVerified,
          isOnline: true,
        };
      });

    return onlineContacts;
  } catch (error) {
    console.error('Error getting online contacts:', error);
    return [];
  }
}

io.on('connection', (socket) => {
  // Depending on your socketAuthMiddleware, it may set socket.user and socket.userId.
  // Use socket.userId if middleware sets it; otherwise fallback to socket.user._id.
  const userId = socket.userId || (socket.user && socket.user._id && socket.user._id.toString());
  console.log('✅ User connected:', (socket.user && (socket.user.displayName || socket.user.username)) || userId);

  if (!userId) {
    // If auth middleware didn't attach user, disconnect
    console.warn('Socket connected without userId, disconnecting');
    socket.disconnect(true);
    return;
  }

  // Save socket id mapping and join per-user room
  userSocketMap[userId] = socket.id;
  socket.join(`user:${userId}`);

  // ✅ Send online contacts to newly connected user
  getOnlineContactsForUser(userId).then((onlineContacts) => {
    console.log(`✅ Emitting onlineContacts to user ${userId}:`, onlineContacts.length);
    socket.emit('onlineContacts', onlineContacts);
  }).catch((err) => {
    console.error(`❌ Error getting online contacts for ${userId}:`, err);
  });

  // ✅ Notify contacts that this user is now online
  socket.broadcast.emit('userOnline', {
    userId: userId,
    user: {
      _id: socket.user?._id || userId,
      username: socket.user?.username,
      displayName: socket.user?.displayName,
      avatar: socket.user?.avatar,
      isVerified: socket.user?.isVerified,
    },
  });

  // ✅ Handle typing indicators
  socket.on('typing', (data) => {
    const { receiverId } = data;
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userTyping', {
        userId: userId,
        user: socket.user,
      });
    }
  });

  socket.on('stopTyping', (data) => {
    const { receiverId } = data;
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userStoppedTyping', {
        userId: userId,
      });
    }
  });

  // ✅ Handle incoming messages from client (real-time message delivery)
  socket.on('send_message', async (data) => {
    const { recipientId, content } = data;
    console.log(`📨 Received send_message event from ${userId} to ${recipientId}`);
    
    try {
      const recipientSocketId = getReceiverSocketId(recipientId);
      
      if (recipientSocketId) {
        // Recipient is online, emit message immediately
        console.log(`✅ Recipient online (${recipientSocketId}), emitting newMessage`);
        io.to(recipientSocketId).emit('newMessage', {
          content,
          senderId: userId,
          receiverId: recipientId,
          timestamp: new Date(),
        });
        
        // Acknowledge to sender that message was delivered
        socket.emit('messageDelivered', {
          content,
          status: 'delivered',
        });
      } else {
        console.log(`⚠️ Recipient offline (${recipientId}), message will be saved to DB`);
        // Recipient is offline - message controller will save to DB
        socket.emit('messageQueued', {
          content,
          status: 'queued',
        });
      }
    } catch (error) {
      console.error('Error handling send_message:', error);
      socket.emit('messageSendError', {
        error: error.message,
      });
    }
  });

  // Handle message read receipts
  socket.on('markAsRead', async (data) => {
    const { messageIds, senderId } = data;
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit('messagesRead', {
        messageIds,
        readBy: userId,
        readAt: new Date(),
      });
    }
  });

  // Optional: client informs server it marked notifications as read
  socket.on('notifications:mark-read', async (data) => {
    // payload: { ids: [..] } — if you want server to update DB directly here,
    // import notification service and call markAsRead. Avoid circular imports.
    // Example (if you prefer): await notificationService.markAsRead(userId, data.ids)
    // For now, we simply emit unread_count update hook (services should handle DB update).
    // This listener is a placeholder you can wire to notification service later.
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', (socket.user && (socket.user.displayName || socket.user.username)) || userId);
    delete userSocketMap[userId];

    // Notify all users that this user went offline
    socket.broadcast.emit('userOffline', {
      userId: userId,
    });
  });
});

export { io, app, server };

export const socketService = {
  io,
  getReceiverSocketId,
  emitNotification,
  emitNotificationRemoved,
  emitUnreadCount,
  getOnlineContactsForUser,
  getOnlineUsersCount: () => Object.keys(userSocketMap).length,
};
