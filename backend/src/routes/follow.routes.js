import express from 'express';
import { followController } from '../controllers/follow.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import followValidation from '../validations/follow.validation.js';

const router = express.Router();

// All follow routes require authentication
router.use(authenticateUser);

// ==========================================
// CORE FOLLOW/UNFOLLOW OPERATIONS
// ==========================================

// Follow a user
router.post(
  '/:userId',
  validate(followValidation.followUser, 'params'),
  followController.followUser
);

// Unfollow a user
router.delete(
  '/:userId',
  validate(followValidation.unfollowUser, 'params'),
  followController.unfollowUser
);

// Toggle follow status (follow if not following, unfollow if following)
router.put(
  '/:userId/toggle',
  validate(followValidation.followUser, 'params'),
  followController.toggleFollow
);

// ==========================================
// FOLLOW LISTS & INFORMATION
// ==========================================

// Get user's followers list
router.get(
  '/:userId/followers',
  validate(followValidation.getFollowList, 'params'),
  followController.getFollowers
);

// Get user's following list
router.get(
  '/:userId/following',
  validate(followValidation.getFollowList, 'params'),
  followController.getFollowing
);

// Get mutual follows between current user and target user
router.get(
  '/:userId/mutual',
  validate(followValidation.getMutualFollows, 'params'),
  followController.getMutualFollows
);

// ==========================================
// FOLLOW STATUS & UTILITIES
// ==========================================

// Check follow status with a user
router.get(
  '/:userId/status',
  validate(followValidation.getFollowStatus, 'params'),
  followController.getFollowStatus
);

// Get suggested users to follow
router.get(
  '/suggestions',
  validate(followValidation.getSuggestions, 'query'),
  followController.getSuggestedUsers
);

export default router;
