import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import configEnv from '../config/env.config.js';

const userSchema = new mongoose.Schema(
  {
    // Basic Info
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
      match: [
        /^[a-z0-9_]+$/,
        'Username can only contain lowercase letters, numbers, and underscores',
      ],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },

    // Profile Info
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [50, 'Display name cannot exceed 50 characters'],
    },

    bio: {
      type: String,
      maxlength: [160, 'Bio cannot exceed 160 characters'],
      default: '',
    },

    avatar: {
      type: String,
      default: undefined,
    },

    coverPhoto: {
      type: String,
      default: undefined,
    },

    location: {
      type: String,
      maxlength: [30, 'Location cannot exceed 30 characters'],
      default: '',
    },

    website: {
      type: String,
      maxlength: [100, 'Website URL cannot exceed 100 characters'],
      default: '',
    },

    // Account Status (After email verification or google)
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Soft delete or suspension flag.
    isActive: {
      type: Boolean,
      default: true,
    },

    role: {
      type: String,
      enum: ['user', 'admin', 'moderator'],
      default: 'user',
    },

    // Stats (updated by application logic)
    followersCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    followingCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    tweetsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Timestamps
    dateOfBirth: {
      type: Date,
    },

    lastActiveAt: {
      type: Date,
      default: Date.now,
    },

    passwordChangedAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Essential Indexes for MVP
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1, isPrivate: 1 });

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const saltRound = configEnv.SECURITY.BCRYPT_ROUNDS;

  this.password = await bcrypt.hash(this.password, saltRound);
  next();
});

// passwordChangedAt only updates on password changes (not every save).
userSchema.pre('save', function (next) {
  // this.isNew -> If the user document is new (signup), don’t set passwordChangedAt.
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual fields (optional)
userSchema.virtual('profileUrl').get(function () {
  return `/profile/${this.username}`;
});

// Virtual fields --> "Sonu (@sonu123)"
userSchema.virtual('displayWithHandle').get(function () {
  return `${this.displayName} (@${this.username})`;
});

// Admin stats
userSchema.virtual('accountAge').get(function () {
  const days = (Date.now() - this.createdAt) / (1000 * 60 * 60 * 24);
  return Math.floor(days);
});

const User = mongoose.model('User', userSchema);

export default User;
