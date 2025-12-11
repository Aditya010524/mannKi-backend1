import mongoose from 'mongoose';

const authTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },

    token: {
      type: String,
      required: [true, 'Token is required'],
      unique: true, // Keep this - it's essential for token lookups
      select: false,
    },

    tokenId: {
      type: String,
      required: function () {
        return this.type === 'refresh';
      },
    },

    type: {
      type: String,
      enum: ['refresh', 'access', 'email_verification', 'password_reset'],
      required: [true, 'Token type is required'],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: { expireAfterSeconds: 0 }, // Keep TTL index
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    deviceInfo: {
      userAgent: String,
      ip: String,
      deviceName: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// PRIMARY compound index - covers most common queries
authTokenSchema.index(
  {
    userId: 1,
    type: 1,
    isActive: 1,
    expiresAt: 1,
  },
  {
    name: 'user_token_lookup',
  }
);

// SPARSE unique index for tokenId (refresh tokens)
authTokenSchema.index(
  { tokenId: 1 },
  {
    unique: true,
    sparse: true,
    name: 'tokenId_sparse_unique',
  }
);

// Optional: If you frequently query by token alone without userId
// authTokenSchema.index({
//   token: 1,
//   isActive: 1,
//   expiresAt: 1
// });

// Instance methods
authTokenSchema.methods.revoke = function () {
  this.isActive = false;
  this.revokedAt = new Date();
  return this.save();
};

// Static method to find active token
authTokenSchema.statics.findActiveToken = function (token, type) {
  return this.findOne({
    token,
    type,
    isActive: true,
    expiresAt: { $gt: new Date() },
  }).select('+token');
};

// Static method to revoke all tokens for a user
authTokenSchema.statics.revokeUserTokens = function (userId, type = null) {
  const query = { userId, isActive: true };
  if (type) query.type = type;

  return this.updateMany(query, {
    $set: {
      isActive: false,
      revokedAt: new Date(),
    },
  });
};

const AuthToken = mongoose.model('AuthToken', authTokenSchema);

export default AuthToken;
