const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/suscripcion/estado
// Devuelve el estado de suscripción del usuario autenticado
router.get('/estado', auth, async (req, res) => {
  try {
    res.json(req.user.suscripcion);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener estado de suscripción' });
  }
});

// POST /api/suscripcion/vincular
// Vincula el ID de RevenueCat al usuario (llamado por la app al inicializar el SDK)
router.post('/vincular', auth, async (req, res) => {
  try {
    const { revenuecatId } = req.body;
    if (!revenuecatId) {
      return res.status(400).json({ message: 'revenuecatId es requerido' });
    }

    const user = await User.findById(req.user._id);
    user.suscripcion.revenuecatId = revenuecatId;
    await user.save();

    res.json({ message: 'RevenueCat ID vinculado correctamente', suscripcion: user.suscripcion });
  } catch (err) {
    res.status(500).json({ message: 'Error al vincular RevenueCat ID' });
  }
});

module.exports = router;
