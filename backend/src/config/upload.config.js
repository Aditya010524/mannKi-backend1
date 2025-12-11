import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    // Different sizes for avatar vs cover photo
    if (file.fieldname === 'avatar') {
      return {
        folder: 'social-app/avatars',
        format: 'jpeg',
        transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }],
      };
    }

    if (file.fieldname === 'coverPhoto') {
      return {
        folder: 'social-app/covers',
        format: 'jpeg',
        transformation: [{ width: 1500, height: 500, crop: 'fill' }],
      };
    }

    // Default
    return {
      folder: 'social-app',
      format: 'jpeg',
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default upload;
