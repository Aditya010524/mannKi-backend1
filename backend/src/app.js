import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';

// Routes
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import followRoutes from './routes/follow.routes.js';
import tweetRoutes from './routes/tweet.routes.js';
import messageRoutes from './routes/message.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
// Middleware
import limiter from './middleware/rate-limiter.middleware.js';
import errorHandler from './middleware/error.middleware.js';
import notFound from './middleware/not-found.middleware.js';
import morganLogger from './middleware/morgan-logger.middleware.js';
import logger from './config/logger.config.js';
import configEnv from './config/env.config.js';

// App
const app = express();

// ==========================================
// PERFORMANCE: Set trust proxy before CORS/compression
// ==========================================
app.set('trust proxy', 1); // Trust first proxy (for rate limiting accuracy)

// ==========================================
// SECURITY & PERFORMANCE MIDDLEWARE
// ==========================================
app.use(helmet());

// ✅ CORS: More secure origin handling (allow-all was replaced with proper config)
app.use(
  cors({
    origin: configEnv.SECURITY.CORS_ORIGIN, // Use from env config
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// ✅ Compression before other middleware
app.use(compression());

// ✅ Health check route BEFORE rate limiter for monitoring
app.use('/health', healthRoutes);

// ✅ Rate limiting after health check (so health checks aren't limited)
app.use(limiter);

// ✅ Parse JSON/URL with optimized limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ✅ OPTIMIZED LOGGING: Use lighter logging in production, avoid blocking
if (configEnv.IS_DEV) {
  // In dev: use morgan with color/formatting
  app.use(
    morgan('dev', {
      skip: (req) => {
        // Skip logging for health checks (reduce noise)
        return req.path === '/health';
      },
    })
  );
} else {
  // In production: use combined format with async stream
  app.use(
    morgan('combined', {
      stream: { 
        write: (message) => {
          // Async logging to avoid blocking event loop
          setImmediate(() => logger.info(message.trim()));
        }
      },
      skip: (req) => {
        // Skip health checks and socket.io in production
        return req.path === '/health' || req.path.startsWith('/socket.io');
      },
    })
  );
}

// ==========================================
// ROUTES - MAKE SURE THESE ARE UNCOMMENTED!
// ==========================================

// API routes
const apiRouter = express.Router();
app.use(configEnv.API_PREFIX || '/api/v1', apiRouter);

// Mount your API routes here
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/follows', followRoutes);
apiRouter.use('/tweets', tweetRoutes);
apiRouter.use('/messages', messageRoutes);
apiRouter.use('/notifications', notificationsRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;
