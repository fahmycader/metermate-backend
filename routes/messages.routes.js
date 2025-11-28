const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Message = require('../models/message.model');

// Get my messages
router.get('/', protect, async (req, res) => {
  try {
    const messages = await Message.find({ recipient: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: messages });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server Error', error: e.message });
  }
});

// Mark message as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const msg = await Message.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { read: true },
      { new: true }
    );
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, data: msg });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server Error', error: e.message });
  }
});

// Admin: send message to a user
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }
    const { recipient, title, body, meta } = req.body;
    const msg = await Message.create({ recipient, title, body, meta });
    // notify recipient via websocket if connected
    if (global.io) {
      global.io.to(`user_${recipient}`).emit('message', { type: 'new_message', message: msg });
    }
    res.status(201).json({ success: true, data: msg });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server Error', error: e.message });
  }
});

// Admin: list messages for any user (optional filters)
router.get('/admin/list', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }
    const { recipient } = req.query;
    const q = recipient ? { recipient } : {};
    const msgs = await Message.find(q).sort({ createdAt: -1 });
    res.json({ success: true, data: msgs });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server Error', error: e.message });
  }
});

// Delete message (user can delete their own messages)
router.delete('/:id', protect, async (req, res) => {
  try {
    const msg = await Message.findOne({ _id: req.params.id, recipient: req.user.id });
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Message deleted' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server Error', error: e.message });
  }
});

// Toggle star on message
router.put('/:id/star', protect, async (req, res) => {
  try {
    const msg = await Message.findOne({ _id: req.params.id, recipient: req.user.id });
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    msg.starred = !msg.starred;
    await msg.save();
    res.json({ success: true, data: msg });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server Error', error: e.message });
  }
});

// Operative: Poke admin (notify admin that operative needs attention)
router.post('/poke', protect, async (req, res) => {
  try {
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ success: false, message: 'Access denied. Meter readers only.' });
    }

    // Get all admin users
    const User = require('../models/user.model');
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id firstName lastName');

    if (admins.length === 0) {
      return res.status(404).json({ success: false, message: 'No admin users found' });
    }

    // Create ONE message and send to all admins (or create one per admin but emit only once)
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username;
    const title = 'Poke Notification';
    const body = `${userName} (${req.user.employeeId || 'N/A'}) needs your attention. Please check in with them.`;

    // Create ONE message for the first admin only (to avoid duplicate notifications)
    // All admins will see it through the admin room notification
    const firstAdmin = admins[0];
    const msg = await Message.create({
      recipient: firstAdmin._id,
      title,
      body,
      meta: {
        type: 'poke',
        fromUser: req.user._id,
        fromUserName: userName,
        fromEmployeeId: req.user.employeeId,
        timestamp: new Date(),
      },
    });

    // Emit WebSocket notification ONCE to admin room (all admins will receive it)
    if (global.io) {
      // Send to admin room ONCE - all admins in the room will receive this single notification
      global.io.to('admin_room').emit('pokeNotification', {
        type: 'poke',
        fromUser: req.user._id,
        fromUserName: userName,
        fromEmployeeId: req.user.employeeId,
        timestamp: new Date(),
        message: msg,
      });
      
      // Also send the message notification to the first admin only
      global.io.to(`user_${firstAdmin._id}`).emit('message', {
        type: 'new_message',
        message: msg,
      });
    }

    res.json({
      success: true,
      message: 'Admin has been notified',
      data: { messagesSent: 1 },
    });
  } catch (e) {
    console.error('Poke admin error:', e);
    res.status(500).json({ success: false, message: 'Server Error', error: e.message });
  }
});

// Admin: delete message (admin can delete any message)
router.delete('/admin/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server Error', error: e.message });
  }
});

module.exports = router;

