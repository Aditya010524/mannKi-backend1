import { connectDB } from './config/database.config.js';
import configEnv from './config/env.config.js';
import logger from './config/logger.config.js';
import { server, io } from './services/socket.service.js'; // ✅ import io too

const PORT = configEnv.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log('🚀 =======================================');
      console.log('🌟 Twitter Chat Server Started');
      console.log('🚀 =======================================');
      console.log(`🌍 Environment: ${configEnv.NODE_ENV}`);
      console.log(`🔗 Server: http://localhost:${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}${configEnv.API_PREFIX}`);
      console.log('🔌 Real-time Chat: ACTIVE');
      console.log('🚀 =======================================');
      logger.info(`Server with Socket.IO started on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// ✅ Enhanced graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n📤 ${signal} received, shutting down gracefully...`);
  logger.info(`${signal} received, shutting down`);

  // ✅ Close Socket.IO
  if (io) {
    io.close(() => {
      logger.info('🔌 Socket.IO connections closed');
    });
  }

  // ✅ Close HTTP server
  if (server) {
    server.close(() => {
      logger.info('🌐 HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  console.log(`Unhandled Promise Rejection: ${err.message}`);
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.log(`Uncaught Exception: ${err.message}`);
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();
