import mongoose from 'mongoose';

const followSchema = new mongoose.Schema(
  {
    // User who is following
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Follower is required'],
    },

    // User being followed
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Following user is required'],
    },

    // Optional: muted flag if needed for frontend features
    // isMuted: {
    //   type: Boolean,
    //   default: false,
    // },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index to prevent duplicate follows
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Index for common queries
followSchema.index({ follower: 1 }); // Who the user is following
followSchema.index({ following: 1 }); // User's followers
followSchema.index({ createdAt: -1 }); // Recent follows

// Prevent self-follows
followSchema.pre('save', function (next) {
  if (this.follower.toString() === this.following.toString()) {
    return next(new Error('Users cannot follow themselves'));
  }
  next();
});

// Follow duration in human-readable format
followSchema.virtual('followDuration').get(function () {
  const days = Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Today';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
});

// Follow relationship summary for frontend
followSchema.virtual('relationshipSummary').get(function () {
  return this.isMuted ? 'Following (muted)' : 'Following';
});

const Follow = mongoose.model('Follow', followSchema);

export default Follow;
