// Backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  profilePic: {
    type: String, // Will store the Cloudinary secure URL
    default: 'https://res.cloudinary.com/your_cloud_name/image/upload/v1/default_avatar.png', // A placeholder avatar
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function () {   // <--- FIX 1: Removed 'next' from parameters
  if (!this.isModified('password')) {
    return;                                 // <--- FIX 2: Just return instead of 'return next()'
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // <--- FIX 3: Removed 'next()' here. Mongoose automatically continues.
});

// Method to compare passwords
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);