// models/comment-like.model.js
import mongoose from 'mongoose';

const commentLikeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Prevent duplicate comment likes
commentLikeSchema.index({ user: 1, comment: 1 }, { unique: true });
commentLikeSchema.index({ comment: 1, createdAt: -1 });
commentLikeSchema.index({ user: 1, createdAt: -1 });

const CommentLike = mongoose.model('CommentLike', commentLikeSchema);
export default CommentLike;
