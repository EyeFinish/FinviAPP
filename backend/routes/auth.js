const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

const generarToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// POST /api/auth/registro
router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    const existente = await User.findOne({ email });
    if (existente) {
      return res.status(400).json({ message: 'Ya existe una cuenta con ese email' });
    }

    const user = await User.create({ nombre, email, password });
    const token = generarToken(user._id);

    res.status(201).json({
      token,
      user: { id: user._id, nombre: user.nombre, email: user.email },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.compararPassword(password))) {
      return res.status(401).json({ message: 'Email o contraseña incorrectos' });
    }

    const token = generarToken(user._id);

    res.json({
      token,
      user: { id: user._id, nombre: user.nombre, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({
    id: req.user._id,
    nombre: req.user.nombre,
    email: req.user.email,
    creadoEn: req.user.createdAt,
  });
});

// PUT /api/auth/perfil — actualizar nombre y/o email
router.put('/perfil', auth, async (req, res) => {
  try {
    const { nombre, email } = req.body;
    if (!nombre && !email) {
      return res.status(400).json({ message: 'Debes enviar al menos un campo para actualizar' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (email && email !== user.email) {
      const existe = await User.findOne({ email });
      if (existe) return res.status(400).json({ message: 'Ese email ya está en uso por otra cuenta' });
      user.email = email;
    }
    if (nombre) user.nombre = nombre;

    await user.save();
    res.json({ id: user._id, nombre: user.nombre, email: user.email });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: 'Error al actualizar perfil' });
  }
});

// PUT /api/auth/password — cambiar contraseña
router.put('/password', auth, async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;
    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ message: 'Contraseña actual y nueva son requeridas' });
    }
    if (passwordNueva.length < 6) {
      return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const coincide = await user.compararPassword(passwordActual);
    if (!coincide) return res.status(401).json({ message: 'La contraseña actual es incorrecta' });

    user.password = passwordNueva;
    await user.save();
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ message: 'Error al cambiar contraseña' });
  }
});

// DELETE /api/auth/cuenta — eliminar cuenta y todos los datos
router.delete('/cuenta', auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Debes confirmar con tu contraseña' });

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const coincide = await user.compararPassword(password);
    if (!coincide) return res.status(401).json({ message: 'Contraseña incorrecta' });

    const userId = req.user._id;
    const mongoose = require('mongoose');

    // Eliminar todos los datos asociados en paralelo
    await Promise.all([
      mongoose.model('Account').deleteMany({ user: userId }).catch(() => {}),
      mongoose.model('Movement').deleteMany({ user: userId }).catch(() => {}),
      mongoose.model('Debt').deleteMany({ user: userId }).catch(() => {}),
      mongoose.model('Credit').deleteMany({ user: userId }).catch(() => {}),
      mongoose.model('FixedCost').deleteMany({ user: userId }).catch(() => {}),
      mongoose.model('Income').deleteMany({ user: userId }).catch(() => {}),
      mongoose.model('FintocLink').deleteMany({ user: userId }).catch(() => {}),
      mongoose.model('Notification').deleteMany({ user: userId }).catch(() => {}),
      mongoose.model('PushToken').deleteMany({ user: userId }).catch(() => {}),
      mongoose.model('CategoryMapping').deleteMany({ user: userId }).catch(() => {}),
    ]);

    await User.findByIdAndDelete(userId);
    res.json({ message: 'Cuenta eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar cuenta' });
  }
});

module.exports = router;
