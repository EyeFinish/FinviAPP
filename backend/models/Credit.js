const mongoose = require('mongoose');

const creditSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del crédito es obligatorio'],
      trim: true,
    },
    institucion: {
      type: String,
      required: [true, 'La institución es obligatoria'],
      trim: true,
    },
    tipoCredito: {
      type: String,
      enum: ['hipotecario', 'consumo', 'automotriz', 'educacion', 'tarjeta_credito', 'linea_credito', 'otro'],
      required: [true, 'El tipo de crédito es obligatorio'],
    },
    montoOriginal: {
      type: Number,
      required: [true, 'El monto original es obligatorio'],
      min: 0,
    },
    saldoPendiente: {
      type: Number,
      required: [true, 'El saldo pendiente es obligatorio'],
      min: 0,
    },
    tasaInteres: {
      type: Number,
      default: 0,
      min: 0,
    },
    cuotaMensual: {
      type: Number,
      required: [true, 'La cuota mensual es obligatoria'],
      min: 0,
    },
    cuotasPagadas: {
      type: Number,
      default: 0,
      min: 0,
    },
    cuotasTotales: {
      type: Number,
      required: [true, 'El total de cuotas es obligatorio'],
      min: 1,
    },
    fechaInicio: {
      type: Date,
      required: [true, 'La fecha de inicio es obligatoria'],
    },
    fechaVencimiento: {
      type: Date,
      required: [true, 'La fecha de vencimiento es obligatoria'],
    },
    estado: {
      type: String,
      enum: ['activo', 'pagado', 'moroso', 'refinanciado'],
      default: 'activo',
    },
    moneda: {
      type: String,
      default: 'CLP',
    },
    fintocAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    requiereCompletar: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Credit', creditSchema);
