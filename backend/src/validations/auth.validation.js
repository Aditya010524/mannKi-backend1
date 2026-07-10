import Joi from 'joi';

const authValidation = {
  // Registration
  register: Joi.object({
    username: Joi.string()
      .min(3)
      .max(20)
      .pattern(/^[a-z0-9_]+$/)
      .lowercase()
      .required()
      .messages({
        'string.pattern.base':
          'Username can only contain lowercase letters, numbers, and underscores',
        'string.min': 'Username must be at least 3 characters',
        'string.max': 'Username cannot exceed 20 characters',
        'any.required': 'Username is required',
      }),

    email: Joi.string().email().lowercase().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),

    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required',
    }),

    displayName: Joi.string().min(1).max(50).trim().required().messages({
      'string.min': 'Display name cannot be empty',
      'string.max': 'Display name cannot exceed 50 characters',
      'any.required': 'Display name is required',
    }),
  }),

  // Login
  login: Joi.object({
    identifier: Joi.string().trim().required().messages({
      'any.required': 'Username or email is required',
    }),

    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
  }),

  // Email Verification – ✅ now uses OTP
  verifyEmail: Joi.object({
    otp: Joi.string()
      .length(6)
      .pattern(/^[0-9]+$/)
      .required()
      .messages({
        'string.length': 'Verification code must be 6 digits',
        'string.pattern.base': 'Verification code must contain only digits',
        'any.required': 'Verification code is required',
      }),
  }),

  // Refresh Token
  refresh: Joi.object({
    refreshToken: Joi.string().optional(), // Can come from cookie or body
  }),

  // Forgot Password
  forgotPassword: Joi.object({
    email: Joi.string().email().lowercase().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  }),

  // Reset Password
  resetPassword: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Reset token is required',
    }),

    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'New password is required',
    }),
  }),

  // Check Email Exists
  checkEmail: Joi.object({
    email: Joi.string().email().lowercase().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  }),

  // Resend Verification
  resendVerification: Joi.object({
    email: Joi.string().email().lowercase().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  }),

  // Verify Forgot Password OTP
  verifyForgotPasswordOtp: Joi.object({
    email: Joi.string().email().lowercase().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    otp: Joi.string()
      .length(6)
      .pattern(/^[0-9]+$/)
      .required()
      .messages({
        'string.length': 'Verification code must be 6 digits',
        'string.pattern.base': 'Verification code must contain only digits',
        'any.required': 'Verification code is required',
      }),
  }),
};

export default authValidation;
