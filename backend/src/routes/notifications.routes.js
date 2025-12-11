// src/routes/notifications.routes.js
import express from 'express';
import { notificationController } from '../controllers/notification.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import notificationsValidation from '../validations/notifications.validation.js';

const router = express.Router();

// All notification routes require authentication
router.use(authenticateUser);

// ==========================================
// NOTIFICATIONS - LIST / COUNT / MARK READ
// ==========================================

// Get notifications (paginated)
router.get(
  '/',
  validate(notificationsValidation.getNotifications, 'query'),
  notificationController.getNotifications
);

// Get unread count
router.get(
  '/unread-count',
  notificationController.getUnreadCount
);

// Mark specific notifications as read
router.post(
  '/mark-read',
  validate(notificationsValidation.markRead, 'body'),
  notificationController.markRead
);

// Mark all notifications as read
router.post(
  '/mark-all-read',
  notificationController.markAllRead
);

export default router;
