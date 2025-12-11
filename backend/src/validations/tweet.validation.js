import Joi from 'joi';

const tweetValidation = {
  // Create tweet validation
  createTweet: Joi.object({
    content: Joi.string().max(280).trim().allow('').optional().messages({
      'string.max': 'Tweet cannot exceed 280 characters',
    }),
    altTexts: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.string().max(1000).messages({
            'string.max': 'Alt text cannot exceed 1000 characters',
          })
        ),
        Joi.string().max(1000).messages({
          'string.max': 'Alt text cannot exceed 1000 characters',
        })
      )
      .optional(),
  }),

  // Update tweet body validation
  updateTweetBody: Joi.object({
    content: Joi.string().max(280).trim().allow('').optional().messages({
      'string.max': 'Tweet cannot exceed 280 characters',
    }),
    removeMedia: Joi.boolean().optional().messages({
      'boolean.base': 'removeMedia must be a boolean',
    }),
    altTexts: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.string().max(1000).messages({
            'string.max': 'Alt text cannot exceed 1000 characters',
          })
        ),
        Joi.string().max(1000).messages({
          'string.max': 'Alt text cannot exceed 1000 characters',
        })
      )
      .optional(),
  }),

  // Update tweet params validation
  updateTweet: Joi.object({
    tweetId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid tweet ID format',
        'any.required': 'Tweet ID is required',
      }),
  }),

  // Get tweet by ID validation
  getTweetById: Joi.object({
    tweetId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid tweet ID format',
        'any.required': 'Tweet ID is required',
      }),
  }),

  // Get user tweets params validation
  getUserTweets: Joi.object({
    userId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid user ID format',
        'any.required': 'User ID is required',
      }),
  }),

  // Get user tweets query validation
  getUserTweetsQuery: Joi.object({
    page: Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    includeReplies: Joi.boolean().default(false),
  }),

  // Timeline query validation
  getTimeline: Joi.object({
    page: Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    sort: Joi.string().valid('latest', 'trending', 'popular').default('latest'),
  }),

  // Hashtag tweets params validation
  getHashtagTweets: Joi.object({
    hashtag: Joi.string()
      .required()
      .min(1)
      .max(50)
      .pattern(/^[a-zA-Z0-9_]+$/)
      .messages({
        'string.pattern.base': 'Hashtag can only contain letters, numbers, and underscores',
        'any.required': 'Hashtag is required',
      }),
  }),

  // Hashtag tweets query validation
  getHashtagTweetsQuery: Joi.object({
    page: Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
  }),

  // Comments query validation
  getCommentsQuery: Joi.object({
    page: Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(20).default(10),
  }),

  // Create comment validation
  createComment: Joi.object({
    content: Joi.string().max(280).trim().allow('').optional().messages({
      'string.max': 'Comment cannot exceed 280 characters',
    }),
    altTexts: Joi.alternatives()
      .try(Joi.array().items(Joi.string().max(1000)), Joi.string().max(1000))
      .optional(),
  }),

  // Comment ID validation
  getCommentById: Joi.object({
    commentId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid comment ID format',
        'any.required': 'Comment ID is required',
      }),
  }),

  // Validation for reply ID
  getReplyById: Joi.object({
    replyId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid reply ID format',
        'any.required': 'Reply ID is required',
      }),
  }),

  // Replies query validation
  getRepliesQuery: Joi.object({
    page: Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(10).default(5),
  }),

  getUserMentions: Joi.object({
    page: Joi.number().integer().min(1).max(1000).default(1).messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
      'number.max': 'Page cannot exceed 1000',
    }),
    limit: Joi.number().integer().min(1).max(50).default(20).messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50',
    }),
  }),

  // ===== SEARCH TWEETS VALIDATION =====
  searchTweets: Joi.object({
    q: Joi.string().required().min(1).max(100).trim().messages({
      'string.empty': 'Search query cannot be empty',
      'string.min': 'Search query must be at least 1 character',
      'string.max': 'Search query cannot exceed 100 characters',
      'any.required': 'Search query is required',
    }),
    page: Joi.number().integer().min(1).max(100).default(1).messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
      'number.max': 'Page cannot exceed 100',
    }),
    limit: Joi.number().integer().min(1).max(50).default(20).messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50',
    }),
    sort: Joi.string().valid('latest', 'popular').default('latest').messages({
      'any.only': 'Sort must be latest or popular',
    }),
  }),

  // ===== TRENDING TWEETS VALIDATION =====
  getTrending: Joi.object({
    page: Joi.number().integer().min(1).max(1000).default(1).messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
      'number.max': 'Page cannot exceed 1000',
    }),
    limit: Joi.number().integer().min(1).max(50).default(20).messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50',
    }),
    timeframe: Joi.string().valid('1h', '24h', '7d').default('24h').messages({
      'any.only': 'Timeframe must be 1h, 24h, or 7d',
    }),
  }),
};

export default tweetValidation;
