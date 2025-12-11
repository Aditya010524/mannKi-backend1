// models/notification.model.js
import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    // Recipient of the notification (owner of post/comment/etc.)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // The action type
    type: {
      type: String,
      required: true,
      enum: ['like', 'comment', 'reply', 'retweet', 'mention', 'follow', 'dm'],
    },

    // The user who performed the action (actor) - optional for aggregated items
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },

    // What was acted on: 'tweet', 'comment', 'user', etc.
    targetType: {
      type: String,
      required: true,
      enum: ['tweet', 'comment', 'user'],
    },

    // The specific target id (tweet id, comment id, user id)
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Aggregation fields (for like/retweet/follow)
    count: {
      type: Number,
      default: 0,
    },
    recentActors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Human-readable text to show in UI
    summary: {
      type: String,
      default: '',
    },

    // Small payload for display (snippet, actor handle, media flag, etc.)
    extra: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Whether recipient has read it (for simple read/unread logic)
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Optional: when it was read (useful if you later switch to lastReadAt pattern)
    readAt: {
      type: Date,
      default: null,
    },

    // If delivered to push / device
    delivered: {
      type: Boolean,
      default: false,
    },

    // Optional grouping key for aggregations (e.g., likes grouping)
    groupKey: {
      type: String,
      default: null,
      index: true,
    },

    // Soft-delete if ever needed
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ==========================================
// Indexes
// ==========================================

// Keep unique index to prevent duplicate simple notifications (actor-based)
// This is sparse so aggregated items without actorId won't be blocked.
NotificationSchema.index(
  { userId: 1, type: 1, actorId: 1, targetType: 1, targetId: 1 },
  { unique: true, sparse: true, name: 'unique_simple_notif' }
);

// Index for aggregated notifications per user + target (useful for upserts)
NotificationSchema.index(
  { userId: 1, type: 1, targetId: 1 },
  { name: 'user_type_target_idx' }
);

// For unread filter + sorting (use when listing only unread)
NotificationSchema.index(
  { userId: 1, read: 1, createdAt: -1 },
  { name: 'user_read_createdAt_idx' }
);

// For general notifications feed (all, read + unread) with pagination
NotificationSchema.index(
  { userId: 1, createdAt: -1 },
  { name: 'user_createdAt_idx' }
);

// For any global time-based cleanup/TTL
NotificationSchema.index(
  { createdAt: -1 },
  { name: 'createdAt_idx' }
);

const Notification = mongoose.model('Notification', NotificationSchema);
export default Notification;
