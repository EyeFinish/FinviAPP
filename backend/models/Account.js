const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    fintocId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      default: '',
    },
    officialName: {
      type: String,
      default: '',
    },
    number: {
      type: String,
      default: '',
    },
    balance: {
      available: {
        type: Number,
        default: 0,
      },
      current: {
        type: Number,
        default: 0,
      },
      limit: {
        type: Number,
        default: 0,
      },
    },
    currency: {
      type: String,
      default: 'CLP',
    },
    type: {
      type: String,
      default: '',
    },
    link: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FintocLink',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Account', accountSchema);
