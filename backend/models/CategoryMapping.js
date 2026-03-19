const mongoose = require('mongoose');

const categoryMappingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    descKey: {
      type: String,
      required: true,
    },
    categoria: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

categoryMappingSchema.index({ user: 1, descKey: 1 }, { unique: true });

module.exports = mongoose.model('CategoryMapping', categoryMappingSchema);
