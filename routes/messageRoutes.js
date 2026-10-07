// Backend/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  sendMessage,
  getMessages,
  markMessagesAsRead,
  getConversations,
  deleteMessage,
  addReaction,
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload Error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// ✅ IMPORTANT: Specific routes pehle, dynamic (:id) baad mein
router.get('/conversations', protect, getConversations);
router.post('/', protect, upload.single('file'), handleMulterError, sendMessage);
router.put('/read/:senderId', protect, markMessagesAsRead);
router.put('/react/:id', protect, addReaction);
router.delete('/:id', protect, deleteMessage);
router.get('/:id', protect, getMessages);

module.exports = router;