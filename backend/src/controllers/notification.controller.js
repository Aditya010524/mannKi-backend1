// src/controllers/notification.controller.js
import notifService from '../services/notification.service.js';
import asyncHandler from '../utils/async-handler.js';
import ApiResponse from '../utils/api-response.js';

class NotificationController {
  // GET /api/v1/notifications?page=1&limit=20
  getNotifications = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
    const userId = req.user?._id || req.user?.id;

    const result = await notifService.getNotificationsForUser(userId, { page, limit });
    // result: { items, total, page, limit }
    return ApiResponse.paginated(
      res,
      result.items,
      { page: result.page, limit: result.limit, total: result.total },
      'Notifications retrieved successfully'
    );
  });

  // GET /api/v1/notifications/unread-count
  getUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.user?.id;
    const unread = await notifService.getUnreadCount(userId);
    return ApiResponse.success(res, { unread }, 'Unread count retrieved');
  });

  // POST /api/v1/notifications/mark-read  { ids: [...] }
  markRead = asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.user?.id;
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    await notifService.markAsRead(userId, ids);
    return ApiResponse.success(res, null, 'Notifications marked as read');
  });

  // POST /api/v1/notifications/mark-all-read
  markAllRead = asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.user?.id;
    await notifService.markAllAsRead(userId);
    return ApiResponse.success(res, null, 'All notifications marked as read');
  });
}

export const notificationController = new NotificationController();
export default notificationController;
