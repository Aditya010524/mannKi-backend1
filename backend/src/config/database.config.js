// config/database.config.js
import mongoose from 'mongoose';
import configEnv from './env.config.js';
import logger from './logger.config.js';

const connectDB = async () => {
  try {
    // Enhanced connection options for scalability
    const options = {
      maxPoolSize: 50, // Increased from 10 to 50 for handling 200+ concurrent users
      minPoolSize: 10, // Minimum connections to maintain
      maxIdleTimeMS: 45000, // Close idle connections after 45 seconds
      serverSelectionTimeoutMS: 10000, // Increased from 5s to 10s for reliability
      socketTimeoutMS: 45000, // Individual operation timeout
      family: 4, // Use IPv4 (more stable than IPv6)
      retryWrites: true, // Enable automatic retry on transient failures
      retryReads: true, // Enable read retries
      waitQueueTimeoutMS: 10000, // Wait up to 10 seconds for a connection from pool
    };

    const conn = await mongoose.connect(configEnv.DATABASE.MONGODB_URI, options);
    logger.info(`✅ Dev DB connected: ${conn.connection.host}:${conn.connection.port}`);
    logger.info(`📊 Connection Pool - Max: ${options.maxPoolSize}, Min: ${options.minPoolSize}`);
  } catch (error) {
    logger.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('📊 Database disconnected');
  } catch (error) {
    logger.error('❌ Disconnect error:', error.message);
  }
};

// Essential error handling
mongoose.connection.on('error', (err) => {
  logger.error('❌ Database error:', err);
});

// ✅ Enhanced graceful shutdown (remove the old SIGINT handler since server.js handles it)
mongoose.connection.on('disconnected', () => {
  logger.info('📊 Database disconnected');
});

export { connectDB, disconnectDB };
