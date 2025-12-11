// src/config/env.js
import { config } from 'dotenv';
import Joi from 'joi';
import path from 'path';

// ------------------------------
// Load .env.* file
// ------------------------------
const nodeEnv = process.env.NODE_ENV || 'development';

// We only load `.env.{NODE_ENV}`
const envFile = `.env.${nodeEnv}`;

config({ path: path.resolve(process.cwd(), envFile) });

// ------------------------------
// Joi Schema Validation
// ------------------------------
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // Server
  PORT: Joi.number().default(5000),
  API_PREFIX: Joi.string().default('/api/v1'),
  DOCS_URL: Joi.string().default('/api/v1/docs'),
  ENABLE_DOCS: Joi.boolean().default(false),
  HEALTH_CHECK_DETAILED: Joi.boolean().default(true),

  // Database
  MONGODB_URI: Joi.string().uri().required(),
  // MONGODB_TEST_URI: Joi.string().uri().optional(),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(20).required(),
  JWT_ACCESS_EXPIRE: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(20).required(),
  JWT_REFRESH_EXPIRE: Joi.string().default('7d'),

  // Redis (optional)
  REDIS_URL: Joi.string().uri().optional(),

  // Email
  EMAIL_HOST: Joi.string().optional(),
  EMAIL_PORT: Joi.number().optional(),
  EMAIL_USER: Joi.string().optional(),
  EMAIL_PASS: Joi.string().optional(),
  FROM_EMAIL: Joi.string().email().optional(),

  // File upload
  MAX_FILE_SIZE: Joi.number().default(5 * 1024 * 1024), // 5 MB
  UPLOAD_PATH: Joi.string().default('./uploads'),

  // Cloudinary (for dev)
  CLOUDINARY_CLOUD_NAME: Joi.string().optional(),
  CLOUDINARY_API_KEY: Joi.string().optional(),
  CLOUDINARY_API_SECRET: Joi.string().optional(),

  // Rate limiting
  RATE_LIMIT_WINDOW: Joi.number().default(15), // minutes
  RATE_LIMIT_MAX: Joi.number().default(100),

  // Security
  BCRYPT_ROUNDS: Joi.number().default(12),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  FRONTEND_URL: Joi.string().uri().optional(),
  BACKEND_URL: Joi.string().uri().optional(),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_PATH: Joi.string().optional(),

  // Default profile image
  DEFAULT_PROFILE_URL: Joi.string().uri().optional(),
  DEFAULT_COVER_URL: Joi.string().uri().optional(),
}).unknown(true);

// ------------------------------
// Validate & Clean
// ------------------------------
const { value: env, error } = envSchema.validate(process.env, {
  abortEarly: false,
  allowUnknown: true,
  stripUnknown: true,
});

if (error) {
  error.details.forEach((err) => {
    console.error(`❌ Invalid env var: ${err.message}`);
  });
  process.exit(1);
}

// ------------------------------
// Structured Export
// ------------------------------
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
    // ["http://localhost:5173", "https://myapp.com"]
    CORS_ORIGIN: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    FRONTEND_URL: env.FRONTEND_URL,
    BACKEND_URL: env.BACKEND_URL,
  },

  EMAIL: {
    HOST: env.EMAIL_HOST,
    PORT: env.EMAIL_PORT,
    USER: env.EMAIL_USER,
    PASS: env.EMAIL_PASS,
    FROM: env.FROM_EMAIL,
  },

  UPLOAD: {
    MAX_FILE_SIZE: env.MAX_FILE_SIZE,
    PATH: env.UPLOAD_PATH,

    // dev → Cloudinary | prod → AWS
    CLOUDINARY: {
      CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME,
      API_KEY: env.CLOUDINARY_API_KEY,
      API_SECRET: env.CLOUDINARY_API_SECRET,
    },
    // AWS: {
    //   BUCKET_NAME: env.AWS_BUCKET_NAME,
    //   ACCESS_KEY_ID: env.AWS_ACCESS_KEY_ID,
    //   SECRET_ACCESS_KEY: env.AWS_SECRET_ACCESS_KEY,
    //   REGION: env.AWS_REGION,
    // },
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
  REDIS_URL: env.REDIS_URL,
};

export default configEnv;
