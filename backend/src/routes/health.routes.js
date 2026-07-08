import express from 'express';
import logger from '../config/logger.config.js';
import mongoose from 'mongoose';
import { socketService } from '../services/socket.service.js';

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      socket: socketService.io ? 'Active' : 'Inactive', // ✅ Add Socket.IO status
      onlineUsers: socketService.getOnlineUsersCount(), // ✅ Add online users count
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    };

    logger.info('Health check accessed');
    return res.status(200).json(healthData);
  } catch (error) {
    logger.error('Health check failed:', error);
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

router.get('/ping', (req, res) => {
  res.status(200).json({ message: 'pong' });
});

export default router;
