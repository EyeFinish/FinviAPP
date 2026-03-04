const mongoose = require('mongoose');

const movementSchema = new mongoose.Schema(
  {
    fintocId: {
      type: String,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    postDate: {
      type: Date,
    },
    transactionDate: {
      type: Date,
    },
    currency: {
      type: String,
      default: 'CLP',
    },
    type: {
      type: String,
      default: '',
    },
    pending: {
      type: Boolean,
      default: false,
    },
    senderAccount: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    recipientAccount: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    comment: {
      type: String,
      default: '',
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Movement', movementSchema);
