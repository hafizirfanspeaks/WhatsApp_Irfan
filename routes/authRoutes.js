const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');
const { upload } = require('../config/cloudinary');

// ================= REGISTER =================
// Multer middleware 'upload.single('profilePic')' is required here 
// because your authController expects req.file for Cloudinary upload.
router.post('/register', upload.single('profilePic'), registerUser);

// ================= LOGIN =================
router.post('/login', loginUser);

module.exports = router;