const mongoose = require('mongoose');

const fixedCostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    nombre: {
      type: String,
      required: [true, 'El nombre del costo es obligatorio'],
      trim: true,
    },
    monto: {
      type: Number,
      required: [true, 'El monto mensual es obligatorio'],
      min: 0,
    },
    categoria: {
      type: String,
      enum: ['arriendo', 'servicios', 'alimentacion', 'educacion', 'salud', 'seguros', 'transporte', 'otro'],
      required: [true, 'La categoría es obligatoria'],
    },
    tipoCompromiso: {
      type: String,
      enum: ['temporal', 'permanente'],
      required: [true, 'El tipo de compromiso es obligatorio'],
    },
    duracion: {
      type: Number,
      min: 1,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FixedCost', fixedCostSchema);
