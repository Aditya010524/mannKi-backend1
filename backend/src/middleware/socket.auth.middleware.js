// middleware/socket.auth.middleware.js
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import configEnv from '../config/env.config.js';

export const socketAuthMiddleware = async (socket, next) => {
  try {
    // Extract token from cookies or authorization header
    let token = socket.handshake.headers.cookie
      ?.split('; ')
      .find((row) => row.startsWith('jwt='))
      ?.split('=')[1];

    // Fallback to authorization header
    if (!token) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      console.log('Socket connection rejected: No token provided');
      return next(new Error('Unauthorized - No Token Provided'));
    }

    // Verify the token
    const decoded = jwt.verify(token, configEnv.JWT.ACCESS_SECRET);
    if (!decoded) {
      console.log('Socket connection rejected: Invalid token');
      return next(new Error('Unauthorized - Invalid Token'));
    }

    // Find the user from database
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      console.log('Socket connection rejected: User not found');
      return next(new Error('User not found'));
    }

    // Attach user info to socket
    socket.user = user;
    socket.userId = user._id.toString();

    console.log(`✅ Socket authenticated for user: ${user.displayName} (@${user.username})`);

    next();
  } catch (error) {
    console.log('Error in socket authentication:', error.message);
    next(new Error('Unauthorized - Authentication failed'));
  }
};
