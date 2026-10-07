// Backend/controllers/messageController.js
const Message = require('../models/Message');
const { cloudinary } = require('../config/cloudinary');
const streamifier = require('streamifier');

// ✅ Helper: Buffer ko Cloudinary par upload karne ke liye
const uploadToCloudinary = (buffer, mimetype) => {
  return new Promise((resolve, reject) => {
    const isAudio = mimetype.startsWith('audio/');
    const resourceType = isAudio ? 'video' : 'auto';

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'whatsapp_clone_messages', resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// @desc    Send a new message
const sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const senderId = req.user._id;

    if (!receiverId) return res.status(400).json({ message: 'Receiver ID is required' });

    let messageType = 'text';
    let fileUrl = '';
    let messageText = text || '';

    if (req.file) {
      if (!req.file.buffer) return res.status(400).json({ message: 'File buffer missing!' });

      if (req.file.mimetype.startsWith('image/')) messageType = 'image';
      else if (req.file.mimetype.startsWith('video/')) messageType = 'video';
      else if (req.file.mimetype.startsWith('audio/')) messageType = 'audio';

      const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
      fileUrl = result.secure_url;
    } else if (!text) {
      return res.status(400).json({ message: 'Message text or file is required' });
    }

    const newMessage = await Message.create({
      sender: senderId,
      receiver: receiverId,
      message: messageText,
      messageType,
      fileUrl,
      reactions: [],
    });

    const io = req.app.get('io');
    if (io) {
      io.to(receiverId.toString()).emit('newMessage', newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send Message Error:', error.message || error);
    res.status(500).json({ message: error.message || 'Server Error' });
  }
};

// @desc    Get chat history
const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: userToChatId },
        { sender: userToChatId, receiver: myId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Mark messages as read
const markMessagesAsRead = async (req, res) => {
  try {
    const { senderId } = req.params;
    const myId = req.user._id;

    await Message.updateMany(
      { sender: senderId, receiver: myId, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all conversations
const getConversations = async (req, res) => {
  try {
    const myId = req.user._id;
    const conversations = await Message.aggregate([
      { $match: { $or: [{ sender: myId }, { receiver: myId }] } },
      {
        $addFields: {
          otherUser: {
            $cond: { if: { $eq: ['$sender', myId] }, then: '$receiver', else: '$sender' },
          },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$otherUser',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', myId] }, { $eq: ['$read', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          username: '$user.username',
          profilePic: '$user.profilePic',
          lastMessage: '$lastMessage',
          unreadCount: '$unreadCount',
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ]);
    res.status(200).json(conversations);
  } catch (error) {
    console.error('Get Conversations Error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ✅ NEW: Delete a message
const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (message.sender.toString() !== myId.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    await Message.findByIdAndDelete(messageId);

    const io = req.app.get('io');
    if (io) {
      io.to(message.receiver.toString()).emit('messageDeleted', { messageId });
    }

    res.status(200).json({ success: true, messageId });
  } catch (error) {
    console.error('Delete Message Error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ✅ NEW: Add / Toggle reaction
const addReaction = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { emoji } = req.body;
    const myId = req.user._id;

    if (!emoji) return res.status(400).json({ message: 'Emoji is required' });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const existingIndex = message.reactions.findIndex(
      (r) => r.user.toString() === myId.toString()
    );

    if (existingIndex > -1) {
      if (message.reactions[existingIndex].emoji === emoji) {
        message.reactions.splice(existingIndex, 1);
      } else {
        message.reactions[existingIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ user: myId, emoji });
    }

    await message.save();

    const io = req.app.get('io');
    if (io) {
      const otherUserId =
        message.sender.toString() === myId.toString()
          ? message.receiver.toString()
          : message.sender.toString();

      io.to(otherUserId).emit('messageReaction', {
        messageId,
        reactions: message.reactions,
      });
    }

    res.status(200).json({ success: true, reactions: message.reactions });
  } catch (error) {
    console.error('Reaction Error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  markMessagesAsRead,
  getConversations,
  deleteMessage,
  addReaction,
};