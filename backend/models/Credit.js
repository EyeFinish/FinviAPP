const mongoose = require('mongoose');

const TIPOS_ROTATIVOS = ['tarjeta_credito', 'linea_credito'];

const creditSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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
    // Opcional para rotativos (no tienen cuotas fijas)
    cuotaMensual: {
      type: Number,
      default: 0,
      min: 0,
    },
    cuotasPagadas: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Opcional para rotativos
    cuotasTotales: {
      type: Number,
      default: 0,
      min: 0,
    },
    fechaInicio: {
      type: Date,
      default: null,
    },
    // Opcional para rotativos (no tienen fecha de término)
    fechaVencimiento: {
      type: Date,
      default: null,
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
    // --- Patrones de pago detectados ---
    patronesPago: {
      type: [String],
      default: [],
    },
    cuentaDestinoId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Validación condicional: campos obligatorios solo para créditos en cuotas
creditSchema.pre('validate', function () {
  if (!TIPOS_ROTATIVOS.includes(this.tipoCredito)) {
    if (!this.cuotaMensual || this.cuotaMensual <= 0) {
      this.invalidate('cuotaMensual', 'La cuota mensual es obligatoria para créditos en cuotas');
    }
    if (!this.cuotasTotales || this.cuotasTotales < 1) {
      this.invalidate('cuotasTotales', 'El total de cuotas es obligatorio para créditos en cuotas');
    }
    if (!this.fechaInicio) {
      this.invalidate('fechaInicio', 'La fecha de inicio es obligatoria');
    }
    if (!this.fechaVencimiento) {
      this.invalidate('fechaVencimiento', 'La fecha de vencimiento es obligatoria');
    }
  }
});

// Helper estático para verificar si un tipo es rotativo
creditSchema.statics.TIPOS_ROTATIVOS = TIPOS_ROTATIVOS;
creditSchema.methods.esRotativo = function () {
  return TIPOS_ROTATIVOS.includes(this.tipoCredito);
};

module.exports = mongoose.model('Credit', creditSchema);
