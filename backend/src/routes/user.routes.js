import express from 'express';
import { validate } from '../middleware/validation.middleware.js';
import { userController } from '../controllers/user.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import userValidation from '../validations/user.validation.js';
import upload from '../config/upload.config.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// ================= USER ROUTES (Protected) =================

// Current user info
router.get('/me', userController.getCurrentUser);

// Update profile with file uploads
router.put(
  '/me',
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'coverPhoto', maxCount: 1 },
  ]),
  validate(userValidation.updateProfile),
  userController.updateProfile
);

// Update Username
router.put('/me/username', validate(userValidation.updateUsername), userController.updateUsername);

// Update Email
// router.put(
//   '/me/email',
//   authenticateUser,
//   validate(userValidation.updateEmail),
//   userController.updateProfile
// );

// Change password
router.post(
  '/change-password',
  validate(userValidation.changePassword),
  userController.changePassword
);

// Logout current session
router.post('/logout', userController.logout);

// Logout from all sessions
router.post('/logout-all', userController.logoutAll);

// Get active sessions
router.get('/sessions', userController.getSessions);

// Remove specific session
router.delete('/sessions/:tokenId', userController.removeSession);

// Delete account
router.delete('/me', validate(userValidation.deleteAccount), userController.deleteAccount);

// ================= USER DISCOVERY ROUTES =================

// Search users (with follow status)
router.get('/search', validate(userValidation.searchUsers, 'query'), userController.searchUsers);

// Get suggested users to follow
router.get(
  '/suggested',
  validate(userValidation.getSuggestedUsers, 'query'),
  userController.getSuggestedUsers
);

// Get all users with pagination (discover page)
router.get('/', validate(userValidation.getAllUsers, 'query'), userController.getAllUsers);

// ================= SPECIFIC USER ROUTES =================

// Get user by ID (with follow status)
router.get('/:userId', validate(userValidation.getUserById, 'params'), userController.getUserById);

// Get user statistics (with follow status)
router.get(
  '/:userId/stats',
  validate(userValidation.getUserStats, 'params'),
  userController.getUserStats
);

export default router;
