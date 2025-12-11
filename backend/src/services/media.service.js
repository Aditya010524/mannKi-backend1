import { Media } from '../models/index.js';
import { cloudinary } from '../config/media-upload.config.js';
import ApiError from '../utils/api-error.js';
import logger from '../config/logger.config.js';

class MediaService {
  // Upload multiple media files
  async uploadMultipleMedia(files, userId, altTexts = []) {
    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const media = await this.uploadSingle(files[i], userId, altTexts[i] || '');
        results.push(media);
      } catch (error) {
        logger.error(`Media upload failed for ${files[i].originalname}: ${error.message}`);
        errors.push({
          filename: files[i].originalname,
          error: error.message,
        });
      }
    }

    return {
      media: results,
      summary: {
        total: files.length,
        successful: results.length,
        failed: errors.length,
        errors,
      },
    };
  }

  // Upload a single media file
  async uploadSingle(file, userId, altText = '') {
    // Determine media type
    const mediaType = file.mimetype.startsWith('video/')
      ? 'video'
      : file.mimetype === 'image/gif'
        ? 'gif'
        : 'image';

    // Create media record
    const media = await Media.create({
      owner: userId,
      filename: file.filename,
      originalName: file.originalname,
      type: mediaType,
      mimeType: file.mimetype,
      size: file.size,
      altText: altText.trim(),
      status: 'ready',
      cloudinary: {
        publicId: file.filename,
        version: this.extractVersionFromUrl(file.path),
        urls: {
          original: file.path,
          thumbnail: this.generateThumbnailUrl(file.filename, mediaType),
        },
      },
    });

    logger.info(`Media uploaded successfully: ${media._id} by user ${userId}`);
    return media;
  }

  // Permanently delete media
  async deleteMedia(mediaId, userId) {
    const media = await Media.findOne({
      _id: mediaId,
      owner: userId,
      isActive: true,
    });

    if (!media) {
      throw ApiError.notFound('Media not found');
    }

    // Check if media is being used
    if (media.isUsed && media.tweet) {
      throw ApiError.badRequest('Cannot delete media that is being used in a tweet');
    }

    try {
      // Delete from Cloudinary
      await cloudinary.uploader.destroy(media.cloudinary.publicId, {
        resource_type: media.type === 'video' ? 'video' : 'image',
      });

      // Permanently delete from database
      await Media.findByIdAndDelete(mediaId);

      logger.info(`Media permanently deleted: ${mediaId} by user ${userId}`);
    } catch (error) {
      logger.error(`Failed to delete media ${mediaId}: ${error.message}`);
      throw ApiError.internal('Failed to delete media');
    }
  }

  // Generate thumbnail URL for media
  generateThumbnailUrl(publicId, type) {
    const baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`;

    if (type === 'video') {
      return `${baseUrl}/video/upload/so_0,w_150,h_150,c_fill/${publicId}.jpg`;
    } else {
      return `${baseUrl}/image/upload/c_fill,w_150,h_150/${publicId}`;
    }
  }

  // Extract version from Cloudinary URL
  extractVersionFromUrl(url) {
    const versionMatch = url.match(/\/v(\d+)\//);
    return versionMatch ? versionMatch[1] : null;
  }

  // Validate media file
  validateFile(file) {
    const supportedTypes = {
      image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'],
    };

    const allSupportedTypes = [...supportedTypes.image, ...supportedTypes.video];

    if (!allSupportedTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: `Unsupported file type: ${file.mimetype}`,
      };
    }

    const maxSizes = {
      image: 5 * 1024 * 1024, // 5MB
      video: 100 * 1024 * 1024, // 100MB
    };

    const mediaType = supportedTypes.image.includes(file.mimetype) ? 'image' : 'video';
    const maxSize = maxSizes[mediaType];

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File too large. Maximum size for ${mediaType} is ${this.formatFileSize(maxSize)}`,
      };
    }

    return {
      isValid: true,
      type: mediaType,
    };
  }

  //  Format file size for display
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(1);

    return `${size} ${sizes[i]}`;
  }
}

export const mediaService = new MediaService();
