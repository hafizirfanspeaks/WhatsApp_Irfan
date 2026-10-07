const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { cloudinary } = require('../config/cloudinary');

// JWT Token generate karne ka function
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ================= REGISTER =================
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // 1. Check karein user pehle se mojood hai ya nahi
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // 2. Default profile pic
    let profilePic = 'https://res.cloudinary.com/your_cloud_name/image/upload/v1/default_avatar.png';

    // 3. Agar file aayi hai toh Base64 method se Cloudinary par upload karain
    if (req.file) {
      // Buffer ko Base64 string mein convert karain
      const base64Image = req.file.buffer.toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${base64Image}`;

      // Cloudinary par upload karain
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: 'whatsapp_clone_avatars',
        transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }]
      });

      profilePic = result.secure_url;
    }

    // 4. Naya user banayein
    const user = await User.create({
      username,
      email,
      password,
      profilePic,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Register Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// ================= LOGIN =================
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login Error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { registerUser, loginUser };