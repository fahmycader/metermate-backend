const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true, trim: true },
  meta: { type: Object },
  read: { type: Boolean, default: false },
  starred: { type: Boolean, default: false },
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;

