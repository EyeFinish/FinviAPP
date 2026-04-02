const express = require('express');
const User = require('../models/User');
const { enviarNotificacion } = require('../services/notificationService');
const router = express.Router();

// POST /api/webhooks/revenuecat
// Sin JWT — autenticado por shared secret en header Authorization
// Usa express.raw para obtener el body sin parsear (necesario para verificación)
router.post('/revenuecat', express.raw({ type: 'application/json' }), async (req, res) => {
  // Verificar shared secret
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== process.env.REVENUECAT_WEBHOOK_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Responder 200 inmediatamente para que RevenueCat no reintente
  res.status(200).json({ received: true });

  try {
    const payload = JSON.parse(req.body);
    const event = payload.event;

    if (!event || !event.app_user_id) return;

    const userId = event.app_user_id;
    const user = await User.findById(userId);
    if (!user) {
      console.warn('[Webhook RC] Usuario no encontrado:', userId);
      return;
    }

    const sub = user.suscripcion;

    switch (event.type) {
      case 'INITIAL_PURCHASE': {
        const esTrial = event.is_trial_period === true || event.period_type === 'TRIAL';
        sub.estado        = esTrial ? 'trial' : 'activo';
        sub.productoId    = event.product_id || null;
        sub.plataforma    = event.store === 'APP_STORE' ? 'ios' : 'android';
        sub.fechaRenovacion = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
        if (esTrial) {
          sub.inicioTrial = event.purchased_at_ms ? new Date(event.purchased_at_ms) : new Date();
          sub.finTrial    = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
        } else {
          sub.inicioTrial = null;
          sub.finTrial    = null;
        }
        sub.fechaCancelacion = null;
        sub.fechaExpiracion  = null;
        break;
      }

      case 'RENEWAL': {
        sub.estado          = 'activo';
        sub.inicioTrial     = null;
        sub.finTrial        = null;
        sub.fechaRenovacion = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
        sub.fechaCancelacion = null;
        sub.fechaExpiracion  = null;
        break;
      }

      case 'CANCELLATION': {
        sub.estado           = 'cancelado';
        sub.fechaCancelacion = new Date();
        sub.fechaExpiracion  = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
        break;
      }

      case 'EXPIRATION': {
        sub.estado          = 'vencido';
        sub.fechaExpiracion = new Date();
        break;
      }

      case 'BILLING_ISSUE': {
        await enviarNotificacion(userId, {
          titulo: 'Problema con tu pago',
          cuerpo: 'Hubo un problema al procesar el cobro de tu suscripción. Revisa tu método de pago.',
          tipo: 'suscripcion',
        });
        break;
      }

      case 'PRODUCT_CHANGE': {
        sub.productoId = event.new_product_id || event.product_id || sub.productoId;
        break;
      }

      default:
        console.log('[Webhook RC] Evento no manejado:', event.type);
        return;
    }

    await user.save();
    console.log(`[Webhook RC] ${event.type} procesado para usuario ${userId}`);
  } catch (err) {
    console.error('[Webhook RC] Error procesando evento:', err.message);
  }
});

module.exports = router;
