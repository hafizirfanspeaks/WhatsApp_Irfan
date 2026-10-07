// Backend/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ✅ CHECK: Agar .env variables missing hain toh terminal mein warning aayegi
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error("❌ CLOUDINARY ENVIRONMENT VARIABLES ARE MISSING! Please check your .env file.");
} else {
  console.log("✅ Cloudinary Config Loaded Successfully");
}

// Memory storage (RAM mein rakhega, phir Cloudinary par bhejenge)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (videos ke liye)
  fileFilter: (req, file, cb) => {
    // Sirf image, video, audio allow karein
    const allowed = [
      'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
      'video/mp4', 'video/webm',
      'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  },
});

module.exports = { cloudinary, upload };