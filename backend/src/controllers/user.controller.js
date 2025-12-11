import { User, AuthToken } from '../models/index.js';
import { authService } from '../services/auth.service.js';
import { userService } from '../services/user.service.js';
import { followService } from '../services/follow.service.js';
import ApiError from '../utils/api-error.js';
import ApiResponse from '../utils/api-response.js';
import asyncHandler from '../utils/async-handler.js';
import logger from '../config/logger.config.js';
import configEnv from '../config/env.config.js';

class UserController {
  // Get current user profile
  getCurrentUser = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.user._id);
    return ApiResponse.success(res, user, 'User profile retrieved successfully');
  });

  // Get user by ID with follow status
  getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Get user and follow status in parallel
    const [user, followStatus] = await Promise.all([
      userService.getUserById(userId),
      followService.getFollowStatus(currentUserId, userId),
    ]);

    // Add follow status to user object
    const userWithFollowStatus = {
      ...user,
      followStatus: {
        isFollowing: followStatus.status === 'following' || followStatus.status === 'mutual',
        isFollowedBy: followStatus.status === 'followed_by' || followStatus.status === 'mutual',
        isMutual: followStatus.status === 'mutual',
        isSelf: followStatus.status === 'self',
        followedAt: followStatus.followedAt || null,
      },
    };

    return ApiResponse.success(res, userWithFollowStatus, 'User profile retrieved successfully');
  });

  // Search users
  searchUsers = asyncHandler(async (req, res) => {
    const { q: query, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const currentUserId = req.user._id;

    if (!query || query.trim().length < 2) {
      throw ApiError.badRequest('Search query must be at least 2 characters');
    }

    const searchResults = await userService.searchUsers(
      query.trim(),
      { page: parseInt(page), limit: parseInt(limit), sortBy, sortOrder },
      currentUserId
    );

    // Get follow status for each user in parallel
    const usersWithFollowStatus = await Promise.all(
      searchResults.users.map(async (user) => {
        const followStatus = await followService.getFollowStatus(currentUserId, user._id);

        return {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          bio: user.bio,
          isVerified: user.isVerified,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          tweetsCount: user.tweetsCount,
          followStatus: {
            isFollowing: followStatus.status === 'following' || followStatus.status === 'mutual',
            isFollowedBy: followStatus.status === 'followed_by' || followStatus.status === 'mutual',
            isMutual: followStatus.status === 'mutual',
            isSelf: followStatus.status === 'self',
          },
        };
      })
    );

    return ApiResponse.paginated(
      res,
      usersWithFollowStatus,
      searchResults.pagination,
      'Users found successfully'
    );
  });

  // Get suggested users (not following)
  getSuggestedUsers = asyncHandler(async (req, res) => {
    const currentUserId = req.user._id;
    const { limit = 10 } = req.query;

    const suggestedUsers = await followService.getSuggestedUsers(currentUserId, parseInt(limit));

    // Add follow status (should all be false since these are suggestions)
    const usersWithFollowStatus = suggestedUsers.map((user) => ({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      isVerified: user.isVerified,
      followersCount: user.followersCount,
      followStatus: {
        isFollowing: false,
        isFollowedBy: false,
        isMutual: false,
        isSelf: false,
      },
    }));

    return ApiResponse.success(
      res,
      usersWithFollowStatus,
      'Suggested users retrieved successfully'
    );
  });

  // Update user profile
  updateProfile = asyncHandler(async (req, res) => {
    const updates = { ...req.body };

    if (req.files?.avatar?.[0]?.path) {
      updates.avatar = req.files.avatar[0].path;
    }

    if (req.files?.coverPhoto?.[0]?.path) {
      updates.coverPhoto = req.files.coverPhoto[0].path;
    }

    const updatedUser = await userService.updateProfile(req.user._id, updates);
    return ApiResponse.success(res, updatedUser, 'Profile updated successfully');
  });

  // Update username - NOW REQUIRES CURRENT PASSWORD
  updateUsername = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { username, currentPassword } = req.body;

    const updatedUser = await userService.updateUsername(userId, username, currentPassword);
    return ApiResponse.success(res, updatedUser, 'Username updated successfully');
  });

  // Update Email
  // updateEmail = asyncHandler(async (req, res) => {
  //   const { email, password } = req.body;
  //   const userId = req.user._id;

  //   const user = await User.findById(userId).select('+password');

  //   if (!user) {
  //     throw ApiError.notFound('User not found');
  //   }

  //   // Verify current password
  //   const isValidPassword = await user.comparePassword(password);
  //   if (!isValidPassword) {
  //     throw ApiError.unauthorized('Invalid current password');
  //   }

  //   // Check if email is already taken by another user
  //   const existingUser = await User.findOne({
  //     email,
  //     _id: { $ne: user._id },
  //   });

  //   if (existingUser) {
  //     throw ApiError.conflict('Email is already registered');
  //   }

  //   // Update email and mark as unverified
  //   const updatedUser = await User.findByIdAndUpdate(
  //     user._id,
  //     {
  //       email,
  //       isVerified: false, // Reset verification status
  //     },
  //     { new: true, runValidators: true }
  //   );

  //   logger.info(`Email updated for user: ${user.email} - New email: ${email}`);

  //   // Generate email verification token
  //   const verificationToken = await authService.createEmailVerificationToken(user._id);

  //   // Send verification email
  //   await emailService.sendVerificationEmail(user.email, verificationToken, user.displayName);

  //   return ApiResponse.success(res, {
  //     message: 'Email updated successfully. Please verify your new email address.',
  //     user: {
  //       id: updatedUser._id,
  //       username: updatedUser.username,
  //       email: updatedUser.email,
  //       isVerified: updatedUser.isVerified,
  //     },
  //   });
  // });

  // Update Password
  // Change password - NOW HANDLES CONFIRM PASSWORD
  changePassword = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;
    // confirmPassword is validated by Joi, so we know it matches newPassword

    await userService.changePassword(userId, currentPassword, newPassword);
    return ApiResponse.success(res, null, 'Password changed successfully');
  });

  // Logout from current device -(refreshToken required)
  logout = asyncHandler(async (req, res) => {
    // In dev: token may come from body or cookie
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
    const userId = req.user._id.toString();

    if (!refreshToken) {
      return ApiResponse.error(res, 'Refresh token is required for logout', 400);
    }

    // Remove / revoke refresh token from DB
    const removed = await authService.removeRefreshToken(refreshToken, userId);

    if (!removed) {
      return ApiResponse.error(res, 'Invalid or already revoked refresh token', 400);
    }

    // Clear cookie regardless (good hygiene, even if invalid token)
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/', // That ensures you clear the refresh token cookie globally (no matter which route set it).
    });

    logger.info(`User logged out: ${req.user.email}`);

    return ApiResponse.success(res, {
      message: 'Logout successful',
    });
  });

  // Logout from all devices -(refreshToken required)
  logoutAll = asyncHandler(async (req, res) => {
    // In dev: token may come from body or cookie
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
    const userId = req.user._id.toString();

    if (!refreshToken) {
      return ApiResponse.error(res, 'Refresh token is required for logout', 400);
    }

    // Get device info before revoking (optional)
    const activeTokens = await authService.getUserActiveSessions(userId);

    // Revoke all refresh tokens for this user
    const revokedCount = await authService.removeAllUserTokens(userId);

    // Always clear the cookie (even if no active sessions found)
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/', // Clear globally
    });

    logger.info(`User logged out from all devices: ${req.user.email} (${revokedCount} sessions)`);

    return ApiResponse.success(res, {
      message: `Successfully logged out from all devices (${revokedCount} sessions)`,
      revokedSessions: revokedCount,
      devices: activeTokens.map((t) => ({
        userAgent: t.userAgent,
        deviceName: t.device || 'Unknown Device',
        lastUsed: t.lastUsed,
      })),
    });
  });

  // Get active sessions -(refreshToken required)
  getSessions = asyncHandler(async (req, res) => {
    const userId = req.user._id.toString();

    const sessions = await authService.getUserActiveSessions(userId);

    // Get current token to identify the current session
    const currentRefreshToken = req.body.refreshToken || req.cookies.refreshToken;
    let currentTokenId = null;

    if (currentRefreshToken) {
      // Extract tokenId from current refresh token
      const decoded = authService.validateToken(currentRefreshToken, configEnv.JWT.REFRESH_SECRET);
      currentTokenId = decoded.tokenId;
    }

    // sessionWithCurrent -> mean we get all the session except current session and we didn't use it here depend on UI
    const sessionsWithCurrent = sessions.filter((session) => session.id !== currentTokenId);

    if (sessions.length === 0) {
      return ApiResponse.success(res, {
        message: 'No Actie sessions, Please login.',
      });
    }

    logger.info(`Sessions retrieved for user: ${req.user.email} (${sessions.length} active)`);

    return ApiResponse.success(res, {
      message: 'Active sessions retrieved successfully',
      // currentActiveSessions: sessionsWithCurrent,
      totalSessions: sessions.length,
      sessions: sessions,
    });
  });

  // Remove specific session
  removeSession = asyncHandler(async (req, res) => {
    const { tokenId } = req.params;
    const userId = req.user._id.toString();

    if (!tokenId) {
      throw ApiError.badRequest('Token ID is required');
    }

    await authService.removeSpecificSession(userId, tokenId);

    logger.info(`Session removed for user: ${req.user.email}, tokenId: ${tokenId}`);

    return ApiResponse.success(res, {
      message: 'Session removed successfully',
    });
  });

  // Delete account - NOW HANDLES DELETE CONFIRMATION
  deleteAccount = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { password, confirmDelete } = req.body;

    await userService.deleteAccount(userId, password, confirmDelete);
    return ApiResponse.success(res, null, 'Account deleted successfully');
  });

  // Get all user in Database
  getAllUsers = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      verified,
      isPrivate,
    } = req.query;
    const currentUserId = req.user._id;

    const result = await userService.getAllUsers(
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
        verified,
        isPrivate,
      },
      currentUserId
    );

    logger.info(`All users retrieved by ${req.user.email} - ${result.users.length} results`);

    return ApiResponse.success(res, {
      message: `Retrieved ${result.pagination.totalCount} users`,
      ...result,
    });
  });

  // Get user statistics with follow status
  getUserStats = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const [stats, followStatus] = await Promise.all([
      userService.getUserStats(userId),
      followService.getFollowStatus(currentUserId, userId),
    ]);

    console.log(stats.accountAge);
    const response = {
      ...stats,
      followStatus: {
        isFollowing: followStatus.status === 'following' || followStatus.status === 'mutual',
        isFollowedBy: followStatus.status === 'followed_by' || followStatus.status === 'mutual',
        isMutual: followStatus.status === 'mutual',
        isSelf: followStatus.status === 'self',
      },
    };

    return ApiResponse.success(res, response, 'User statistics retrieved successfully');
  });
}

export const userController = new UserController();
