import { User } from '../models/index.js';
import ApiError from '../utils/api-error.js';
import mongoose from 'mongoose';
import logger from '../config/logger.config.js';

class UserService {
  // Get user by ID with public information
  async getUserById(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const user = await User.findOne({
      _id: userId,
      isActive: { $ne: false },
    }).select('-password');

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Return full profile for public accounts or own profile
    return {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatar: user.avatar,
      coverPhoto: user.coverPhoto,
      location: user.location,
      website: user.website,
      isVerified: user.isVerified,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      tweetsCount: user.tweetsCount,
      createdAt: user.createdAt,
    };
  }

  // Search users by username, displayName, email
  async searchUsers(searchTerm, options = {}, currentUserId) {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const searchQuery = {
      $and: [
        { _id: { $ne: new mongoose.Types.ObjectId(currentUserId) } },
        { isActive: { $ne: false } },
        {
          $or: [
            { username: { $regex: searchTerm, $options: 'i' } },
            { displayName: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
          ],
        },
      ],
    };

    const totalCount = await User.countDocuments(searchQuery);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const currentPage = Math.min(Math.max(1, parseInt(page)), totalPages);
    const skip = (currentPage - 1) * limit;

    const users = await User.find(searchQuery)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return {
      users,
      pagination: {
        page: currentPage, // Changed from currentPage
        limit: parseInt(limit), // Added
        total: totalCount, // Changed from totalCount
        totalPages, // Added
      },
    };
  }

  //  Get all users with pagination and filters
  async getAllUsers(options = {}, currentUserId) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      verified = null,
      isPrivate = null,
    } = options;

    const skip = (page - 1) * limit;

    // Build query
    const query = {
      _id: { $ne: new mongoose.Types.ObjectId(currentUserId) },
      isActive: { $ne: false },
    };

    // Add filters
    if (verified !== null) {
      query.isVerified = verified === 'true';
    }

    if (isPrivate !== null) {
      query.isPrivate = isPrivate === 'true';
    }

    // Execute query
    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select('username displayName bio avatar isVerified isPrivate followersCount createdAt')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    return {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1,
      },
    };
  }

  // Update profile
  async updateProfile(userId, updates) {
    // Remove any undefined/null values
    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined || updates[key] === null || updates[key] === '') {
        delete updates[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  }

  // Update username - NOW REQUIRES PASSWORD VERIFICATION
  async updateUsername(userId, newUsername, currentPassword) {
    // Verify current password first
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Current password is incorrect');
    }

    // Check if username is already taken
    const existingUser = await User.findOne({
      username: newUsername.toLowerCase(),
      _id: { $ne: userId },
    });

    if (existingUser) {
      throw ApiError.conflict('Username is already taken');
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username: newUsername.toLowerCase() },
      { new: true }
    ).select('-password');

    return updatedUser;
  }

  // Change password - UPDATED TO HANDLE CONFIRM PASSWORD
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw ApiError.unauthorized('Invalid current password');
    }

    // Check if new password is different from current
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      throw ApiError.badRequest('New password must be different from current password');
    }

    user.password = newPassword;
    await user.save();

    logger.info(`Password updated for user: ${user.email}`);
    return { message: 'Password changed successfully' };
  }

  // Delete account - UPDATED TO HANDLE DELETE CONFIRMATION
  async deleteAccount(userId, password, confirmDelete) {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Password is incorrect');
    }

    // Additional safety check (already handled by validation, but good to have)
    if (confirmDelete !== 'DELETE') {
      throw ApiError.badRequest('Account deletion not confirmed');
    }

    await User.findByIdAndUpdate(userId, {
      isActive: false,
      username: `deleted_${userId}`,
      email: `deleted_${userId}@deleted.com`,
      deletedAt: new Date(),
    });

    return { message: 'Account deleted successfully' };
  }

  //  Get user statistics
  async getUserStats(userId) {
    const user = await User.findOne({
      _id: userId,
      isActive: { $ne: false },
    })
      .select('displayName followersCount followingCount tweetsCount')
      .lean();

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return {
      displayName: user.displayName,
      followersCount: user.followersCount || 0,
      followingCount: user.followingCount || 0,
      tweetsCount: user.tweetsCount || 0,
      accountAge: user.accountAge,
    };
  }
}

export const userService = new UserService();
