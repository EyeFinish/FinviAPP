const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const PushToken = require('../models/PushToken');
const Notification = require('../models/Notification');

router.use(auth);

// Registrar token de push
router.post('/register-token', async (req, res) => {
  const { token, platform } = req.body;
  if (!token) return res.status(400).json({ error: 'Token requerido' });

  await PushToken.findOneAndUpdate(
    { user: req.user._id, token },
    { user: req.user._id, token, platform: platform || 'android' },
    { upsert: true, new: true }
  );
  res.json({ ok: true });
});

// Obtener notificaciones del usuario
router.get('/', async (req, res) => {
  const notificaciones = await Notification.find({ user: req.user._id })
    .sort({ fecha: -1 })
    .limit(50);
  res.json(notificaciones);
});

// Marcar como leída
router.put('/:id/read', async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { leida: true },
    { new: true }
  );
  if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
  res.json(notif);
});

// Marcar todas como leídas
router.put('/read-all', async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, leida: false },
    { leida: true }
  );
  res.json({ ok: true });
});

module.exports = router;
