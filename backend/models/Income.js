const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    nombre: {
      type: String,
      required: [true, 'El nombre del ingreso es obligatorio'],
      trim: true,
    },
    monto: {
      type: Number,
      required: [true, 'El monto es obligatorio'],
      min: 0,
    },
    categoria: {
      type: String,
      enum: ['sueldo', 'renta', 'beneficio', 'otro'],
      default: 'otro',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Income', incomeSchema);
