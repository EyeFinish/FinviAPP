const mongoose = require('mongoose');

const cashFlowCategorySchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    tipo: {
      type: String,
      enum: ['ingreso', 'costo_fijo', 'costo_variable'],
      required: true,
    },
    montoPromedio: { type: Number, default: 0 },
    frecuenciaMensual: { type: Number, default: 1 }, // cuántas veces al mes aparece
    patronDescripcion: { type: String, default: '' }, // patrón de detección de movimientos
    esAutomatico: { type: Boolean, default: true }, // detectado automáticamente
    activo: { type: Boolean, default: true }, // el usuario puede desactivar
    mesesDetectado: { type: Number, default: 0 }, // en cuántos meses de los últimos 3-6 apareció
    confianza: { type: Number, default: 0, min: 0, max: 100 }, // % de confianza de la detección
    creditoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Credit', default: null }, // si viene de un crédito
  },
  { timestamps: true }
);

// Índice para buscar por tipo y estado activo rápidamente
cashFlowCategorySchema.index({ tipo: 1, activo: 1 });

module.exports = mongoose.model('CashFlowCategory', cashFlowCategorySchema);
