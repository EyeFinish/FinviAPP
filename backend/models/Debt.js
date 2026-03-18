const mongoose = require('mongoose');

const debtSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    nombre: {
      type: String,
      required: [true, 'El nombre o institución es obligatorio'],
      trim: true,
    },
    montoTotal: {
      type: Number,
      required: [true, 'El monto total del crédito es obligatorio'],
      min: 0,
    },
    tasaInteres: {
      type: Number,
      required: [true, 'La tasa de interés anual es obligatoria'],
      min: 0,
    },
    plazoAnios: {
      type: Number,
      default: 0,
      min: 0,
    },
    plazoMeses: {
      type: Number,
      default: 0,
      min: 0,
    },
    sistemaAmortizacion: {
      type: String,
      enum: ['frances', 'aleman', 'simple'],
      default: 'frances',
    },
    // Cuotas pagadas ingresadas por el usuario
    cuotasPagadas: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Campos calculados automáticamente al guardar
    cuotasTotales: { type: Number },
    cuotaMensual: { type: Number },
    interesTotal: { type: Number },
  },
  { timestamps: true }
);

function calcularCamposDeuda(doc) {
  const n = (doc.plazoAnios || 0) * 12 + (doc.plazoMeses || 0);
  if (n <= 0) {
    doc.cuotasTotales = 0;
    doc.cuotaMensual = 0;
    doc.interesTotal = 0;
    return;
  }
  doc.cuotasTotales = n;
  const P = doc.montoTotal;
  const r = doc.tasaInteres / 100 / 12;

  if (doc.sistemaAmortizacion === 'frances') {
    if (r > 0) {
      doc.cuotaMensual = Math.round(P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
    } else {
      doc.cuotaMensual = Math.round(P / n);
    }
    doc.interesTotal = Math.round(doc.cuotaMensual * n - P);
  } else if (doc.sistemaAmortizacion === 'aleman') {
    const amort = P / n;
    let totalInt = 0;
    let saldo = P;
    for (let i = 0; i < n; i++) {
      totalInt += saldo * r;
      saldo -= amort;
    }
    doc.interesTotal = Math.round(totalInt);
    doc.cuotaMensual = Math.round(amort + P * r); // primera cuota (la más alta)
  } else {
    const totalInt = P * (doc.tasaInteres / 100) * ((doc.plazoAnios || 0) + (doc.plazoMeses || 0) / 12);
    doc.interesTotal = Math.round(totalInt);
    doc.cuotaMensual = Math.round((P + totalInt) / n);
  }
}

debtSchema.pre('save', function () {
  calcularCamposDeuda(this);
  // Asegurar que cuotasPagadas no exceda cuotasTotales
  if (this.cuotasPagadas > this.cuotasTotales) {
    this.cuotasPagadas = this.cuotasTotales;
  }
});

debtSchema.virtual('cuotasRestantes').get(function () {
  return (this.cuotasTotales || 0) - (this.cuotasPagadas || 0);
});

debtSchema.virtual('saldoPendiente').get(function () {
  const k = this.cuotasPagadas || 0;
  const n = this.cuotasTotales || 0;
  const P = this.montoTotal || 0;
  const r = (this.tasaInteres || 0) / 100 / 12;
  if (k >= n || n === 0) return 0;

  if (this.sistemaAmortizacion === 'frances') {
    if (r > 0) {
      return Math.max(0, Math.round(P * Math.pow(1 + r, k) - this.cuotaMensual * (Math.pow(1 + r, k) - 1) / r));
    }
    return Math.max(0, Math.round(P - this.cuotaMensual * k));
  } else if (this.sistemaAmortizacion === 'aleman') {
    return Math.max(0, Math.round(P - (P / n) * k));
  } else {
    return Math.max(0, Math.round((P + this.interesTotal) - this.cuotaMensual * k));
  }
});

debtSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Debt', debtSchema);
