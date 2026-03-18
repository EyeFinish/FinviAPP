const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  titulo: { type: String, required: true },
  cuerpo: { type: String, required: true },
  tipo: {
    type: String,
    enum: ['pago_proximo', 'gasto_inusual', 'resumen_semanal', 'salud_baja', 'general'],
    default: 'general',
  },
  leida: { type: Boolean, default: false },
  fecha: { type: Date, default: Date.now },
}, { timestamps: true });

notificationSchema.index({ user: 1, fecha: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
