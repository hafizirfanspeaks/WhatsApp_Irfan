// Backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getUsers, updateProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// ✅ Multer error handling
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload Error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// @route   GET /api/users
router.get('/', protect, getUsers);

// @route   PUT /api/users/profile
router.put(
  '/profile',
  protect,
  upload.single('profilePic'),
  handleMulterError,
  updateProfile
);

module.exports = router;