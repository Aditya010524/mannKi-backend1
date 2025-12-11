// src/validations/notifications.validation.js
import Joi from 'joi';

// GET /api/v1/notifications?page=1&limit=20
export const getNotifications = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// POST /api/v1/notifications/mark-read
// { "ids": ["651234abcd...", "651234efgh..."] }
export const markRead = Joi.object({
  ids: Joi.array()
    .items(
      Joi.string()
        .trim()
        .length(24)
        .hex()
        .messages({
          'string.length': 'Each id must be a 24-character ObjectId string',
          'string.hex': 'Each id must be a valid hex ObjectId string',
        })
    )
    .min(1)
    .required()
    .messages({
      'array.base': '"ids" must be an array of notification ids',
      'array.min': 'At least one notification id is required',
      'any.required': '"ids" field is required',
    }),
});

// 👇 This creates the default export your routes file expects
const notificationsValidation = {
  getNotifications,
  markRead,
};

export default notificationsValidation;
