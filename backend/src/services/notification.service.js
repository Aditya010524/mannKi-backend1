// src/services/notification.service.js
import mongoose from 'mongoose';
import Notification from '../models/notification.model.js';
import Tweet from '../models/tweet.model.js';
import Comment from '../models/comment.model.js';
import User from '../models/user.model.js';

/**
 * Format notification object for client consumption (basic formatting).
 */
function formatForClient(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    type: doc.type,
    actorId: doc.actorId ? doc.actorId.toString() : null,
    targetType: doc.targetType,
    targetId: doc.targetId ? doc.targetId.toString() : null,
    extra: doc.extra || {},
    read: !!doc.read,
    count: doc.count || 0,
    recentActors: doc.recentActors ? doc.recentActors.map((id) => id.toString()) : [],
    summary: doc.summary || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/* ------------------------------------------------
   Helpers to hydrate notifications for client
   ------------------------------------------------ */

/**
 * Build a mapping of userId -> user doc from notifications.
 * This lets us generate:
 * - actor name for summary
 * - actor avatar for UI
 */
async function buildActorMapFromNotifications(items = []) {
  const actorIds = new Set();

  for (const doc of items) {
    if (!doc) continue;

    if (doc.actorId) {
      actorIds.add(doc.actorId.toString());
    }

    if (Array.isArray(doc.recentActors)) {
      doc.recentActors.forEach((id) => id && actorIds.add(id.toString()));
    }

    if (doc.extra && doc.extra.followerId) {
      actorIds.add(doc.extra.followerId.toString());
    }
  }

  if (!actorIds.size) return {};

  const users = await User.find({ _id: { $in: [...actorIds] } })
    .select('displayName username avatar')
    .lean();

  const map = {};
  for (const u of users) {
    map[u._id.toString()] = u;
  }
  return map;
}

function getActorFromMap(id, actorMap) {
  if (!id) return null;
  return actorMap[id] || null;
}

/**
 * Take a raw Mongo doc, format it, and then:
 * - ensure recentActors has at least the main actor
 * - ensure count is >= 1 for simple (non-aggregated) notifications
 * - generate a summary when it's missing (retweet, follow, comment, etc.)
 * - attach primaryActor (id, displayName, username, avatar) for UI avatar
 */
function hydrateNotificationForClient(doc, actorMap = {}) {
  const base = formatForClient(doc);
  if (!base) return null;

  // Ensure recentActors has at least one actor when possible
  if ((!base.recentActors || base.recentActors.length === 0) && base.actorId) {
    base.recentActors = [base.actorId];
  }

  // Decide which actor is the "primary" / latest actor
  const actors = Array.isArray(base.recentActors) ? base.recentActors : [];
  const primaryActorId = actors.length > 0 ? actors[actors.length - 1] : base.actorId;

  const actorDoc = getActorFromMap(primaryActorId, actorMap);
  const actorName = actorDoc?.displayName || actorDoc?.username || 'Someone';

  // Attach primaryActor for UI (for avatar + display name)
  base.primaryActor = actorDoc
    ? {
        id: actorDoc._id.toString(),
        displayName: actorDoc.displayName,
        username: actorDoc.username,
        avatar: actorDoc.avatar || null,
      }
    : null;

  // If count is 0 for simple actions (non-aggregated), set to 1.
  // Aggregated likes already have count > 0 and summary in DB.
  if (base.count === 0) {
    base.count = 1;
  }

  // If summary already exists (e.g., aggregated likes like:
  // "Sunil, Suresh and 9 others liked your tweet/comment"), keep it as-is.
  if (base.summary && base.summary.trim().length > 0) {
    return base;
  }

  const { type, targetType } = base;

  // Generate a simple human readable summary based on type + targetType
  let summary = 'You have a new notification';

  switch (type) {
    case 'like':
      if (targetType === 'tweet') {
        summary = `${actorName} liked your tweet`;
      } else if (targetType === 'comment') {
        summary = `${actorName} liked your comment`;
      } else {
        summary = `${actorName} liked your post`;
      }
      break;

    case 'retweet':
      summary = `${actorName} retweeted your tweet`;
      break;

    case 'follow':
      summary = `${actorName} started following you`;
      break;

    case 'comment':
      if (targetType === 'tweet') {
        summary = `${actorName} commented on your tweet`;
      } else {
        summary = `${actorName} commented`;
      }
      break;

    case 'reply':
      summary = `${actorName} replied to your comment`;
      break;

    case 'mention':
      if (targetType === 'tweet') {
        summary = `${actorName} mentioned you in a tweet`;
      } else {
        summary = `${actorName} mentioned you in a comment`;
      }
      break;

    case 'dm':
      summary = `New message from ${actorName}`;
      break;

    default:
      summary = 'You have a new notification';
  }

  base.summary = summary;
  return base;
}

/* ----------------------------
   Simple / action notifications
   ---------------------------- */

/**
 * Upsert a simple per-actor notification (prevents duplicates).
 * Useful for follow, retweet (per-actor), etc.
 * (We won't use this for likes on tweets/comments now that they are aggregated.)
 */
export async function createOrUpdateSimpleNotification({
  recipientId,
  actorId,
  type,
  targetType,
  targetId,
  extra = {},
}) {
  if (!recipientId || !actorId) return null;
  if (recipientId.toString() === actorId.toString()) return null; // don't notify self

  const query = {
    userId: recipientId,
    type,
    actorId,
    targetType,
    targetId,
  };

  const update = {
    $set: {
      actorId,
      extra,
      read: false,
      isActive: true,
      updatedAt: new Date(),
    },
    $setOnInsert: {
      createdAt: new Date(),
      count: 1,
      recentActors: [actorId],
    },
  };

  const opts = {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    lean: true,
  };

  const notifDoc = await Notification.findOneAndUpdate(query, update, opts);

  // For existing doc, ensure count & recentActors make sense
  if (notifDoc) {
    if (!notifDoc.count || notifDoc.count < 1) {
      notifDoc.count = 1;
    }
    if (!Array.isArray(notifDoc.recentActors) || notifDoc.recentActors.length === 0) {
      notifDoc.recentActors = [actorId];
    }
  }

  return notifDoc ? formatForClient(notifDoc) : null;
}

/**
 * Create a persistent notification (always insert).
 * Useful for comments, replies, mentions.
 */
export async function createActionNotification({
  recipientId,
  actorId,
  type,
  targetType,
  targetId,
  extra = {},
}) {
  if (!recipientId || !actorId) return null;
  if (recipientId.toString() === actorId.toString()) return null;

  const doc = await Notification.create({
    userId: recipientId,
    actorId,
    type,
    targetType,
    targetId,
    extra,
    read: false,
    isActive: true,
    count: 1,
    recentActors: [actorId],
  });

  return formatForClient(doc);
}

/**
 * Remove a per-actor simple notification (e.g., unlike -> delete)
 */
export async function removeSimpleNotification({
  recipientId,
  actorId,
  type,
  targetType,
  targetId,
}) {
  if (!recipientId || !actorId) return null;
  await Notification.deleteOne({ userId: recipientId, actorId, type, targetType, targetId });
  return true;
}

/* ----------------------------
   Aggregated likes (for tweets)
   ---------------------------- */

/**
 * Upsert an aggregated "like" notification for the tweet owner.
 * Keeps `count`, `recentActors` (maxRecent) and `summary`.
 * Note: call this only when a new like is created.
 */
export async function upsertAggregatedLike({ tweetId, actorId }) {
  if (!tweetId || !actorId) return null;

  const tweet = await Tweet.findById(tweetId).select('author content').lean();
  if (!tweet) return null;
  const recipientId = tweet.author?.toString();
  if (!recipientId || recipientId === actorId.toString()) return null;

  const maxRecent = 3;

  // Upsert base doc (if not exists)
  const base = await Notification.findOneAndUpdate(
    { userId: recipientId, type: 'like', targetType: 'tweet', targetId: tweetId },
    {
      $setOnInsert: {
        userId: recipientId,
        type: 'like',
        targetType: 'tweet',
        targetId: tweetId,
        extra: { snippet: tweet.content?.slice(0, 140) || '' },
        isActive: true,
        createdAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
  );

  // Increment count and push actor
  await Notification.findByIdAndUpdate(base._id, {
    $inc: { count: 1 },
    $push: { recentActors: actorId },
    $set: {
      read: false,
      'extra.snippet': tweet.content?.slice(0, 140) || '',
      updatedAt: new Date(),
    },
  });

  // Fetch updated doc and clean recentActors (dedupe newest-first and keep maxRecent)
  const updated = await Notification.findById(base._id).lean();
  const actors = Array.isArray(updated.recentActors)
    ? [...updated.recentActors].reverse()
    : [];
  const seen = new Set();
  const cleaned = [];
  for (const a of actors) {
    const s = a.toString();
    if (!seen.has(s)) {
      cleaned.push(a);
      seen.add(s);
    }
    if (cleaned.length >= maxRecent) break;
  }
  const recentActorsToStore = [...cleaned].reverse(); // persist oldest->newest

  await Notification.findByIdAndUpdate(base._id, {
    $set: { recentActors: recentActorsToStore },
  });

  // Re-read doc to build summary
  const final = await Notification.findById(base._id).lean();
  const recentIds = (final.recentActors || []).slice(-maxRecent);

  let summary = '';
  if (recentIds.length > 0) {
    const actorsDocs = await User.find({ _id: { $in: recentIds } })
      .select('displayName username')
      .lean();
    const ordered = recentIds.map((id) =>
      actorsDocs.find((a) => a._id.toString() === id.toString())
    );
    const names = ordered
      .map((a) => (a ? a.displayName || a.username : 'Someone'))
      .filter(Boolean);
    const cnt = final.count || 0;
    summary =
      names.length === 1
        ? `${names[0]} liked your tweet`
        : `${names.join(', ')} and ${Math.max(
            0,
            cnt - names.length
          )} others liked your tweet`;
  } else {
    summary = 'Someone liked your tweet';
  }

  await Notification.findByIdAndUpdate(final._id, { $set: { summary } });

  const result = await Notification.findById(final._id).lean();
  return formatForClient(result);
}

/**
 * Remove an aggregated like (on unlike) for tweets
 */
export async function removeAggregatedLike({ tweetId, actorId }) {
  if (!tweetId || !actorId) return null;

  const tweet = await Tweet.findById(tweetId).select('author').lean();
  if (!tweet) return null;
  const recipientId = tweet.author?.toString();
  if (!recipientId) return null;

  const notif = await Notification.findOne({
    userId: recipientId,
    type: 'like',
    targetType: 'tweet',
    targetId: tweetId,
  }).lean();
  if (!notif) return null;

  const newCount = Math.max(0, (notif.count || 1) - 1);

  if (newCount === 0) {
    await Notification.deleteOne({ _id: notif._id });
    return null;
  }

  // Decrement and remove actor from recentActors
  await Notification.findByIdAndUpdate(notif._id, {
    $inc: { count: -1 },
    $pull: { recentActors: actorId },
    $set: { updatedAt: new Date() },
  });

  // Recompute summary
  const updated = await Notification.findById(notif._id).lean();
  const recentIds = (updated.recentActors || []).slice(-3);
  const actorsDocs = await User.find({ _id: { $in: recentIds } })
    .select('displayName username')
    .lean();
  const ordered = recentIds.map((id) =>
    actorsDocs.find((a) => a._id.toString() === id.toString())
  );
  const names = ordered
    .map((a) => (a ? a.displayName || a.username : 'Someone'))
    .filter(Boolean);
  const summary =
    names.length === 1
      ? `${names[0]} liked your tweet`
      : `${names.join(', ')} and ${Math.max(
          0,
          updated.count - names.length
        )} others liked your tweet`;

  await Notification.findByIdAndUpdate(notif._id, { $set: { summary } });

  const final = await Notification.findById(notif._id).lean();
  return formatForClient(final);
}

/* ----------------------------
   Aggregated likes (for comments) - NEW
   ---------------------------- */

/**
 * Upsert an aggregated "like" notification for the comment owner.
 * Similar to tweet likes but with "liked your comment".
 */
export async function upsertAggregatedCommentLike({ commentId, actorId }) {
  if (!commentId || !actorId) return null;

  const comment = await Comment.findById(commentId)
    .select('author content')
    .lean();
  if (!comment) return null;

  const recipientId = comment.author?.toString();
  if (!recipientId || recipientId === actorId.toString()) return null;

  const maxRecent = 3;

  // Upsert base doc (if not exists)
  const base = await Notification.findOneAndUpdate(
    { userId: recipientId, type: 'like', targetType: 'comment', targetId: commentId },
    {
      $setOnInsert: {
        userId: recipientId,
        type: 'like',
        targetType: 'comment',
        targetId: commentId,
        extra: { snippet: comment.content?.slice(0, 140) || '' },
        isActive: true,
        createdAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
  );

  // Increment count and push actor
  await Notification.findByIdAndUpdate(base._id, {
    $inc: { count: 1 },
    $push: { recentActors: actorId },
    $set: {
      read: false,
      'extra.snippet': comment.content?.slice(0, 140) || '',
      updatedAt: new Date(),
    },
  });

  // Fetch updated doc and clean recentActors (dedupe newest-first and keep maxRecent)
  const updated = await Notification.findById(base._id).lean();
  const actors = Array.isArray(updated.recentActors)
    ? [...updated.recentActors].reverse()
    : [];
  const seen = new Set();
  const cleaned = [];
  for (const a of actors) {
    const s = a.toString();
    if (!seen.has(s)) {
      cleaned.push(a);
      seen.add(s);
    }
    if (cleaned.length >= maxRecent) break;
  }
  const recentActorsToStore = [...cleaned].reverse(); // persist oldest->newest

  await Notification.findByIdAndUpdate(base._id, {
    $set: { recentActors: recentActorsToStore },
  });

  // Re-read doc to build summary
  const final = await Notification.findById(base._id).lean();
  const recentIds = (final.recentActors || []).slice(-maxRecent);

  let summary = '';
  if (recentIds.length > 0) {
    const actorsDocs = await User.find({ _id: { $in: recentIds } })
      .select('displayName username')
      .lean();
    const ordered = recentIds.map((id) =>
      actorsDocs.find((a) => a._id.toString() === id.toString())
    );
    const names = ordered
      .map((a) => (a ? a.displayName || a.username : 'Someone'))
      .filter(Boolean);
    const cnt = final.count || 0;
    summary =
      names.length === 1
        ? `${names[0]} liked your comment`
        : `${names.join(', ')} and ${Math.max(
            0,
            cnt - names.length
          )} others liked your comment`;
  } else {
    summary = 'Someone liked your comment';
  }

  await Notification.findByIdAndUpdate(final._id, { $set: { summary } });

  const result = await Notification.findById(final._id).lean();
  return formatForClient(result);
}

/**
 * Remove an aggregated like (on unlike) for comments
 */
export async function removeAggregatedCommentLike({ commentId, actorId }) {
  if (!commentId || !actorId) return null;

  const comment = await Comment.findById(commentId).select('author').lean();
  if (!comment) return null;
  const recipientId = comment.author?.toString();
  if (!recipientId) return null;

  const notif = await Notification.findOne({
    userId: recipientId,
    type: 'like',
    targetType: 'comment',
    targetId: commentId,
  }).lean();
  if (!notif) return null;

  const newCount = Math.max(0, (notif.count || 1) - 1);

  if (newCount === 0) {
    await Notification.deleteOne({ _id: notif._id });
    return null;
  }

  // Decrement and remove actor from recentActors
  await Notification.findByIdAndUpdate(notif._id, {
    $inc: { count: -1 },
    $pull: { recentActors: actorId },
    $set: { updatedAt: new Date() },
  });

  // Recompute summary
  const updated = await Notification.findById(notif._id).lean();
  const recentIds = (updated.recentActors || []).slice(-3);
  const actorsDocs = await User.find({ _id: { $in: recentIds } })
    .select('displayName username')
    .lean();
  const ordered = recentIds.map((id) =>
    actorsDocs.find((a) => a._id.toString() === id.toString())
  );
  const names = ordered
    .map((a) => (a ? a.displayName || a.username : 'Someone'))
    .filter(Boolean);
  const summary =
    names.length === 1
      ? `${names[0]} liked your comment`
      : `${names.join(', ')} and ${Math.max(
          0,
          updated.count - names.length
        )} others liked your comment`;

  await Notification.findByIdAndUpdate(notif._id, { $set: { summary } });

  const final = await Notification.findById(notif._id).lean();
  return formatForClient(final);
}

/* ----------------------------
   Convenience wrappers
   ---------------------------- */

export async function createLikeNotification({ tweetId, actorId }) {
  return upsertAggregatedLike({ tweetId, actorId });
}

export async function removeLikeNotification({ tweetId, actorId }) {
  return removeAggregatedLike({ tweetId, actorId });
}

export async function createCommentLikeNotification({ commentId, actorId }) {
  return upsertAggregatedCommentLike({ commentId, actorId });
}

export async function removeCommentLikeNotification({ commentId, actorId }) {
  return removeAggregatedCommentLike({ commentId, actorId });
}

export async function createRetweetNotification({ tweetId, actorId }) {
  if (!tweetId || !actorId) return null;
  const tweet = await Tweet.findById(tweetId).select('author content').lean();
  if (!tweet) return null;
  const recipientId = tweet.author?.toString();
  if (!recipientId || recipientId === actorId.toString()) return null;
  const extra = {
    snippet: tweet.content ? tweet.content.slice(0, 140) : '',
    tweetId: tweetId.toString(),
  };
  return createOrUpdateSimpleNotification({
    recipientId,
    actorId,
    type: 'retweet',
    targetType: 'tweet',
    targetId: tweetId,
    extra,
  });
}

export async function createCommentNotifications({
  tweetId,
  commentId,
  actorId,
  parentCommentId = null,
}) {
  if (!tweetId || !commentId || !actorId) return null;

  if (parentCommentId) {
    const parent = await Comment.findById(parentCommentId).select('author').lean();
    if (parent && parent.author.toString() !== actorId.toString()) {
      await createActionNotification({
        recipientId: parent.author,
        actorId,
        type: 'reply',
        targetType: 'comment',
        targetId: commentId,
        extra: {
          tweetId: tweetId.toString(),
          commentId: commentId.toString(),
          parentCommentId: parentCommentId.toString(),
        },
      });
    }
  }

  const tweet = await Tweet.findById(tweetId).select('author content').lean();
  if (
    tweet &&
    tweet.author.toString() !== actorId.toString() &&
    (!parentCommentId ||
      tweet.author.toString() !==
        (await Comment.findById(parentCommentId).select('author').lean())
          ?.author?.toString())
  ) {
    await createActionNotification({
      recipientId: tweet.author,
      actorId,
      type: 'comment',
      targetType: 'tweet',
      targetId: tweetId,
      extra: {
        snippet: tweet.content ? tweet.content.slice(0, 140) : '',
        commentId: commentId.toString(),
      },
    });
  }

  return true;
}

export async function createMentionNotifications({
  mentions = [],
  actorId,
  tweetId = null,
  commentId = null,
}) {
  if (!mentions || mentions.length === 0) return null;
  const tasks = mentions
    .filter((m) => m.toString() !== actorId.toString())
    .map((mentionedUserId) =>
      createActionNotification({
        recipientId: mentionedUserId,
        actorId,
        type: 'mention',
        targetType: commentId ? 'comment' : 'tweet',
        targetId: commentId ? commentId : tweetId,
        extra: {
          tweetId: tweetId ? tweetId.toString() : null,
          commentId: commentId ? commentId.toString() : null,
        },
      })
    );
  await Promise.all(tasks);
  return true;
}

/**
 * Fetch notifications for a user (paginated)
 */
export async function getNotificationsForUser(
  userId,
  { page = 1, limit = 20 } = {}
) {
  console.log('🔍 getNotificationsForUser userId =', userId?.toString?.() || userId);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Notification.find({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ userId, isActive: true }),
  ]);

  // Build a map of actorId -> user doc (name + avatar)
  const actorMap = await buildActorMapFromNotifications(items);

  // Hydrate each notification into the nice fully-defined format
  const formatted = items
    .map((doc) => hydrateNotificationForClient(doc, actorMap))
    .filter(Boolean);

  return { items: formatted, total, page, limit };
}

/* Mark read / unread / count functions */

export async function markAsRead(userId, notificationIds = []) {
  const query = { userId, isActive: true };
  if (Array.isArray(notificationIds) && notificationIds.length > 0) {
    const objectIds = notificationIds.map((id) => new mongoose.Types.ObjectId(id));
    query._id = { $in: objectIds };
  }
  const result = await Notification.updateMany(query, {
    $set: { read: true, readAt: new Date() },
  });
  return { ok: true, matched: result.matchedCount, modified: result.modifiedCount };
}

export async function markAllAsRead(userId) {
  await Notification.updateMany(
    { userId, isActive: true, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  return { ok: true };
}

export async function getUnreadCount(userId) {
  const count = await Notification.countDocuments({
    userId,
    read: false,
    isActive: true,
  });
  return count;
}

export default {
  createOrUpdateSimpleNotification,
  createActionNotification,
  removeSimpleNotification,
  upsertAggregatedLike,
  removeAggregatedLike,
  upsertAggregatedCommentLike,
  removeAggregatedCommentLike,
  createLikeNotification,
  removeLikeNotification,
  createCommentLikeNotification,
  removeCommentLikeNotification,
  createRetweetNotification,
  createCommentNotifications,
  createMentionNotifications,
  getNotificationsForUser,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
