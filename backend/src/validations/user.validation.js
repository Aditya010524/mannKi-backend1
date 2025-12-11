import Joi from 'joi';

const userValidation = {
  // PUT /me -> Update Profile
  updateProfile: Joi.object({
    displayName: Joi.string().min(1).max(50).trim().optional().messages({
      'string.min': 'Display name cannot be empty',
      'string.max': 'Display name cannot exceed 50 characters',
    }),

    bio: Joi.string().max(160).allow('').optional().messages({
      'string.max': 'Bio cannot exceed 160 characters',
    }),

    location: Joi.string().max(30).allow('').optional().messages({
      'string.max': 'Location cannot exceed 30 characters',
    }),

    website: Joi.string()
      .uri({ scheme: [/https?/] })
      .allow('')
      .optional()
      .messages({
        'string.uri': 'Please provide a valid website URL (must include http:// or https://)',
      }),

    dateOfBirth: Joi.alternatives()
      .try(
        Joi.date().iso().max('now').messages({
          'date.format': 'Date of birth must be in YYYY-MM-DD format',
          'date.iso': 'Date of birth must be in YYYY-MM-DD format',
          'date.max': 'Date of birth cannot be in the future',
        }),
        Joi.string().valid('', null)
      )
      .optional(),
  }),

  // PUT /me/username -> Update Username
  updateUsername: Joi.object({
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

    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required to change username',
    }),
  }),

  // PUT /me/email -> Update Username
  updateEmail: Joi.object({
    email: Joi.string().email().lowercase().trim().required().messages({
      'string.email': 'Please provide a valid email address',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Current password is required for verification',
    }),
  }),

  // PUT /me/changepassword -> Change Password
  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required',
    }),

    newPassword: Joi.string().min(6).required().messages({
      'string.min': 'New password must be at least 6 characters',
      'any.required': 'New password is required',
    }),

    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'any.only': 'Confirm password must match new password',
      'any.required': 'Confirm password is required',
    }),
  }),

  // DELETE /delte -> Delete Account
  deleteAccount: Joi.object({
    password: Joi.string().required().messages({
      'any.required': 'Password is required to delete account',
    }),

    confirmDelete: Joi.string().valid('DELETE').required().messages({
      'any.only': 'Please type "DELETE" to confirm account deletion',
      'any.required': 'Confirmation is required',
    }),
  }),

  // Search users
  searchUsers: Joi.object({
    q: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query cannot exceed 50 characters',
      'any.required': 'Search query is required',
    }),
    page: Joi.number().integer().min(1).max(100).default(1).messages({
      'number.min': 'Page must be at least 1',
      'number.max': 'Page cannot exceed 100',
    }),
    limit: Joi.number().integer().min(1).max(50).default(20).messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50',
    }),
  }),

  // Get user by ID
  getUserById: Joi.object({
    userId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid user ID format',
        'any.required': 'User ID is required',
      }),
  }),

  // Get all users
  getAllUsers: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    sortBy: Joi.string()
      .valid('createdAt', 'username', 'followersCount', 'displayName')
      .default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    verified: Joi.string().valid('true', 'false').optional(),
    isPrivate: Joi.string().valid('true', 'false').optional(),
  }),

  // Get user stats
  getUserStats: Joi.object({
    userId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid user ID format',
        'any.required': 'User ID is required',
      }),
  }),

  // Get suggested users
  getSuggestedUsers: Joi.object({
    limit: Joi.number().integer().min(1).max(20).default(10).messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 20',
    }),
  }),
};

export default userValidation;
