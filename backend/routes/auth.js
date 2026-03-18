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
  });
});

module.exports = router;
