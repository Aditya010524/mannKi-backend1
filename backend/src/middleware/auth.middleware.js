import jwt from 'jsonwebtoken';
import configEnv from '../config/env.config.js';
import ApiError from '../utils/api-error.js';
import asyncHandler from '../utils/async-handler.js';
import { authService } from '../services/auth.service.js';
import { User } from '../models/index.js';

// Middleware to authenticate user with access token
export const authenticateUser = asyncHandler(async (req, res, next) => {
  // In your authenticateUser middleware (temporary debug)

  // 1. Get token from header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access token is required');
  }

  const accessToken = authHeader.split(' ')[1];

  if (!accessToken) {
    throw ApiError.unauthorized('Access token is required');
  }

  // 2. Verify token
  let decoded = authService.validateToken(accessToken, configEnv.JWT.ACCESS_SECRET);

  // 3. Check if token is access type
  if (decoded.type !== 'access') {
    throw ApiError.unauthorized('Invalid token type');
  }

  // 4. Get user from database
  const user = await User.findById(decoded.userId);

  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  // 5. Check if user account is active
  if (!user.isActive) {
    throw ApiError.unauthorized('Account has been deactivated');
  }

  // 6. Check if password was changed after token was issued - (if password is changed please login again)
  if (user.passwordChangedAt) {
    const passwordChangedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);

    if (decoded.iat < passwordChangedTimestamp) {
      throw ApiError.unauthorized('Password was changed. Please login again');
    }
  }

  // 7. Update last active time
  user.lastActiveAt = new Date();
  await user.save({ validateBeforeSave: false });

  // 8. Add user to request object
  req.user = user;
  next();
});

// Optional authentication middleware (doesn't throw error if no token)
// export const optionalAuth = asyncHandler(async (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return next(); // Continue without authentication
//   }

//   try {
//     await authenticateUser(req, res, next);
//   } catch (error) {
//     // If authentication fails, continue without user
//     req.user = null;
//     next();
//   }
// });
