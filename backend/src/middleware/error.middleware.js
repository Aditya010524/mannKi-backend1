/**
 * Global error handling middleware
 * Should be the last middleware in the application
 */
import ApiError from '../utils/api-error.js';
import ApiResponse from '../utils/api-response.js';
import logger from '../config/logger.config.js';

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Log error for debugging
  logger.error({
    message: err.message,
    stack: err.stack,
    name: err.name,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    body: req.body, // Add request body for debugging
    userId: req.user?.userId || null, // Add user context
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    logger.warn(`Invalid ObjectId at ${req.originalUrl}`);
    error = ApiError.notFound('Resource not found');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    logger.warn('Duplicate key error');
    error = ApiError.conflict('Duplicate field value entered');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    logger.warn('Validation failed', errors);
    error = ApiError.validation('Validation failed', errors);
  }

  // MongoDB connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoServerError') {
    logger.error('Database connection error');
    error = ApiError.internal('Database connection error');
  }

  // File upload errors (if using multer)
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = ApiError.badRequest('File too large');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    logger.warn('Invalid JWT token');
    error = ApiError.unauthorized('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    logger.warn('Expired JWT token');
    error = ApiError.unauthorized('Token expired');
  }

  // Rate limiting errors
  if (err.status === 429) {
    logger.warn('Rate limit hit');
    error = ApiError.tooManyRequests('Too many requests, please try again later');
  }

  // Invalid JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.warn('Invalid JSON payload');
    error = ApiError.badRequest('Invalid JSON payload');
  }

  // Default to ApiError if not already one
  if (!(error instanceof ApiError)) {
    logger.error('Unhandled error type');
    error = new ApiError(error.message || 'Internal Server Error', error.statusCode || 500, false);
  }

  return ApiResponse.error(res, error.message, error.statusCode, error.errors || null);
};

export default errorHandler;
