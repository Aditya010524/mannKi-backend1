// models/like.model.js
import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tweet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tweet',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Prevent duplicate likes
likeSchema.index({ user: 1, tweet: 1 }, { unique: true });

// Index for getting tweet likes and user's liked tweets
likeSchema.index({ tweet: 1, createdAt: -1 });
likeSchema.index({ user: 1, createdAt: -1 });

const Like = mongoose.model('Like', likeSchema);
export default Like;
