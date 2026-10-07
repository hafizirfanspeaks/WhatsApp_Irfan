// Backend/controllers/userController.js
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');
const streamifier = require('streamifier');

// ✅ Helper: Buffer ko Cloudinary par upload karne ke liye
const uploadToCloudinary = (buffer, mimetype) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'whatsapp_clone_avatars', resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// @desc    Get all users except myself
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select('-password');
    res.status(200).json(users);
  } catch (error) {
    console.error('Get Users Error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update user profile (username + profilePic)
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ Username update (agar diya gaya hai)
    if (username && username.trim()) {
      // Check karein ke username pehle se kisi aur ne use na kiya ho
      const existingUser = await User.findOne({
        username: username.trim(),
        _id: { $ne: userId },
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      user.username = username.trim();
    }

    // ✅ Profile pic upload (agar nayi file aayi hai)
    if (req.file) {
      if (!req.file.buffer) {
        return res.status(400).json({ message: 'File buffer missing!' });
      }

      // Purani profile pic Cloudinary se delete karein (optional)
      if (user.profilePic && user.profilePic.includes('cloudinary')) {
        try {
          // Public ID nikalna (URL se)
          const parts = user.profilePic.split('/');
          const filename = parts[parts.length - 1].split('.')[0];
          const publicId = `whatsapp_clone_avatars/${filename}`;
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.log('Old avatar delete failed (ignore):', err.message);
        }
      }

      const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
      user.profilePic = result.secure_url;
    }

    await user.save();

    // ✅ Password hata kar user bhejein
    const updatedUser = {
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
    };

    // ✅ Socket.IO: Doosre online users ko batao ke profile update hui hai
    const io = req.app.get('io');
    if (io) {
      io.emit('userUpdated', updatedUser);
      console.log(`📢 User profile updated: ${user.username}`);
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Update Profile Error:', error.message || error);
    res.status(500).json({ message: error.message || 'Server Error' });
  }
};

module.exports = { getUsers, updateProfile };