/**
 * 404 handler middleware
 * Place this before the global error handler
 */
import ApiError from '../utils/api-error.js';
import logger from '../config/logger.config.js';

const notFound = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;

  // Log it
  logger.warn(`[404] ${message} - Method: ${req.method} - IP: ${req.ip}`);

  // Pass structured error to error middleware
  next(ApiError.notFound(message));
};

export default notFound;
