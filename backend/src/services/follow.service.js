import { User, Follow } from '../models/index.js';
import ApiError from '../utils/api-error.js';
import logger from '../config/logger.config.js';
import mongoose from 'mongoose';

class FollowService {
  // Follow a user without transactions

  async followUser(followerId, followingId) {
    // Prevent self-follow
    if (followerId.toString() === followingId.toString()) {
      throw ApiError.badRequest('You cannot follow yourself');
    }

    try {
      // Check if users exist
      const [follower, following] = await Promise.all([
        User.findById(followerId),
        User.findById(followingId),
      ]);

      if (!follower) throw ApiError.notFound('Follower user not found');
      if (!following) throw ApiError.notFound('User to follow not found');
      if (!following.isActive) throw ApiError.badRequest('Cannot follow inactive user');

      // Check if already following
      const existingFollow = await Follow.findOne({
        follower: followerId,
        following: followingId,
      });

      if (existingFollow) {
        throw ApiError.conflict('Already following this user');
      }

      // Create follow relationship
      const follow = await Follow.create({
        follower: followerId,
        following: followingId,
      });

      // Update counts in parallel (not atomic, but works fine here)
      const updateResults = await Promise.all([
        User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } }, { new: true }),
        User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } }, { new: true }),
      ]);

      if (!updateResults[0] || !updateResults[1]) {
        throw new Error('Failed to update user counts');
      }

      logger.info(`User ${followerId} followed user ${followingId}`);
      return follow;
    } catch (error) {
      logger.error(`Error following user: ${error.message}`, { followerId, followingId });

      if (error instanceof ApiError) {
        throw error;
      }

      throw ApiError.internal('Failed to follow user');
    }
  }

  // Unfollow a user without transactions
  async unfollowUser(followerId, followingId) {
    try {
      // Find and delete the follow relationship
      const follow = await Follow.findOneAndDelete({
        follower: followerId,
        following: followingId,
      });

      if (!follow) {
        throw ApiError.notFound('Follow relationship not found');
      }

      // Update counts in parallel
      const updateResults = await Promise.all([
        User.findByIdAndUpdate(
          followerId,
          {
            $inc: { followingCount: -1 },
          },
          { new: true }
        ),
        User.findByIdAndUpdate(
          followingId,
          {
            $inc: { followersCount: -1 },
          },
          { new: true }
        ),
      ]);

      // Safety: ensure counts never go below 0
      await Promise.all([
        User.findByIdAndUpdate(followerId, { $max: { followingCount: 0 } }),
        User.findByIdAndUpdate(followingId, { $max: { followersCount: 0 } }),
      ]);

      if (!updateResults[0] || !updateResults[1]) {
        throw new Error('Failed to update user counts');
      }

      logger.info(`User ${followerId} unfollowed user ${followingId}`);
      return follow;
    } catch (error) {
      logger.error(`Error unfollowing user: ${error.message}`, { followerId, followingId });

      if (error instanceof ApiError) {
        throw error;
      }

      throw ApiError.internal('Failed to unfollow user');
    }
  }

  // Get user's followers
  async getFollowers(userId, currentUserId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    try {
      const [followers, total] = await Promise.all([
        Follow.find({ following: userId })
          .populate(
            'follower',
            'username displayName avatar bio isVerified followersCount followingCount tweetsCount'
          ) // ✅ Include more fields
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Follow.countDocuments({ following: userId }),
      ]);

      // ✅ Extract follower user objects
      const followerUsers = followers.map((f) => f.follower).filter(Boolean);
      const followerIds = followerUsers.map((user) => user._id);

      // ✅ Get follow status for current user with each follower
      const [currentUserFollowing, currentUserFollowers] = await Promise.all([
        Follow.find({
          follower: currentUserId,
          following: { $in: followerIds },
        })
          .select('following')
          .lean(),
        Follow.find({
          follower: { $in: followerIds },
          following: currentUserId,
        })
          .select('follower')
          .lean(),
      ]);

      const isFollowingSet = new Set(currentUserFollowing.map((f) => f.following.toString()));
      const isFollowedBySet = new Set(currentUserFollowers.map((f) => f.follower.toString()));

      // ✅ Format followers with follow status
      const enrichedFollowers = followerUsers.map((follower) => {
        const followerId = follower._id.toString();
        const isFollowing = isFollowingSet.has(followerId);
        const isFollowedBy = isFollowedBySet.has(followerId);

        return {
          _id: follower._id,
          username: follower.username,
          displayName: follower.displayName,
          avatar: follower.avatar,
          bio: follower.bio || '',
          isVerified: follower.isVerified || false,
          followersCount: follower.followersCount || 0,
          followingCount: follower.followingCount || 0,
          tweetsCount: follower.tweetsCount || 0,
          followStatus: {
            isFollowing: isFollowing,
            isFollowedBy: isFollowedBy,
            isMutual: isFollowing && isFollowedBy,
            isSelf: followerId === currentUserId.toString(),
          },
        };
      });

      return {
        followers: enrichedFollowers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(`Error getting followers for user ${userId}:`, error.message);
      throw ApiError.internal('Failed to get followers');
    }
  }

  // Get user's following list
  async getFollowing(userId, currentUserId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    try {
      const [following, total] = await Promise.all([
        Follow.find({ follower: userId })
          .populate(
            'following',
            'username displayName avatar bio isVerified followersCount followingCount tweetsCount'
          ) // ✅ Include more fields
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Follow.countDocuments({ follower: userId }),
      ]);

      // ✅ Extract following user objects
      const followingUsers = following.map((f) => f.following).filter(Boolean);
      const followingIds = followingUsers.map((user) => user._id);

      // ✅ Get follow status for current user with each following user
      const [currentUserFollowing, currentUserFollowers] = await Promise.all([
        Follow.find({
          follower: currentUserId,
          following: { $in: followingIds },
        })
          .select('following')
          .lean(),
        Follow.find({
          follower: { $in: followingIds },
          following: currentUserId,
        })
          .select('follower')
          .lean(),
      ]);

      const isFollowingSet = new Set(currentUserFollowing.map((f) => f.following.toString()));
      const isFollowedBySet = new Set(currentUserFollowers.map((f) => f.follower.toString()));

      // ✅ Format following with follow status
      const enrichedFollowing = followingUsers.map((followingUser) => {
        const followingId = followingUser._id.toString();
        const isFollowing = isFollowingSet.has(followingId);
        const isFollowedBy = isFollowedBySet.has(followingId);

        return {
          _id: followingUser._id,
          username: followingUser.username,
          displayName: followingUser.displayName,
          avatar: followingUser.avatar,
          bio: followingUser.bio || '',
          isVerified: followingUser.isVerified || false,
          followersCount: followingUser.followersCount || 0,
          followingCount: followingUser.followingCount || 0,
          tweetsCount: followingUser.tweetsCount || 0,
          followStatus: {
            isFollowing: isFollowing,
            isFollowedBy: isFollowedBy,
            isMutual: isFollowing && isFollowedBy,
            isSelf: followingId === currentUserId.toString(),
          },
        };
      });

      return {
        following: enrichedFollowing,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(`Error getting following for user ${userId}:`, error.message);
      throw ApiError.internal('Failed to get following');
    }
  }

  // Get follow status
  async getFollowStatus(followerId, followingId) {
    if (followerId.toString() === followingId.toString()) {
      return { status: 'self', relationship: null };
    }

    try {
      const follow = await Follow.findOne({
        follower: followerId,
        following: followingId,
      }).lean();

      const followedBy = await Follow.findOne({
        follower: followingId,
        following: followerId,
      }).lean();

      if (follow && followedBy) {
        return { status: 'mutual', relationship: follow };
      }

      if (follow) {
        return { status: 'following', relationship: follow };
      }

      if (followedBy) {
        return { status: 'followed_by', relationship: followedBy };
      }

      return { status: 'not_following', relationship: null };
    } catch (error) {
      logger.error(`Error getting follow status:`, error.message);
      throw ApiError.internal('Failed to get follow status');
    }
  }

  // Service: Get mutual followers between current user and target user
  async getMutualFollows(currentUserId, targetUserId, limit = 10) {
    const currentId = new mongoose.Types.ObjectId(currentUserId);
    const targetId = new mongoose.Types.ObjectId(targetUserId);

    // 1️⃣ Users followed by current user
    const currentFollowing = await Follow.find({ follower: currentId }).select('following').lean();
    const currentFollowingIds = currentFollowing.map((f) => f.following.toString());

    // 2️⃣ Users that target user also follows
    const targetFollowing = await Follow.find({
      follower: targetId,
      following: { $in: currentFollowingIds },
    })
      .limit(limit)
      .populate('following', 'username displayName avatar isVerified')
      .lean();

    return targetFollowing.map((f) => f.following);
  }

  // Suggested users to follow with better performance
  async getSuggestedUsers(userId, limit = 10) {
    try {
      // Get users already being followed
      const alreadyFollowing = await Follow.find({ follower: userId }).select('following').lean();

      const followingIds = alreadyFollowing.map((f) => f.following.toString());
      followingIds.push(userId.toString()); // Exclude self

      // Get suggested users
      const suggestedUsers = await User.find({
        _id: { $nin: followingIds },
        isActive: true,
      })
        .select('username displayName avatar isVerified followersCount')
        .sort({ followersCount: -1, createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

      return suggestedUsers;
    } catch (error) {
      logger.error(`Error getting suggested users for ${userId}:`, error.message);
      throw ApiError.internal('Failed to get suggested users');
    }
  }
}

export const followService = new FollowService();
