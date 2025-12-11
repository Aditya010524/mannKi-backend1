import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ YOUR ORIGINAL CODE - UNCHANGED
// Cloudinary storage configuration
const mediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');

    if (isVideo) {
      return {
        folder: 'social-app/media/videos',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi', 'webm'],
        transformation: [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }],
      };
    } else {
      return {
        folder: 'social-app/media/images',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ width: 2048, height: 2048, crop: 'limit', quality: 'auto' }],
      };
    }
  },
});

// File filter for media uploads
const mediaFileFilter = (req, file, cb) => {
  const supportedImages = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const supportedVideos = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'];
  const supportedTypes = [...supportedImages, ...supportedVideos];

  if (supportedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

// Media upload configuration
const mediaUpload = multer({
  storage: mediaStorage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 4, // Maximum 4 files per upload
  },
});

// ✅ NEW CHAT-SPECIFIC CODE BELOW - DOESN'T AFFECT YOUR ORIGINAL CODE

// Chat media storage configuration (separate from your original)
const chatMediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');

    if (isVideo) {
      return {
        folder: 'social-app/chat-media/videos', // Different folder for chat
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi', 'webm'],
        transformation: [{ width: 1280, height: 720, crop: 'limit', quality: 'auto:good' }],
      };
    } else {
      return {
        folder: 'social-app/chat-media/images', // Different folder for chat
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto:good' }],
      };
    }
  },
});

// Chat media upload configuration (separate from your original)
const chatMediaUpload = multer({
  storage: chatMediaStorage,
  fileFilter: mediaFileFilter, // Reusing your file filter
  limits: {
    fileSize: 60 * 1024 * 1024, // 60MB max file size for chat
    files: 2, // Maximum 2 files (1 image + 1 video)
  },
});

// Conditional function that applies multer only for multipart/form-data
export const conditionalChatUpload = (req, res, next) => {
  const contentType = req.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    return chatMediaUpload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ])(req, res, next);
  } else {
    next();
  }
};

// Function to upload base64 data to Cloudinary (for JSON requests)
export const uploadBase64ToCloudinary = async (base64Data, mediaType = 'image') => {
  try {
    const uploadOptions = {
      resource_type: mediaType === 'video' ? 'video' : 'image',
      folder: `social-app/chat-media/${mediaType}s`,
      quality: 'auto:good',
    };

    if (mediaType === 'image') {
      uploadOptions.transformation = [
        { width: 1920, height: 1080, crop: 'limit' },
        { quality: 'auto:good' },
      ];
    } else if (mediaType === 'video') {
      uploadOptions.transformation = [
        { width: 1280, height: 720, crop: 'limit' },
        { quality: 'auto:good' },
        { format: 'mp4' },
      ];
    }

    const uploadResponse = await cloudinary.uploader.upload(base64Data, uploadOptions);
    return uploadResponse;
  } catch (error) {
    throw new Error(`Media upload failed: ${error.message}`);
  }
};

// ✅ YOUR ORIGINAL EXPORTS - UNCHANGED
export { mediaUpload, cloudinary };

// ✅ NEW EXPORTS FOR CHAT FUNCTIONALITY
export { chatMediaUpload };
