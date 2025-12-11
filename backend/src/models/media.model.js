import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    // Media ownership
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Associated tweet/comment (optional initially)
    tweet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tweet',
      default: null,
    },

    // File information
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['image', 'video', 'gif'],
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
    },

    // Cloudinary data
    cloudinary: {
      publicId: {
        type: String,
        required: true,
      },
      version: {
        type: String,
      },
      urls: {
        original: {
          type: String,
          required: true,
        },
        thumbnail: {
          type: String,
        },
      },
    },

    // Accessibility
    altText: {
      type: String,
      maxlength: 1000,
      default: '',
    },

    // Status tracking
    status: {
      type: String,
      enum: ['uploading', 'processing', 'ready', 'failed'],
      default: 'uploading',
    },

    // Usage tracking
    isUsed: {
      type: Boolean,
      default: false,
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

// Essential indexes
mediaSchema.index({ owner: 1, createdAt: -1 });
mediaSchema.index({ tweet: 1 });
mediaSchema.index({ isUsed: 1, isActive: 1 });
mediaSchema.index({ status: 1 });
mediaSchema.index({ 'cloudinary.publicId': 1 });

// Virtual for formatted file size
mediaSchema.virtual('fileSizeFormatted').get(function () {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (this.size === 0) return '0 Bytes';
  const i = Math.floor(Math.log(this.size) / Math.log(1024));
  return `${(this.size / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
});

const Media = mongoose.model('Media', mediaSchema);

export default Media;
