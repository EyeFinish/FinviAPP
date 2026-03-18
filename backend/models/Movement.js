const mongoose = require('mongoose');

const movementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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
    // --- Detección de pagos de créditos ---
    esPagoCredito: {
      type: Boolean,
      default: false,
    },
    creditoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Credit',
      default: null,
    },
    confianzaMatch: {
      type: String,
      enum: ['alta', 'media', 'baja', null],
      default: null,
    },
    // --- Asignación a obligaciones (costos fijos / deudas) ---
    asignacion: {
      tipo: {
        type: String,
        enum: ['costoFijo', 'deuda', null],
        default: null,
      },
      referenciaId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      mes: {
        type: String, // formato 'YYYY-MM'
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

movementSchema.index({ user: 1, 'asignacion.tipo': 1, 'asignacion.referenciaId': 1, 'asignacion.mes': 1 });

module.exports = mongoose.model('Movement', movementSchema);
