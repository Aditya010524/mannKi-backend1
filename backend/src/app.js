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
import notFound from './middleware/not-Found.middleware.js';
import morganLogger from './middleware/morgan-Logger.middleware.js';
import logger from './config/logger.config.js';
import configEnv from './config/env.config.js';

// App
const app = express();

// ==========================================
// SECURITY & PERFORMANCE MIDDLEWARE
// ==========================================
app.use(helmet());
app.use(
  cors({
    origin: configEnv.SECURITY.CORS_ORIGIN,
    // origin: configEnv.SECURITY.FRONTEND_URL,
    credentials: true,
  })
);
app.use(compression());
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (configEnv.IS_DEV) {
  app.use(morganLogger);
} else {
  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) },
    })
  );
}

// ==========================================
// ROUTES - MAKE SURE THESE ARE UNCOMMENTED!
// ==========================================

// Health check routes - mounted at /health
app.use('/health', healthRoutes);

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
