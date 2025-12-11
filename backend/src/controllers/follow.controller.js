import { followService } from '../services/follow.service.js';
import asyncHandler from '../utils/async-handler.js';
import ApiResponse from '../utils/api-response.js';
import ApiError from '../utils/api-error.js';
import mongoose from 'mongoose';
import notifService from '../services/notification.service.js';

class FollowController {
  // Follow a user
  followUser = asyncHandler(async (req, res) => {
    const followerId = req.user._id; // Keep as ObjectId for consistency
    const { userId: followingId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(followingId)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    const follow = await followService.followUser(followerId, followingId);

    // Create follow notification for the followed user
    try {
      await notifService.createOrUpdateSimpleNotification({
        recipientId: followingId,
        actorId: followerId,
        type: 'follow',
        targetType: 'user',
        targetId: followingId,
        extra: { followerId: followerId.toString() },
      });
    } catch (err) {
      // Log but don't fail the main flow
      console.warn('Failed to create follow notification', err);
    }

    return ApiResponse.created(
      res,
      {
        followId: follow._id,
        followedAt: follow.createdAt,
        followingUserId: followingId,
      },
      'Successfully followed user'
    );
  });

  // Unfollow a user
  unfollowUser = asyncHandler(async (req, res) => {
    const followerId = req.user._id;
    const { userId: followingId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(followingId)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    const unfollow = await followService.unfollowUser(followerId, followingId);

    // Remove follow notification (if present)
    try {
      await notifService.removeSimpleNotification({
        recipientId: followingId,
        actorId: followerId,
        type: 'follow',
        targetType: 'user',
        targetId: followingId,
      });
    } catch (err) {
      console.warn('Failed to remove follow notification', err);
    }

    return ApiResponse.success(
      res,
      {
        unfollowedUserId: followingId,
        unfollowedAt: new Date(),
        previousFollowDate: unfollow.createdAt,
      },
      'Successfully unfollowed user'
    );
  });

  // Toggle follow status (follow if not following, unfollow if following)
  toggleFollow = asyncHandler(async (req, res) => {
    const followerId = req.user._id;
    const { userId: followingId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(followingId)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    // Check current status
    const currentStatus = await followService.getFollowStatus(followerId, followingId);

    let result;
    let action;
    let isFollowing;

    if (currentStatus.status === 'following' || currentStatus.status === 'mutual') {
      // Currently following, so unfollow
      result = await followService.unfollowUser(followerId, followingId);
      action = 'unfollowed';
      isFollowing = false;

      // Remove follow notification
      try {
        await notifService.removeSimpleNotification({
          recipientId: followingId,
          actorId: followerId,
          type: 'follow',
          targetType: 'user',
          targetId: followingId,
        });
      } catch (err) {
        console.warn('Failed to remove follow notification', err);
      }
    } else if (currentStatus.status === 'not_following' || currentStatus.status === 'followed_by') {
      // Not following, so follow
      result = await followService.followUser(followerId, followingId);
      action = 'followed';
      isFollowing = true;

      // Create follow notification
      try {
        await notifService.createOrUpdateSimpleNotification({
          recipientId: followingId,
          actorId: followerId,
          type: 'follow',
          targetType: 'user',
          targetId: followingId,
          extra: { followerId: followerId.toString() },
        });
      } catch (err) {
        console.warn('Failed to create follow notification', err);
      }
    } else {
      throw ApiError.badRequest('Cannot toggle follow status for this user');
    }

    return ApiResponse.success(
      res,
      {
        action,
        isFollowing,
        userId: followingId,
        actionDate: result.createdAt || new Date(),
      },
      `Successfully ${action} user`
    );
  });

  // controllers/follow.controller.js

  // Get user's followers
  getFollowers = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const currentUserId = req.user._id; // ✅ Get current user ID

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    const result = await followService.getFollowers(
      userId,
      currentUserId, // ✅ Pass current user ID
      page,
      limit
    );

    return ApiResponse.paginated(
      res,
      result.followers,
      result.pagination,
      'Followers retrieved successfully'
    );
  });

  // Get user's following list
  getFollowing = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const currentUserId = req.user._id; // ✅ Get current user ID

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    const result = await followService.getFollowing(
      userId,
      currentUserId, // ✅ Pass current user ID
      page,
      limit
    );

    return ApiResponse.paginated(
      res,
      result.following,
      result.pagination,
      'Following list retrieved successfully'
    );
  });

  // Check follow status between two users
  getFollowStatus = asyncHandler(async (req, res) => {
    const followerId = req.user._id;
    const { userId: followingId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(followingId)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    const status = await followService.getFollowStatus(followerId, followingId);

    return ApiResponse.success(res, status, 'Follow status retrieved successfully');
  });

  // Get mutual followers between current user and target user
  getMutualFollows = asyncHandler(async (req, res) => {
    const currentUserId = req.user._id;
    const { userId: targetUserId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    const mutualFollows = await followService.getMutualFollows(currentUserId, targetUserId, limit);

    return ApiResponse.success(
      res,
      {
        mutualFollows,
        count: mutualFollows.length,
        hasMore: mutualFollows.length === limit,
      },
      'Mutual follows retrieved successfully'
    );
  });

  // Get suggested users to follow
  getSuggestedUsers = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Cap at 50

    const suggestedUsers = await followService.getSuggestedUsers(userId, limit);

    return ApiResponse.success(
      res,
      {
        suggestions: suggestedUsers,
        count: suggestedUsers.length,
      },
      'Suggested users retrieved successfully'
    );
  });
}

export const followController = new FollowController();
