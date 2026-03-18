const mongoose = require('mongoose');

const pushTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  platform: { type: String, enum: ['ios', 'android', 'web'], default: 'android' },
}, { timestamps: true });

pushTokenSchema.index({ user: 1, token: 1 }, { unique: true });

module.exports = mongoose.model('PushToken', pushTokenSchema);
