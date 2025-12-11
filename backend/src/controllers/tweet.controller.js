import { tweetService } from '../services/tweet.service.js';
import { commentService } from '../services/comment.service.js'; // ✅ New service
import { mediaService } from '../services/media.service.js';
import asyncHandler from '../utils/async-handler.js';
import ApiResponse from '../utils/api-response.js';
import ApiError from '../utils/api-error.js';
import { Comment, Tweet } from '../models/index.js';
import notifService from '../services/notification.service.js';
import mongoose from 'mongoose';

class TweetController {
  // Create tweet (handles content, media, mentions, hashtags)
  createTweet = asyncHandler(async (req, res) => {
    const userId = req.user._id.toString();
    const { content, altTexts } = req.body;
    const files = req.files || [];

    if (!content && files.length === 0) {
      throw ApiError.badRequest('Tweet must have content or media');
    }

    let mediaIds = [];
    if (files.length > 0) {
      let parsedAltTexts = [];
      if (altTexts) {
        try {
          parsedAltTexts = Array.isArray(altTexts) ? altTexts : JSON.parse(altTexts);
        } catch (error) {
          parsedAltTexts = [altTexts];
        }
      }

      const mediaResult = await mediaService.uploadMultipleMedia(files, userId, parsedAltTexts);
      mediaIds = mediaResult.media.map((media) => media._id);
    }

    const tweet = await tweetService.createTweet({
      author: userId,
      content: content || '',
      mediaIds,
    });

    // If tweet has mentions (tweetService may populate them), notify mentioned users
    try {
      if (tweet?.mentions && Array.isArray(tweet.mentions) && tweet.mentions.length > 0) {
        await notifService.createMentionNotifications({
          mentions: tweet.mentions,
          actorId: userId,
          tweetId: tweet._id,
        });
      }
    } catch (err) {
      console.warn('Failed to create mention notifications for tweet', err);
    }

    return ApiResponse.created(res, tweet, 'Tweet created successfully');
  });

  // Update tweet with media support
  updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const authorId = req.user._id;
    const { content, removeMedia, altTexts } = req.body;
    const files = req.files || [];

    let mediaIds = [];
    if (files.length > 0) {
      let parsedAltTexts = [];
      if (altTexts) {
        try {
          parsedAltTexts = Array.isArray(altTexts) ? altTexts : JSON.parse(altTexts);
        } catch (error) {
          parsedAltTexts = [altTexts];
        }
      }

      const mediaResult = await mediaService.uploadMultipleMedia(files, authorId, parsedAltTexts);
      mediaIds = mediaResult.media.map((media) => media._id);
    }

    const updateData = {
      content,
      mediaIds,
      removeMedia: removeMedia === 'true' || removeMedia === true,
    };

    const tweet = await tweetService.updateTweet(tweetId, authorId, updateData);
    return ApiResponse.success(res, tweet, 'Tweet updated successfully');
  });

  // Home timeline
  getHomeTimeline = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await tweetService.getHomeTimeline(userId, page, limit);
    return ApiResponse.paginated(res, result.tweets, result.pagination, 'Timeline retrieved');
  });

  // Single tweet
  getTweetById = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const currentUserId = req.user._id; // ✅ Current logged-in user

    const tweet = await tweetService.getTweetById(tweetId, currentUserId);

    return ApiResponse.success(res, tweet, 'Tweet retrieved successfully');
  });

  // Delete tweet
  deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    await tweetService.deleteTweet(tweetId, req.user._id);
    return ApiResponse.deleted(res, 'Tweet deleted');
  });

  // Like/Unlike
  toggleLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const userId = req.user._id;

    const result = await tweetService.toggleLike(tweetId, req.user._id);

    // Try to infer whether like was created or removed
    const liked = !!(
      result &&
      (result.liked === true || result.isLiked === true || result.action === 'liked')
    );

    try {
      if (liked) {
        await notifService.createLikeNotification({ tweetId, actorId: userId });
      } else {
        await notifService.removeLikeNotification({ tweetId, actorId: userId });
      }
    } catch (err) {
      console.warn('Failed to sync like notification', err);
    }

    return ApiResponse.success(res, result, 'Like updated');
  });

  // Retweet/Unretweet
  toggleRetweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const userId = req.user._id;

    const result = await tweetService.toggleRetweet(tweetId, userId);

    const isRetweeted = !!(
      result &&
      (result.isRetweeted === true ||
        result.retweeted === true ||
        result.action === 'retweeted')
    );

    // Create or remove retweet notification
    try {
      if (isRetweeted) {
        await notifService.createRetweetNotification({ tweetId, actorId: userId });
      } else {
        // remove simple retweet notification
        await notifService.removeSimpleNotification({
          recipientId: (await Tweet.findById(tweetId).select('author').lean())?.author,
          actorId: userId,
          type: 'retweet',
          targetType: 'tweet',
          targetId: tweetId,
        });
      }
    } catch (err) {
      console.warn('Failed to sync retweet notification', err);
    }

    const message = result.isRetweeted
      ? 'Tweet retweeted successfully'
      : 'Retweet removed successfully';

    return ApiResponse.success(res, result, message);
  });

  //  Get user tweets
  getUserTweets = asyncHandler(async (req, res) => {
    const { userId: targetUserId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user._id; // ✅ Current logged-in user

    const result = await tweetService.getUserTweets(
      targetUserId,
      currentUserId, // ✅ Pass current user ID
      parseInt(page),
      parseInt(limit)
    );

    return ApiResponse.success(res, result, 'User tweets retrieved successfully');
  });

  // Get user mentions (Notifications tab)
  getUserMentions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user._id; // ✅ Get current user ID from auth

    const result = await tweetService.getUserMentions(
      currentUserId, // ✅ Target user is the current user
      currentUserId, // ✅ Current user is the same (for isLiked flags)
      parseInt(page),
      parseInt(limit)
    );

    return ApiResponse.success(res, result, 'User mentions retrieved successfully');
  });

  //  Get tweets by hashtag (Discovery tab)
  getTweetsByHashtag = asyncHandler(async (req, res) => {
    const { hashtag } = req.params;
    const { page = 1, limit = 20, sort = 'latest' } = req.query;
    const userId = req.user._id; // ✅ Pass current user ID

    const result = await tweetService.getTweetsByHashtag(
      hashtag,
      userId, // ✅ Add userId parameter
      parseInt(page),
      parseInt(limit),
      sort
    );

    return ApiResponse.success(res, result, `Tweets with hashtag #${hashtag}`);
  });

  // ===== NEW COMMENT METHODS =====

  // Get tweet comments
  getTweetComments = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id; // ✅ Pass current user ID

    const result = await commentService.getTweetComments(
      tweetId,
      userId,
      parseInt(page),
      parseInt(limit)
    );

    return ApiResponse.success(res, result, 'Comments retrieved successfully');
  });

  // Create comment on tweet
  createComment = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const userId = req.user._id.toString();
    const { content, altTexts } = req.body;
    const files = req.files || [];

    if (!content && files.length === 0) {
      throw ApiError.badRequest('Comment must have content or media');
    }

    let mediaIds = [];
    if (files.length > 0) {
      let parsedAltTexts = [];
      if (altTexts) {
        try {
          parsedAltTexts = Array.isArray(altTexts) ? altTexts : JSON.parse(altTexts);
        } catch (error) {
          parsedAltTexts = [altTexts];
        }
      }

      const mediaResult = await mediaService.uploadMultipleMedia(files, userId, parsedAltTexts);
      mediaIds = mediaResult.media.map((media) => media._id);
    }

    const comment = await commentService.createComment({
      author: userId,
      tweet: tweetId,
      content: content || '',
      mediaIds,
    });

    // Create notifications: reply/comment to tweet owner + parent comment author (handled inside service)
    try {
      await notifService.createCommentNotifications({
        tweetId,
        commentId: comment.id, // ✅ use formatted id
        actorId: userId,
        parentCommentId: comment.parentComment || null,
      });

      // Mentions in comment
      if (comment?.mentions && Array.isArray(comment.mentions) && comment.mentions.length > 0) {
        await notifService.createMentionNotifications({
          mentions: comment.mentions,
          actorId: userId,
          tweetId,
          commentId: comment.id, // ✅ use formatted id
        });
      }
    } catch (err) {
      console.warn('Failed to create comment-related notifications', err);
    }

    return ApiResponse.created(res, comment, 'Comment created successfully');
  });

  // Reply to comment
  createReply = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user._id.toString();
    const { content, altTexts } = req.body;
    const files = req.files || [];

    if (!content && files.length === 0) {
      throw ApiError.badRequest('Reply must have content or media');
    }

    let mediaIds = [];
    if (files.length > 0) {
      let parsedAltTexts = [];
      if (altTexts) {
        try {
          parsedAltTexts = Array.isArray(altTexts) ? altTexts : JSON.parse(altTexts);
        } catch (error) {
          parsedAltTexts = [altTexts];
        }
      }

      const mediaResult = await mediaService.uploadMultipleMedia(files, userId, parsedAltTexts);
      mediaIds = mediaResult.media.map((media) => media._id);
    }

    const reply = await commentService.createReply({
      author: userId,
      parentComment: commentId,
      content: content || '',
      mediaIds,
    });

    // Create notifications for reply (parent comment author & tweet owner),
    // and mention notifications if any.
    try {
      await notifService.createCommentNotifications({
        tweetId: reply.postId, // ✅ this is the tweet id from formatComment
        commentId: reply.id,   // ✅ formatted id
        actorId: userId,
        parentCommentId: reply.parentComment || null,
      });

      if (reply?.mentions && Array.isArray(reply.mentions) && reply.mentions.length > 0) {
        await notifService.createMentionNotifications({
          mentions: reply.mentions,
          actorId: userId,
          tweetId: reply.postId, // ✅
          commentId: reply.id,   // ✅
        });
      }
    } catch (err) {
      console.warn('Failed to create reply-related notifications', err);
    }

    return ApiResponse.created(res, reply, 'Reply created successfully');
  });

  // Toggle comment like (aggregated for comments + replies)
  toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user._id;

    const result = await commentService.toggleCommentLike(commentId, userId);

    // determine liked state
    const liked = !!(
      result &&
      (result.liked === true || result.isLiked === true || result.action === 'liked')
    );

    try {
      if (liked) {
        // ✅ aggregated like notification for this comment
        await notifService.createCommentLikeNotification({
          commentId,
          actorId: userId,
        });
      } else {
        // ✅ remove from aggregated like notification
        await notifService.removeCommentLikeNotification({
          commentId,
          actorId: userId,
        });
      }
    } catch (err) {
      console.warn('Failed to sync comment-like notification', err);
    }

    return ApiResponse.success(res, result, 'Comment like updated');
  });

  // Delete comment
  deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user._id;

    await commentService.deleteComment(commentId, userId);
    return ApiResponse.deleted(res, 'Comment deleted successfully');
  });

  // Get comment replies
  getCommentReplies = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id; // ✅ Pass current user ID

    const result = await commentService.getCommentReplies(
      commentId,
      userId,
      parseInt(page),
      parseInt(limit)
    );

    return ApiResponse.success(res, result, 'Replies retrieved successfully');
  });

  // Toggle reply like (replies are also comments in DB) - aggregated too
  toggleReplyLike = asyncHandler(async (req, res) => {
    const { replyId } = req.params;
    const userId = req.user._id;

    // Verify it's actually a reply (has parentComment)
    const reply = await Comment.findOne({
      _id: replyId,
      isActive: true,
      parentComment: { $ne: null }, // Must be a reply
    });

    if (!reply) {
      throw ApiError.notFound('Reply not found or has been deleted');
    }

    const result = await commentService.toggleCommentLike(replyId, userId);

    const liked = !!(
      result &&
      (result.liked === true || result.isLiked === true || result.action === 'liked')
    );

    try {
      if (liked) {
        // ✅ aggregated like notification for reply (still targetType: 'comment')
        await notifService.createCommentLikeNotification({
          commentId: replyId,
          actorId: userId,
        });
      } else {
        await notifService.removeCommentLikeNotification({
          commentId: replyId,
          actorId: userId,
        });
      }
    } catch (err) {
      console.warn('Failed to sync reply-like notification', err);
    }

    const message = result.liked ? 'Reply liked successfully' : 'Reply unliked successfully';

    return ApiResponse.success(res, result, message);
  });

  // Delete reply
  deleteReply = asyncHandler(async (req, res) => {
    const { replyId } = req.params;
    const userId = req.user._id;

    // Verify it's actually a reply
    const reply = await Comment.findOne({
      _id: replyId,
      isActive: true,
      parentComment: { $ne: null }, // Must be a reply
    });

    if (!reply) {
      throw ApiError.notFound('Reply not found or has been deleted');
    }

    await commentService.deleteComment(replyId, userId);
    return ApiResponse.success(res, null, 'Reply deleted successfully');
  });

  // Search Tweets
  searchTweets = asyncHandler(async (req, res) => {
    const { q, page = 1, limit = 20, sort = 'latest' } = req.query;
    const userId = req.user._id; // ✅ Pass current user ID

    const result = await tweetService.searchTweets(
      q,
      userId, // ✅ Add userId parameter
      parseInt(page),
      parseInt(limit),
      sort
    );

    return ApiResponse.success(res, result, `Search results for "${q}"`);
  });

  // Get Trending Tweets
  getTrendingTweets = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, timeframe = '24h' } = req.query;

    const hashtags = await tweetService.getTrendingHashtags(
      parseInt(page),
      parseInt(limit),
      timeframe
    );

    return ApiResponse.success(res, hashtags, `Trending hashtags (${timeframe})`);
  });

  // Media Tab only media no tweets
  getUserMedia = asyncHandler(async (req, res) => {
    const { userId: targetUserId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await tweetService.getUserMediaOnly(
      targetUserId,
      parseInt(page),
      parseInt(limit)
    );

    return ApiResponse.success(res, result, 'User media retrieved successfully');
  });

  // Likes Tab Controller
  getUserLikes = asyncHandler(async (req, res) => {
    const { userId: targetUserId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user._id;

    const result = await tweetService.getUserLikes(
      targetUserId,
      currentUserId,
      parseInt(page),
      parseInt(limit)
    );

    return ApiResponse.success(res, result, 'User liked tweets retrieved successfully');
  });
}

export const tweetController = new TweetController();
