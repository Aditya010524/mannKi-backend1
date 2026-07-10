import cluster from 'cluster';
import os from 'os';
import { connectDB } from './config/database.config.js';
import configEnv from './config/env.config.js';
import logger from './config/logger.config.js';
import { server, io } from './services/socket.service.js'; // ✅ import io too

const PORT = configEnv.PORT || 3000;
const numCPUs = os.cpus().length;

// ✅ CLUSTERING: Enable multi-process for better scalability
const enableClustering = configEnv.IS_PROD; // Enable in production only

if (enableClustering && cluster.isPrimary) {
  // ==========================================
  // MASTER PROCESS
  // ==========================================
  console.log(`🚀 Master process ${process.pid} starting clustering...`);
  console.log(`🔄 Spawning ${numCPUs} worker processes...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    if (signal) {
      logger.info(`Worker ${worker.process.pid} was killed by signal: ${signal}`);
    } else if (code !== 0) {
      logger.warn(`Worker ${worker.process.pid} exited with error code: ${code}`);
      // Respawn worker on unexpected exit
      logger.info(`Respawning worker...`);
      cluster.fork();
    } else {
      logger.info(`Worker ${worker.process.pid} exited successfully`);
    }
  });

  // ✅ Graceful shutdown for master
  const gracefulShutdownMaster = (signal) => {
    console.log(`\n📤 ${signal} received, shutting down master gracefully...`);
    logger.info(`${signal} received on master, shutting down`);

    // Disconnect all workers
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdownMaster('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdownMaster('SIGINT'));
} else {
  // ==========================================
  // WORKER PROCESS
  // ==========================================
  const startServer = async () => {
    try {
      await connectDB();

      server.listen(PORT, () => {
        console.log('🚀 =======================================');
        console.log(`🌟 Twitter Chat Server Started [Worker ${process.pid}]`);
        console.log('🚀 =======================================');
        console.log(`🌍 Environment: ${configEnv.NODE_ENV}`);
        console.log(`🔗 Server: http://localhost:${PORT}`);
        console.log(`📡 API: http://localhost:${PORT}${configEnv.API_PREFIX}`);
        console.log(`⚙️  Clustering: ${enableClustering ? `Enabled (${numCPUs} workers)` : 'Disabled'}`);
        console.log('🔌 Real-time Chat: ACTIVE');
        console.log('🚀 =======================================');
        logger.info(`Server with Socket.IO started on port ${PORT} (PID: ${process.pid})`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  };

  // ✅ Enhanced graceful shutdown for worker
  const gracefulShutdown = (signal) => {
    console.log(`\n📤 ${signal} received on worker ${process.pid}, shutting down gracefully...`);
    logger.info(`${signal} received, shutting down (PID: ${process.pid})`);

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
}
