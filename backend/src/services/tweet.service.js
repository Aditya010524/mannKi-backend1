import { Tweet, Comment, Media, Like, User, Follow } from '../models/index.js';
import { cloudinary } from '../config/media-upload.config.js';
import ApiError from '../utils/api-error.js';
import logger from '../config/logger.config.js';

class TweetService {
  // Create tweet with mentions and hashtags
  async createTweet({ author, content, mediaIds = [] }) {
    const user = await User.findById(author);
    if (!user || !user.isActive) {
      throw ApiError.notFound('User not found or inactive');
    }

    // Validate media
    if (mediaIds.length > 0) {
      const mediaCount = await Media.countDocuments({
        _id: { $in: mediaIds },
        owner: author,
        isActive: true,
        status: 'ready',
      });

      if (mediaCount !== mediaIds.length) {
        throw ApiError.badRequest('Invalid media IDs provided');
      }
    }

    // Extract mentions and hashtags
    const mentions = await this.extractMentions(content);
    const hashtags = this.extractHashtags(content);

    const tweet = await Tweet.create({
      author,
      content,
      mediaIds,
      mentions,
      hashtags,
    });

    // Mark media as used
    if (mediaIds.length > 0) {
      await Media.updateMany(
        { _id: { $in: mediaIds } },
        { $set: { isUsed: true, tweet: tweet._id } }
      );
    }

    await User.findByIdAndUpdate(author, { $inc: { tweetsCount: 1 } });
    logger.info(`Tweet created by user ${author}: ${tweet._id}`);

    return this.getTweetById(tweet._id);
  }

  // Update tweet with media support
  async updateTweet(tweetId, authorId, updateData) {
    const tweet = await Tweet.findById(tweetId).populate('mediaIds');

    if (!tweet || !tweet.isActive) {
      throw ApiError.notFound('Tweet not found');
    }

    if (!tweet.author.equals(authorId)) {
      throw ApiError.forbidden('You can only update your own tweets');
    }

    if (tweet.type !== 'original') {
      throw ApiError.badRequest('Only original tweets can be updated');
    }

    // Check edit time limit (15 minutes)
    const timeDiff = Date.now() - tweet.createdAt.getTime();
    const editTimeLimit = 15 * 60 * 1000;

    if (timeDiff > editTimeLimit) {
      throw ApiError.badRequest('Tweet can only be edited within 15 minutes of posting');
    }

    const { content, mediaIds = [], removeMedia = false } = updateData;

    // Handle media removal/replacement
    if (removeMedia && tweet.mediaIds.length > 0) {
      for (const media of tweet.mediaIds) {
        try {
          const resourceType = media.type === 'video' ? 'video' : 'image';
          await cloudinary.uploader.destroy(media.cloudinary.publicId, {
            resource_type: resourceType,
          });
          await Media.findByIdAndDelete(media._id);
        } catch (error) {
          logger.error(`Failed to delete media ${media._id}: ${error.message}`);
        }
      }
      tweet.mediaIds = [];
    }

    // Handle new media IDs
    if (mediaIds.length > 0) {
      const mediaCount = await Media.countDocuments({
        _id: { $in: mediaIds },
        owner: authorId,
        isActive: true,
        status: 'ready',
      });

      if (mediaCount !== mediaIds.length) {
        throw ApiError.badRequest('Invalid media IDs provided');
      }

      await Media.updateMany(
        { _id: { $in: mediaIds } },
        { $set: { isUsed: true, tweet: tweetId } }
      );

      tweet.mediaIds = mediaIds;
    }

    // Update content, mentions, and hashtags
    if (content !== undefined) {
      tweet.content = content;
      tweet.mentions = await this.extractMentions(content);
      tweet.hashtags = this.extractHashtags(content);
    }

    await tweet.save();
    return this.getTweetById(tweet._id);
  }

  // Single Tweet
  async getTweetById(tweetId, currentUserId) {
    const tweet = await Tweet.findOne({ _id: tweetId, isActive: true })
      .populate('author', 'username displayName avatar isVerified')
      .populate('mentions', 'username displayName')
      .populate('mediaIds', 'type cloudinary.urls originalName altText size')
      .populate({
        path: 'originalTweet',
        populate: [
          { path: 'author', select: 'username displayName avatar isVerified' },
          { path: 'mentions', select: 'username displayName' },
          { path: 'mediaIds', select: 'type cloudinary.urls originalName altText size' },
        ],
      });

    if (!tweet) throw ApiError.notFound('Tweet not found');

    // ✅ Get interaction flags for this single tweet
    const { likes, retweets } = await this.getUserInteractionFlags(currentUserId, [tweet]);

    const formattedTweet = this.formatTweet(tweet);

    // ✅ Add interaction flags
    const targetTweetId =
      tweet.type === 'retweet' && tweet.originalTweet
        ? tweet.originalTweet._id.toString()
        : tweet._id.toString();

    formattedTweet.isLiked = likes.has(targetTweetId);
    formattedTweet.isRetweeted = retweets.has(targetTweetId);

    return formattedTweet;
  }

  // Get Home timeline
  async getHomeTimeline(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Get following list
    const following = await Follow.find({ follower: userId }).select('following');
    const followingIds = following.map((f) => f.following);
    const userIds = [...followingIds, userId]; // Include own tweets

    // Simple timeline query (following + own tweets only)
    const timelineQuery = {
      author: { $in: userIds },
      isActive: true,
    };

    // Get tweets with population
    const [tweets, total] = await Promise.all([
      Tweet.find(timelineQuery)
        .populate('author', 'username displayName avatar isVerified')
        .populate('mentions', 'username displayName')
        .populate('mediaIds', 'type cloudinary.urls originalName altText')
        .populate({
          path: 'originalTweet',
          populate: [
            { path: 'author', select: 'username displayName avatar isVerified' },
            { path: 'mentions', select: 'username displayName' },
            { path: 'mediaIds', select: 'type cloudinary.urls originalName altText' },
          ],
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Tweet.countDocuments(timelineQuery),
    ]);

    // ✅ Get user interaction flags using helper method (consistent with other methods)
    const { likes, retweets } = await this.getUserInteractionFlags(userId, tweets);

    // Format tweets with interaction flags
    const formattedTweets = tweets
      .map((tweet) => {
        try {
          const formattedTweet = this.formatTweet(tweet);
          if (!formattedTweet) return null;

          // ✅ Add interaction flags
          const tweetId =
            tweet.type === 'retweet' && tweet.originalTweet
              ? tweet.originalTweet._id.toString()
              : tweet._id.toString();

          formattedTweet.isLiked = likes.has(tweetId);
          formattedTweet.isRetweeted = retweets.has(tweetId);

          return formattedTweet;
        } catch (error) {
          console.error(`Error formatting tweet ${tweet._id}:`, error.message);
          return null;
        }
      })
      .filter(Boolean); // Remove null entries

    return {
      tweets: formattedTweets,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Delete tweet (with media)
  async deleteTweet(tweetId, authorId) {
    const tweet = await Tweet.findById(tweetId).populate('mediaIds');

    if (!tweet || !tweet.author.equals(authorId)) {
      throw ApiError.forbidden('Cannot delete tweet');
    }

    // Permanently delete media
    for (const media of tweet.mediaIds) {
      try {
        const resourceType = media.type === 'video' ? 'video' : 'image';
        await cloudinary.uploader.destroy(media.cloudinary.publicId, {
          resource_type: resourceType,
        });
        await Media.findByIdAndDelete(media._id);
      } catch (error) {
        logger.error(`Failed to delete media ${media._id}: ${error.message}`);
      }
    }

    await Tweet.findByIdAndUpdate(tweetId, { isActive: false });
    await User.findByIdAndUpdate(authorId, { $inc: { tweetsCount: -1 } });
  }

  // User tweets
  async getUserTweets(targetUserId, currentUserId, page = 1, limit = 20, includeReplies = false) {
    const skip = (page - 1) * limit;

    try {
      const [tweets, total] = await Promise.all([
        Tweet.find({
          author: targetUserId,
          isActive: true,
        })
          .populate('author', 'username displayName avatar isVerified')
          .populate('mentions', 'username displayName')
          .populate('mediaIds', 'type cloudinary.urls originalName altText')
          .populate({
            path: 'originalTweet',
            populate: [
              { path: 'author', select: 'username displayName avatar isVerified' },
              { path: 'mentions', select: 'username displayName' },
              { path: 'mediaIds', select: 'type cloudinary.urls originalName altText' },
            ],
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Tweet.countDocuments({ author: targetUserId, isActive: true }),
      ]);

      // ✅ Get user interaction flags
      const { likes, retweets } = await this.getUserInteractionFlags(currentUserId, tweets);

      // Format tweets with interaction flags
      const formattedTweets = tweets
        .map((tweet) => {
          try {
            const formattedTweet = this.formatTweet(tweet);
            if (!formattedTweet) return null;

            // ✅ Add interaction flags
            const tweetId =
              tweet.type === 'retweet' && tweet.originalTweet
                ? tweet.originalTweet._id.toString()
                : tweet._id.toString();

            formattedTweet.isLiked = likes.has(tweetId);
            formattedTweet.isRetweeted = retweets.has(tweetId);

            return formattedTweet;
          } catch (error) {
            console.error(`Error formatting tweet ${tweet._id}:`, error.message);
            return null;
          }
        })
        .filter(Boolean);

      return {
        tweets: formattedTweets,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      console.error('Error in getUserTweets:', error);
      throw error;
    }
  }

  // Get user mentions
  async getUserMentions(targetUserId, currentUserId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    try {
      // Find tweets where the target user is mentioned
      const [tweets, total] = await Promise.all([
        Tweet.find({
          mentions: targetUserId, // ✅ User was mentioned in these tweets
          isActive: true,
        })
          .populate('author', 'username displayName avatar isVerified')
          .populate('mentions', 'username displayName')
          .populate('mediaIds', 'type cloudinary.urls originalName altText')
          .populate({
            path: 'originalTweet',
            populate: [
              { path: 'author', select: 'username displayName avatar isVerified' },
              { path: 'mentions', select: 'username displayName' },
              { path: 'mediaIds', select: 'type cloudinary.urls originalName altText' },
            ],
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Tweet.countDocuments({
          mentions: targetUserId,
          isActive: true,
        }),
      ]);

      // ✅ Get user interaction flags (isLiked, isRetweeted)
      const { likes, retweets } = await this.getUserInteractionFlags(currentUserId, tweets);

      const formattedTweets = tweets
        .map((tweet) => {
          try {
            const formattedTweet = this.formatTweet(tweet);
            if (!formattedTweet) return null;

            // ✅ Add interaction flags
            const tweetId =
              tweet.type === 'retweet' && tweet.originalTweet
                ? tweet.originalTweet._id.toString()
                : tweet._id.toString();

            formattedTweet.isLiked = likes.has(tweetId);
            formattedTweet.isRetweeted = retweets.has(tweetId);

            // ✅ Add mention context
            formattedTweet.mentionContext = {
              mentionedUser: targetUserId,
              mentionType: 'mentioned_in_tweet',
            };

            return formattedTweet;
          } catch (error) {
            console.error(`Error formatting mention ${tweet._id}:`, error.message);
            return null;
          }
        })
        .filter(Boolean);

      return {
        tweets: formattedTweets,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      console.error('Error in getUserMentions:', error);
      throw error;
    }
  }

  // Get tweets by hashtag
  async getTweetsByHashtag(hashtag, userId, page = 1, limit = 20, sort = 'latest') {
    const skip = (page - 1) * limit;

    // Build hashtag query
    const hashtagQuery = {
      hashtags: { $in: [hashtag.toLowerCase()] },
      isActive: true,
      type: 'original', // Only original tweets, not retweets
    };

    // Define sort options
    let sortQuery;
    switch (sort) {
      case 'popular':
        sortQuery = { engagementScore: -1, createdAt: -1 };
        break;
      case 'latest':
      default:
        sortQuery = { createdAt: -1 };
        break;
    }

    // Get tweets with population
    const [tweets, total] = await Promise.all([
      Tweet.find(hashtagQuery)
        .populate('author', 'username displayName avatar isVerified')
        .populate('mentions', 'username displayName')
        .populate('mediaIds', 'type cloudinary.urls originalName altText')
        .populate({
          path: 'originalTweet',
          populate: [
            { path: 'author', select: 'username displayName avatar isVerified' },
            { path: 'mentions', select: 'username displayName' },
            { path: 'mediaIds', select: 'type cloudinary.urls originalName altText' },
          ],
        })
        .sort(sortQuery)
        .skip(skip)
        .limit(limit),
      Tweet.countDocuments(hashtagQuery),
    ]);

    // ✅ Get user interaction flags using helper method
    const { likes, retweets } = await this.getUserInteractionFlags(userId, tweets);

    // Format tweets with interaction flags
    const formattedTweets = tweets
      .map((tweet) => {
        try {
          const formattedTweet = this.formatTweet(tweet);
          if (!formattedTweet) return null;

          // ✅ Add interaction flags
          const tweetId =
            tweet.type === 'retweet' && tweet.originalTweet
              ? tweet.originalTweet._id.toString()
              : tweet._id.toString();

          formattedTweet.isLiked = likes.has(tweetId);
          formattedTweet.isRetweeted = retweets.has(tweetId);

          return formattedTweet;
        } catch (error) {
          console.error(`Error formatting tweet ${tweet._id}:`, error.message);
          return null;
        }
      })
      .filter(Boolean);

    return {
      tweets: formattedTweets,
      hashtag: hashtag,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Like/Unlike
  async toggleLike(tweetId, userId) {
    const tweet = await Tweet.findOne({ _id: tweetId, isActive: true });
    if (!tweet) {
      throw ApiError.notFound('Tweet not found or has been deleted');
    }

    const existingLike = await Like.findOne({ tweet: tweetId, user: userId });

    if (existingLike) {
      await Like.findByIdAndDelete(existingLike._id);
      await Tweet.findByIdAndUpdate(tweetId, { $inc: { likesCount: -1 } });
      return { liked: false, tweetId: tweet._id };
    } else {
      await Like.create({ tweet: tweetId, user: userId });
      await Tweet.findByIdAndUpdate(tweetId, { $inc: { likesCount: 1 } });
      return { liked: true, tweetId: tweet._id };
    }
  }

  // toogle Retweet
  async toggleRetweet(tweetId, userId) {
    const originalTweet = await Tweet.findOne({ _id: tweetId, isActive: true });

    if (!originalTweet) {
      throw ApiError.notFound('Tweet not found or has been deleted');
    }

    if (originalTweet.author.equals(userId)) {
      throw ApiError.badRequest('Cannot retweet your own tweet');
    }

    const existingRetweet = await Tweet.findOne({
      author: userId,
      originalTweet: originalTweet._id,
      type: 'retweet',
      isActive: true,
    });

    if (existingRetweet) {
      // Remove retweet (unretweet)
      await Tweet.findByIdAndUpdate(existingRetweet._id, { isActive: false });

      // Update original tweet's retweet count and get the updated count
      const updatedTweet = await Tweet.findByIdAndUpdate(
        originalTweet._id,
        { $inc: { retweetsCount: -1 } },
        { new: true } // Return updated document
      );

      return {
        tweetId: originalTweet._id.toString(),
        isRetweeted: false,
        action: 'unretweet',
        retweetCount: updatedTweet.retweetsCount,
      };
    } else {
      // Create retweet
      await Tweet.create({
        author: userId,
        type: 'retweet',
        originalTweet: originalTweet._id,
        content: '',
        mediaIds: [],
      });

      // Update original tweet's retweet count and get the updated count
      const updatedTweet = await Tweet.findByIdAndUpdate(
        originalTweet._id,
        { $inc: { retweetsCount: 1 } },
        { new: true } // Return updated document
      );

      return {
        tweetId: originalTweet._id.toString(),
        isRetweeted: true,
        action: 'retweet',
        retweetCount: updatedTweet.retweetsCount,
      };
    }
  }

  // Trending Tweets
  async getTrendingHashtags(page = 1, limit = 20, timeframe = '24h') {
    const skip = (page - 1) * limit;

    // Time filtering (optional)
    const timeRanges = {
      '1h': 1 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };
    const since = new Date(Date.now() - timeRanges[timeframe]);

    // Simple aggregation pipeline
    const hashtags = await Tweet.aggregate([
      {
        $match: {
          isActive: true,
          type: 'original',
          createdAt: { $gte: since },
        },
      },
      { $unwind: '$hashtags' }, // Split hashtag arrays
      {
        $group: {
          _id: '$hashtags', // Group by hashtag name
          count: { $sum: 1 }, // Count occurrences
        },
      },
      { $sort: { count: -1 } }, // Sort by count (highest first)
      { $skip: skip }, // Pagination
      { $limit: limit }, // Limit results
      {
        $project: {
          _id: 0, // Remove _id
          hashtag: '$_id', // Rename _id to hashtag
          count: 1, // Keep count
        },
      },
    ]);

    return hashtags;
  }

  // // Media Tab - Get user tweets that contain media
  // async getUserMedia(targetUserId, currentUserId, page = 1, limit = 20) {
  //   const skip = (page - 1) * limit;

  //   try {
  //     const [tweets, total] = await Promise.all([
  //       Tweet.find({
  //         author: targetUserId,
  //         isActive: true,
  //         mediaIds: { $exists: true, $not: { $size: 0 } }, // ✅ Must have media
  //       })
  //         .populate('author', 'username displayName avatar isVerified')
  //         .populate('mentions', 'username displayName')
  //         .populate('mediaIds', 'type cloudinary.urls originalName altText')
  //         .populate({
  //           path: 'originalTweet',
  //           populate: [
  //             { path: 'author', select: 'username displayName avatar isVerified' },
  //             { path: 'mentions', select: 'username displayName' },
  //             { path: 'mediaIds', select: 'type cloudinary.urls originalName altText' },
  //           ],
  //         })
  //         .sort({ createdAt: -1 })
  //         .skip(skip)
  //         .limit(limit),
  //       Tweet.countDocuments({
  //         author: targetUserId,
  //         isActive: true,
  //         mediaIds: { $exists: true, $not: { $size: 0 } },
  //       }),
  //     ]);

  //     // Get interaction flags
  //     const { likes, retweets } = await this.getUserInteractionFlags(currentUserId, tweets);

  //     const formattedTweets = tweets
  //       .map((tweet) => {
  //         try {
  //           const formattedTweet = this.formatTweet(tweet);
  //           if (!formattedTweet) return null;

  //           const tweetId =
  //             tweet.type === 'retweet' && tweet.originalTweet
  //               ? tweet.originalTweet._id.toString()
  //               : tweet._id.toString();

  //           formattedTweet.isLiked = likes.has(tweetId);
  //           formattedTweet.isRetweeted = retweets.has(tweetId);

  //           return formattedTweet;
  //         } catch (error) {
  //           console.error(`Error formatting media tweet ${tweet._id}:`, error.message);
  //           return null;
  //         }
  //       })
  //       .filter(Boolean);

  //     return {
  //       tweets: formattedTweets,
  //       pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  //     };
  //   } catch (error) {
  //     console.error('Error in getUserMedia:', error);
  //     throw error;
  //   }
  // }

  // Get User media only without tweets
  async getUserMediaOnly(targetUserId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    try {
      // Find tweets with media by this user
      const tweets = await Tweet.find({
        author: targetUserId,
        isActive: true,
        mediaIds: { $exists: true, $not: { $size: 0 } }, // Must have media
      })
        .populate('mediaIds', 'type cloudinary.urls originalName altText')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // ✅ Extract only media items (flatten media from all tweets)
      const mediaItems = [];

      for (const tweet of tweets) {
        if (tweet.mediaIds && tweet.mediaIds.length > 0) {
          for (const media of tweet.mediaIds) {
            mediaItems.push({
              id: media._id,
              type: media.type,
              url: media.cloudinary?.urls?.original || '',
              thumbnail: media.cloudinary?.urls?.thumbnail || '',
              originalName: media.originalName || '',
              altText: media.altText || '',
              postId: tweet._id, // Reference to original post
              createdAt: tweet.createdAt, // When the post was created
            });
          }
        }
      }

      const total = await Tweet.countDocuments({
        author: targetUserId,
        isActive: true,
        mediaIds: { $exists: true, $not: { $size: 0 } },
      });

      return {
        media: mediaItems, // ✅ Only media data, not full tweets
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      console.error('Error in getUserMediaOnly:', error);
      throw error;
    }
  }

  // Likes Tab - Get tweets that user has liked
  async getUserLikes(targetUserId, currentUserId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    try {
      // Get user's likes with tweet details
      const [likes, total] = await Promise.all([
        Like.find({ user: targetUserId })
          .populate({
            path: 'tweet',
            match: { isActive: true },
            populate: [
              { path: 'author', select: 'username displayName avatar isVerified' },
              { path: 'mentions', select: 'username displayName' },
              { path: 'mediaIds', select: 'type cloudinary.urls originalName altText' },
              {
                path: 'originalTweet',
                populate: [
                  { path: 'author', select: 'username displayName avatar isVerified' },
                  { path: 'mentions', select: 'username displayName' },
                  { path: 'mediaIds', select: 'type cloudinary.urls originalName altText' },
                ],
              },
            ],
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Like.countDocuments({ user: targetUserId }),
      ]);

      // Filter out likes where tweet was deleted
      const validLikes = likes.filter((like) => like.tweet && like.tweet.isActive);
      const likedTweets = validLikes.map((like) => like.tweet);

      // Get interaction flags for current user
      const { likes: currentUserLikes, retweets } = await this.getUserInteractionFlags(
        currentUserId,
        likedTweets
      );

      const formattedTweets = likedTweets
        .map((tweet, index) => {
          try {
            const formattedTweet = this.formatTweet(tweet);
            if (!formattedTweet) return null;

            const tweetId =
              tweet.type === 'retweet' && tweet.originalTweet
                ? tweet.originalTweet._id.toString()
                : tweet._id.toString();

            // For likes tab, check if current user also liked it
            formattedTweet.isLiked = currentUserLikes.has(tweetId);
            formattedTweet.isRetweeted = retweets.has(tweetId);

            // ✅ Add info about who liked it and when
            formattedTweet.likedBy = {
              userId: targetUserId,
              likedAt: validLikes[index]?.createdAt,
            };

            return formattedTweet;
          } catch (error) {
            console.error(`Error formatting liked tweet ${tweet._id}:`, error.message);
            return null;
          }
        })
        .filter(Boolean);

      return {
        tweets: formattedTweets,
        pagination: {
          page,
          limit,
          total: validLikes.length,
          totalPages: Math.ceil(validLikes.length / limit),
        },
      };
    } catch (error) {
      console.error('Error in getUserLikes:', error);
      throw error;
    }
  }

  // Extract mentions from content
  async extractMentions(content, authorId) {
    if (!content) return [];

    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1].toLowerCase());
    }

    if (mentions.length === 0) return [];

    const users = await User.find({
      username: { $in: mentions },
      _id: { $ne: authorId }, // ✅ FIX: Exclude author from mentions
      isActive: true,
    }).select('_id');

    return users.map((user) => user._id);
  }

  // Search Tweets
  async searchTweets(query, userId, page = 1, limit = 20, sort = 'latest') {
    const skip = (page - 1) * limit;

    // Build search query
    const searchQuery = {
      isActive: true,
      type: 'original',
      $or: [
        { content: { $regex: query, $options: 'i' } },
        { hashtags: { $in: [query.toLowerCase()] } },
      ],
    };

    // Define sort options
    let sortQuery;
    switch (sort) {
      case 'popular':
        sortQuery = { engagementScore: -1, createdAt: -1 };
        break;
      case 'latest':
      default:
        sortQuery = { createdAt: -1 };
        break;
    }

    // Execute search with pagination
    const [tweets, total] = await Promise.all([
      Tweet.find(searchQuery)
        .populate('author', 'username displayName avatar isVerified')
        .populate('mentions', 'username displayName')
        .populate('mediaIds', 'type cloudinary.urls originalName altText')
        .populate({
          path: 'originalTweet',
          populate: [
            { path: 'author', select: 'username displayName avatar isVerified' },
            { path: 'mentions', select: 'username displayName' },
            { path: 'mediaIds', select: 'type cloudinary.urls originalName altText' },
          ],
        })
        .sort(sortQuery)
        .skip(skip)
        .limit(limit),
      Tweet.countDocuments(searchQuery),
    ]);

    // ✅ Get user interaction flags
    const { likes, retweets } = await this.getUserInteractionFlags(userId, tweets);

    // Format tweets with interaction flags
    const formattedTweets = tweets
      .map((tweet) => {
        try {
          const formattedTweet = this.formatTweet(tweet);
          if (!formattedTweet) return null;

          // ✅ Add interaction flags
          const tweetId =
            tweet.type === 'retweet' && tweet.originalTweet
              ? tweet.originalTweet._id.toString()
              : tweet._id.toString();

          formattedTweet.isLiked = likes.has(tweetId);
          formattedTweet.isRetweeted = retweets.has(tweetId);

          return formattedTweet;
        } catch (error) {
          console.error(`Error formatting tweet ${tweet._id}:`, error.message);
          return null;
        }
      })
      .filter(Boolean);

    return {
      tweets: formattedTweets,
      query: query,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  // Extract hashtags from content
  extractHashtags(content) {
    if (!content) return [];

    const hashtagRegex = /#(\w+)/g;
    const hashtags = [];
    let match;

    while ((match = hashtagRegex.exec(content)) !== null) {
      hashtags.push(match[1].toLowerCase());
    }

    return [...new Set(hashtags)]; // Remove duplicates
  }

  // Helper Functio for flag
  async getUserInteractionFlags(userId, tweets) {
    if (!tweets || tweets.length === 0) return { likes: new Set(), retweets: new Set() };

    // ✅ FIX: Handle both original tweets and retweets properly
    const tweetIds = [];

    tweets.forEach((tweet) => {
      if (tweet.type === 'retweet' && tweet.originalTweet) {
        // For retweets, we need to check interactions on the ORIGINAL tweet
        tweetIds.push(tweet.originalTweet._id);
      } else {
        // For original tweets, use the tweet ID directly
        tweetIds.push(tweet._id);
      }
    });

    const [userLikes, userRetweets] = await Promise.all([
      // Check likes on the correct tweet IDs
      Like.find({ user: userId, tweet: { $in: tweetIds } }).select('tweet'),
      // Check if user retweeted these tweets
      Tweet.find({
        author: userId,
        type: 'retweet',
        originalTweet: { $in: tweetIds },
        isActive: true,
      }).select('originalTweet'),
    ]);

    const likedTweetIds = new Set(userLikes.map((like) => like.tweet.toString()));
    const retweetedTweetIds = new Set(userRetweets.map((rt) => rt.originalTweet.toString()));

    return { likes: likedTweetIds, retweets: retweetedTweetIds };
  }

  // Helper: Format tweet response
  formatTweet(tweet) {
    // Safety checks
    if (!tweet) {
      throw new Error('Tweet object is undefined');
    }

    if (!tweet.author) {
      console.warn(`Tweet ${tweet._id} has no author`);
      return null;
    }

    // ✅ Handle retweets with your proposed structure
    if (tweet.type === 'retweet' && tweet.originalTweet) {
      if (!tweet.originalTweet.author) {
        console.warn(`Original tweet ${tweet.originalTweet._id} has no author`);
        return null;
      }

      return {
        id: tweet._id, // Retweet ID
        type: 'retweet',
        retweetInfo: {
          retweetedBy: {
            id: tweet.author._id,
            username: tweet.author.username || '',
            displayName: tweet.author.displayName || '',
            avatar: tweet.author.avatar || '',
            isVerified: tweet.author.isVerified || false,
          },
          retweetedAt: tweet.createdAt,
        },
        originalTweet: {
          id: tweet.originalTweet._id,
          content: tweet.originalTweet.content || '',
          author: {
            id: tweet.originalTweet.author._id,
            username: tweet.originalTweet.author.username || '',
            displayName: tweet.originalTweet.author.displayName || '',
            avatar: tweet.originalTweet.author.avatar || '',
            isVerified: tweet.originalTweet.author.isVerified || false,
          },
          mentions: tweet.originalTweet.mentions || [],
          hashtags: tweet.originalTweet.hashtags || [],
          media:
            tweet.originalTweet.mediaIds
              ?.map((media) => {
                if (!media) return null;
                return {
                  id: media._id,
                  type: media.type,
                  url: media.cloudinary?.urls?.original || '',
                  thumbnail: media.cloudinary?.urls?.thumbnail || '',
                  originalName: media.originalName || '',
                  altText: media.altText || '',
                };
              })
              .filter(Boolean) || [],
          stats: {
            likes: tweet.originalTweet.likesCount || 0,
            retweets: tweet.originalTweet.retweetsCount || 0,
            comments: tweet.originalTweet.commentsCount || 0,
            replies: tweet.originalTweet.repliesCount || 0,
          },
          createdAt: tweet.originalTweet.createdAt,
          updatedAt: tweet.originalTweet.updatedAt,
        },
      };
    }

    // For original tweets, return normal structure
    return {
      id: tweet._id,
      content: tweet.content || '',
      type: tweet.type || 'original',
      author: {
        id: tweet.author._id,
        username: tweet.author.username || '',
        displayName: tweet.author.displayName || '',
        avatar: tweet.author.avatar || '',
        isVerified: tweet.author.isVerified || false,
      },
      mentions: tweet.mentions || [],
      hashtags: tweet.hashtags || [],
      media:
        tweet.mediaIds
          ?.map((media) => {
            if (!media) return null;
            return {
              id: media._id,
              type: media.type,
              url: media.cloudinary?.urls?.original || '',
              thumbnail: media.cloudinary?.urls?.thumbnail || '',
              originalName: media.originalName || '',
              altText: media.altText || '',
            };
          })
          .filter(Boolean) || [],
      stats: {
        likes: tweet.likesCount || 0,
        retweets: tweet.retweetsCount || 0,
        comments: tweet.commentsCount || 0,
        replies: tweet.repliesCount || 0,
      },
      createdAt: tweet.createdAt,
      updatedAt: tweet.updatedAt,
    };
  }
}

export const tweetService = new TweetService();
