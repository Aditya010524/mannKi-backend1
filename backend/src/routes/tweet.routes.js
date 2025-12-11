// routes/tweet.routes.js
import express from 'express';
import { validate } from '../middleware/validation.middleware.js';
import { tweetController } from '../controllers/tweet.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import tweetValidation from '../validations/tweet.validation.js';
import { mediaUpload } from '../config/media-upload.config.js';

const router = express.Router();
router.use(authenticateUser);

// ===== CORE TWEET OPERATIONS =====
router.post(
  '/',
  mediaUpload.array('media', 4),
  validate(tweetValidation.createTweet),
  tweetController.createTweet
);

// ===== SPECIFIC ROUTES MUST COME FIRST =====
// ✅ FIX: Move all specific routes ABOVE parameterized routes

router.get(
  '/timeline',
  validate(tweetValidation.getTimeline, 'query'),
  tweetController.getHomeTimeline
);

router.get(
  '/mentions',
  validate(tweetValidation.getUserMentions, 'query'),
  tweetController.getUserMentions
);

// ✅ FIX: Move trending route ABOVE /:tweetId
router.get(
  '/trending',
  validate(tweetValidation.getTrending, 'query'),
  tweetController.getTrendingTweets
);

// ✅ FIX: Move search route ABOVE /:tweetId
router.get(
  '/search',
  validate(tweetValidation.searchTweets, 'query'),
  tweetController.searchTweets
);

// ===== PARAMETERIZED ROUTES COME AFTER SPECIFIC ROUTES =====
router.get(
  '/:tweetId',
  validate(tweetValidation.getTweetById, 'params'),
  tweetController.getTweetById
);

router.put(
  '/:tweetId',
  mediaUpload.array('media', 4),
  validate(tweetValidation.getTweetById, 'params'),
  validate(tweetValidation.updateTweetBody),
  tweetController.updateTweet
);

router.delete(
  '/:tweetId',
  validate(tweetValidation.getTweetById, 'params'),
  tweetController.deleteTweet
);

router.post(
  '/:tweetId/like',
  validate(tweetValidation.getTweetById, 'params'),
  tweetController.toggleLike
);

router.post(
  '/:tweetId/retweet',
  validate(tweetValidation.getTweetById, 'params'),
  tweetController.toggleRetweet
);

// ===== SPECIFIC PARAMETERIZED ROUTES =====
router.get(
  '/hashtag/:hashtag',
  validate(tweetValidation.getHashtagTweets, 'params'),
  validate(tweetValidation.getHashtagTweetsQuery, 'query'),
  tweetController.getTweetsByHashtag
);

router.get(
  '/user/:userId',
  validate(tweetValidation.getUserTweets, 'params'),
  validate(tweetValidation.getUserTweetsQuery, 'query'),
  tweetController.getUserTweets
);

// Get user media tweets (Twitter Media tab)
router.get(
  '/user/:userId/media',
  validate(tweetValidation.getUserTweets, 'params'),
  validate(tweetValidation.getUserTweetsQuery, 'query'),
  tweetController.getUserMedia
);

// Get user liked tweets (Twitter Likes tab)
router.get(
  '/user/:userId/likes',
  validate(tweetValidation.getUserTweets, 'params'),
  validate(tweetValidation.getUserTweetsQuery, 'query'),
  tweetController.getUserLikes
);

// ===== COMMENT ROUTES =====
router.get(
  '/:tweetId/comments',
  validate(tweetValidation.getTweetById, 'params'),
  validate(tweetValidation.getCommentsQuery, 'query'),
  tweetController.getTweetComments
);

router.post(
  '/:tweetId/comments',
  mediaUpload.array('media', 2),
  validate(tweetValidation.getTweetById, 'params'),
  validate(tweetValidation.createComment),
  tweetController.createComment
);

router.post(
  '/comments/:commentId/reply',
  mediaUpload.array('media', 2),
  validate(tweetValidation.getCommentById, 'params'),
  validate(tweetValidation.createComment),
  tweetController.createReply
);

router.post(
  '/comments/:commentId/like',
  validate(tweetValidation.getCommentById, 'params'),
  tweetController.toggleCommentLike
);

// Like/Unlike REPLY (replies to comments)
router.post(
  '/replies/:replyId/like',
  validate(tweetValidation.getReplyById, 'params'),
  tweetController.toggleReplyLike
);

router.delete(
  '/comments/:commentId',
  validate(tweetValidation.getCommentById, 'params'),
  tweetController.deleteComment
);

router.delete(
  '/replies/:replyId',
  validate(tweetValidation.getReplyById, 'params'),
  tweetController.deleteReply
);

router.get(
  '/comments/:commentId/replies',
  validate(tweetValidation.getCommentById, 'params'),
  validate(tweetValidation.getRepliesQuery, 'query'),
  tweetController.getCommentReplies
);

export default router;

//=============== SEARCH ==================
/*
# Search for text in content
GET /tweets/search?q=javascript&page=1&limit=10

# Search for hashtags
GET /tweets/search?q=coding&sort=popular

# Search with sorting
GET /tweets/search?q=nodejs&sort=latest&limit=5

# Paginated search
GET /tweets/search?q=react&page=2&limit=20

*/
