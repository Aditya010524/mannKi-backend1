import mongoose from 'mongoose';

const tweetSchema = new mongoose.Schema(
  {
    // Tweet author
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Tweet author is required'],
    },

    // Tweet content - conditional validation
    content: {
      type: String,
      maxlength: [280, 'Tweet cannot exceed 280 characters'],
      trim: true,
    },

    // Tweet type
    type: {
      type: String,
      enum: ['original', 'retweet', 'quote'],
      default: 'original',
    },

    // For retweets and quotes - reference to original tweet
    originalTweet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tweet',
      default: null,
    },

    // Media attachments
    mediaIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media',
      },
    ],

    // Hashtags extracted from content
    hashtags: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],

    // Mentions extracted from content
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Engagement stats (updated by application logic)
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    retweetsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    repliesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Soft delete
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ===== MIDDLEWARE & VALIDATION =====

// Custom content validation based on tweet type
tweetSchema.pre('validate', function (next) {
  // Content is required for original tweets and quote tweets
  if (this.type === 'original' || this.type === 'quote') {
    if (!this.content || this.content.trim() === '') {
      return next(new Error('Tweet content is required'));
    }
  }

  // Content should be empty for retweets
  if (this.type === 'retweet') {
    this.content = ''; // Force empty content for retweets
  }

  next();
});

// ===== INDEXES FOR PERFORMANCE =====

// Essential indexes for your production app
tweetSchema.index({ author: 1, createdAt: -1 }); // User's tweets timeline
tweetSchema.index({ createdAt: -1 }); // Global timeline
tweetSchema.index({ hashtags: 1 }); // Hashtag discovery
tweetSchema.index({ mentions: 1 }); // User mentions
tweetSchema.index({ isActive: 1 }); // Active tweets filter
tweetSchema.index({ originalTweet: 1 }); // Retweets/quotes of a tweet

// ===== MIDDLEWARE =====

// Pre-save middleware to extract hashtags
tweetSchema.pre('save', function (next) {
  if (this.isModified('content') && this.content) {
    // Extract hashtags
    const hashtagRegex = /#(\w+)/g;
    const hashtags = [];
    let match;

    while ((match = hashtagRegex.exec(this.content)) !== null) {
      hashtags.push(match[1].toLowerCase());
    }

    this.hashtags = [...new Set(hashtags)]; // Remove duplicates

    // Note: Mentions extraction requires User lookup, handle in service layer
  }
  next();
});

// Prevent deletion of tweets with engagement (business rule)
tweetSchema.pre('deleteOne', { document: true }, function (next) {
  if (this.likesCount > 0 || this.retweetsCount > 0 || this.commentsCount > 0) {
    return next(
      new Error('Cannot delete tweet with existing engagement. Use soft delete instead.')
    );
  }
  next();
});

// ===== VIRTUALS =====

// Virtual for tweet age in human-readable format
tweetSchema.virtual('tweetAge').get(function () {
  const now = Date.now();
  const created = this.createdAt.getTime();
  const diffMs = now - created;

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return this.createdAt.toLocaleDateString();
});

// Virtual for full tweet URL
tweetSchema.virtual('tweetUrl').get(function () {
  return `/tweet/${this._id}`;
});

// Virtual to check if tweet is a retweet
tweetSchema.virtual('isRetweet').get(function () {
  return this.type === 'retweet' && this.originalTweet != null;
});

// Virtual to check if tweet is a quote tweet
tweetSchema.virtual('isQuote').get(function () {
  return this.type === 'quote' && this.originalTweet != null;
});

// Virtual for character count
tweetSchema.virtual('characterCount').get(function () {
  return this.content ? this.content.length : 0;
});

// Virtual for engagement score (for ranking algorithms)
tweetSchema.virtual('engagementScore').get(function () {
  return this.likesCount + this.retweetsCount * 2 + this.commentsCount * 3;
});

const Tweet = mongoose.model('Tweet', tweetSchema);

export default Tweet;
