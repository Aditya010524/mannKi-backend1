// src/config/env.js
import { config } from 'dotenv';
import path from 'path';

// Load .env.* file
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;

console.log('🔧 [ENV LOADER] Starting environment configuration...');
console.log(`🔧 [ENV LOADER] NODE_ENV: ${nodeEnv}`);
console.log(`🔧 [ENV LOADER] Loading env file: ${envFile}`);

const loadResult = config({ path: path.resolve(process.cwd(), envFile) });
console.log(`🔧 [ENV LOADER] Config loaded: ${loadResult.error ? '⚠️  WARN (env file not found, using process.env)' : '✅ SUCCESS'}`);
if (loadResult.error) {
  console.warn(`🔧 [ENV LOADER] Warning: ${loadResult.error.message}`);
  console.warn('🔧 [ENV LOADER] Proceeding with environment variables from platform');
}

// Parse and provide safe defaults for environment variables
const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  DOCS_URL: process.env.DOCS_URL || '/api/v1/docs',
  ENABLE_DOCS: process.env.ENABLE_DOCS === 'true',
  HEALTH_CHECK_DETAILED: process.env.HEALTH_CHECK_DETAILED !== 'false',

  // Database
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_TEST_URI: process.env.MONGODB_TEST_URI || null,

  // JWT
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_ACCESS_EXPIRE: process.env.JWT_ACCESS_EXPIRE || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || '7d',

  // Email (Brevo)
  BREVO_API_KEY: process.env.BREVO_API_KEY || null,
  FROM_EMAIL: process.env.FROM_EMAIL || null,

  // File upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
  UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',

  // Cloudinary (for dev)
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || null,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || null,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || null,

  // Rate limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  // Clustering
  WORKER_COUNT: process.env.WORKER_COUNT ? parseInt(process.env.WORKER_COUNT, 10) : null,

  // Security
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  FRONTEND_URL: process.env.FRONTEND_URL || null,
  BACKEND_URL: process.env.BACKEND_URL || null,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_PATH: process.env.LOG_PATH || null,

  // Default images
  DEFAULT_PROFILE_URL: process.env.DEFAULT_PROFILE_URL || null,
  DEFAULT_COVER_URL: process.env.DEFAULT_COVER_URL || null,
};

// Validate critical variables
if (!env.MONGODB_URI) {
  throw new Error('❌ MONGODB_URI is required in environment variables');
}
if (!env.JWT_ACCESS_SECRET) {
  throw new Error('❌ JWT_ACCESS_SECRET is required in environment variables');
}
if (!env.JWT_REFRESH_SECRET) {
  throw new Error('❌ JWT_REFRESH_SECRET is required in environment variables');
}

// Log EMAIL config
console.log('📧 [EMAIL CONFIG] Loaded from environment:');
console.log(`   BREVO_API_KEY: ${env.BREVO_API_KEY ? '✅ Set (' + env.BREVO_API_KEY.length + ' chars)' : '❌ Not set'}`);
console.log(`   FROM_EMAIL: ${env.FROM_EMAIL || '❌ Not set'}`);

// Structured export without Joi validation
const configEnv = {
  NODE_ENV: env.NODE_ENV,
  IS_PROD: env.NODE_ENV === 'production',
  IS_DEV: env.NODE_ENV === 'development',
  PORT: env.PORT,
  API_PREFIX: env.API_PREFIX,
  DOCS_URL: env.DOCS_URL,
  ENABLE_DOCS: env.ENABLE_DOCS,
  HEALTH_CHECK_DETAILED: env.HEALTH_CHECK_DETAILED,

  DATABASE: {
    MONGODB_URI: env.MONGODB_URI,
    MONGODB_TEST_URI: env.MONGODB_TEST_URI,
  },

  JWT: {
    ACCESS_SECRET: env.JWT_ACCESS_SECRET,
    ACCESS_EXPIRE: env.JWT_ACCESS_EXPIRE,
    REFRESH_SECRET: env.JWT_REFRESH_SECRET,
    REFRESH_EXPIRE: env.JWT_REFRESH_EXPIRE,
  },

  SECURITY: {
    BCRYPT_ROUNDS: env.BCRYPT_ROUNDS,
    CORS_ORIGIN: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    FRONTEND_URL: env.FRONTEND_URL,
    BACKEND_URL: env.BACKEND_URL,
  },

  EMAIL: {
    API_KEY: env.BREVO_API_KEY,
    FROM: env.FROM_EMAIL,
  },

  UPLOAD: {
    MAX_FILE_SIZE: env.MAX_FILE_SIZE,
    PATH: env.UPLOAD_PATH,
    CLOUDINARY: {
      CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME,
      API_KEY: env.CLOUDINARY_API_KEY,
      API_SECRET: env.CLOUDINARY_API_SECRET,
    },
  },

  RATE_LIMIT: {
    WINDOW_MINUTES: env.RATE_LIMIT_WINDOW,
    MAX: env.RATE_LIMIT_MAX,
  },

  LOGGING: {
    LEVEL: env.LOG_LEVEL,
    PATH: env.LOG_PATH,
  },

  DEFAULT_PROFILE_URL: env.DEFAULT_PROFILE_URL,
  DEFAULT_COVER_URL: env.DEFAULT_COVER_URL,
};

export default configEnv;
