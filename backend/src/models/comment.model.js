// models/comment.model.js
import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tweet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tweet',
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 280,
      trim: true,
    },
    // For nested replies (reply to a comment)
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    // Media in comments (optional)
    mediaIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media',
      },
    ],
    // Mentions in comments
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Hashtags in comments
    hashtags: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    // Engagement stats
    likesCount: {
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
  }
);

// Essential indexes
commentSchema.index({ tweet: 1, createdAt: -1 }); // Tweet's comments
commentSchema.index({ author: 1, createdAt: -1 }); // User's comments
commentSchema.index({ parentComment: 1, createdAt: -1 }); // Comment replies
commentSchema.index({ mentions: 1 }); // Comment mentions
commentSchema.index({ hashtags: 1 }); // Comment hashtags
commentSchema.index({ isActive: 1 });

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
