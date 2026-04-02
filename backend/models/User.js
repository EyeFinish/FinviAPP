const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false,
  },
  suscripcion: {
    estado: {
      type: String,
      enum: ['trial', 'activo', 'cancelado', 'vencido', 'sin_suscripcion'],
      default: 'sin_suscripcion',
    },
    revenuecatId:    { type: String, default: null },
    productoId:      { type: String, default: null },
    plataforma:      { type: String, enum: ['ios', 'android', null], default: null },
    inicioTrial:     { type: Date, default: null },
    finTrial:        { type: Date, default: null },
    fechaRenovacion: { type: Date, default: null },
    fechaCancelacion:{ type: Date, default: null },
    fechaExpiracion: { type: Date, default: null },
  },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.compararPassword = async function (candidata) {
  return bcrypt.compare(candidata, this.password);
};

module.exports = mongoose.model('User', userSchema);
