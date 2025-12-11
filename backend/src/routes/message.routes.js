import express from 'express';
import {
  getMessageableUsers,
  getChatPartners,
  getMessagesByUserId,
  sendMessage,
  getOnlineContacts,
  searchUsersToMessage,
} from '../controllers/message.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import { conditionalChatUpload } from '../config/media-upload.config.js'; // ✅ Import from your config

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUser);

// ✅ Enhanced routes for Twitter-style messaging
router.get('/contacts', getMessageableUsers);
router.get('/chats', getChatPartners);
router.get('/online', getOnlineContacts);
router.get('/search', searchUsersToMessage);
router.get('/:id', getMessagesByUserId);
router.post('/send/:id', conditionalChatUpload, sendMessage); // ✅ Add conditional upload

export default router;
