/**
 * Custom API Error class for consistent error handling
 */
class ApiError extends Error {
  constructor(message, statusCode = 500, isOperational = true, errors = null) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.errors = errors; // Always available, default = null
    this.type = 'API_ERROR';

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  // 4XX Client errors -Static methods for common errors
  static badRequest(message = 'Bad Request') {
    return new ApiError(message, 400);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(message, 401);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(message, 403);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(message, 404);
  }

  static conflict(message = 'Resource already exists') {
    return new ApiError(message, 409);
  }

  static validation(message = 'Validation failed', errors = null) {
    const error = new ApiError(message, 422);
    error.errors = errors;
    return error;
  }

  static tooManyRequests(message = 'Too Many Requests') {
    return new ApiError(message, 429);
  }

  //============ Not wrapped in erromiddlware.js ============
  // 5XX Server error
  static internal(message = 'Internal Server Error') {
    return new ApiError(message, 500, false);
  }

  // ===== Wrap external error =====
  static from(err, statusCode = 500) {
    return new ApiError(err.message || 'Unexpected error', statusCode, false, err.errors || null);
  }
}

export default ApiError;
