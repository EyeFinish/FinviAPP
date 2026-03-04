const mongoose = require('mongoose');

const fintocLinkSchema = new mongoose.Schema(
  {
    linkToken: {
      type: String,
      required: [true, 'El link token es obligatorio'],
      unique: true,
    },
    linkId: {
      type: String,
    },
    institutionName: {
      type: String,
      default: '',
    },
    holderName: {
      type: String,
      default: '',
    },
    holderType: {
      type: String,
      enum: ['individual', 'business'],
      default: 'individual',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'error'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FintocLink', fintocLinkSchema);
