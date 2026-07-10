import rateLimit from 'express-rate-limit';
import configEnv from '../config/env.config.js';

// Use environment variables instead of hardcoded values
const limiter = rateLimit({
  windowMs: configEnv.RATE_LIMIT.WINDOW_MINUTES * 60 * 1000, // Convert minutes to ms
  max: configEnv.RATE_LIMIT.MAX, // Use max from environment
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

export default limiter;
