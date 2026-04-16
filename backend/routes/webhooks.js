const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const FintocLink = require('../models/FintocLink');
const Account = require('../models/Account');
const { enviarNotificacion } = require('../services/notificationService');
const { syncAllUsers, syncSingleLink } = require('../services/syncScheduler');
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

// POST /api/webhooks/fintoc
// Notificación en tiempo real de Fintoc cuando hay nuevos movimientos.
// Requiere configurar el webhook en el dashboard de Fintoc apuntando a esta URL.
// Fintoc envía Fintoc-Signature con formato t=TIMESTAMP,v1=HMAC_SHA256 para verificar autenticidad.
router.post('/fintoc', express.raw({ type: 'application/json' }), async (req, res) => {
  // Verificar firma HMAC si está configurada
  const secret = process.env.FINTOC_WEBHOOK_SECRET;
  if (secret) {
    // Header real: "Fintoc-Signature" (Node lo recibe en lowercase)
    const sigHeader = req.headers['fintoc-signature'];
    if (!sigHeader) {
      return res.status(401).json({ message: 'Firma faltante' });
    }
    // Parsear formato: t=TIMESTAMP,v1=HMAC_HASH
    const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
    const timestamp = parts['t'];
    const receivedHash = parts['v1'];
    if (!timestamp || !receivedHash) {
      return res.status(401).json({ message: 'Formato de firma inválido' });
    }
    // Mensaje firmado = "{timestamp}.{raw_body}" (protección contra replay attacks)
    const signedMessage = `${timestamp}.${req.body}`;
    const expected = crypto.createHmac('sha256', secret).update(signedMessage).digest('hex');
    const recvBuf = Buffer.from(receivedHash, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (recvBuf.length !== expBuf.length || !crypto.timingSafeEqual(recvBuf, expBuf)) {
      return res.status(401).json({ message: 'Firma inválida' });
    }
  }

  // Responder 200 inmediatamente para que Fintoc no reintente
  res.status(200).json({ received: true });

  try {
    const payload = JSON.parse(req.body);
    const tipo = payload.type;

    console.log(`[Webhook Fintoc] Evento recibido: ${tipo}`);

    // Eventos que indican nuevos movimientos disponibles
    const eventosSync = [
      'account.refresh_intent.succeeded',   // cuenta terminó de refrescarse — hay datos nuevos
      'account.refresh_intent.movements_modified', // movimientos existentes cambiaron (pending→confirmed)
      'link.refresh_intent.succeeded',       // refresh de link completo (todas las cuentas)
    ];

    // Eventos que indican credenciales inválidas — marcar link como error
    const eventosError = [
      'link.credentials_changed',
      'account.refresh_intent.rejected',    // banco rechazó credenciales — necesita reconexión
    ];

    if (eventosSync.includes(tipo) || eventosError.includes(tipo)) {
      // Lookback de 2 días: el webhook ya confirma que hay datos nuevos, no necesitamos 30 días
    const sinceOverride = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dispararSync = async (link) => {
      await syncSingleLink(link, { sinceOverride });
    };

      // Para account.refresh_intent.* el payload trae data.refreshed_object_id = account Fintoc ID
      const accountFintocId = payload.data?.refreshed_object_id;
      // Para link.refresh_intent.* y link.credentials_changed el payload trae link_id
      const linkId = payload.data?.link_id || payload.link_id;

      if (accountFintocId && payload.data?.refreshed_object === 'account') {
        // Buscar Account por fintocId → obtener FintocLink asociado
        const account = await Account.findOne({ fintocId: accountFintocId }).lean();
        if (account) {
          const link = await FintocLink.findById(account.link).lean();
          if (link) {
            console.log(`[Webhook Fintoc] Evento "${tipo}" para cuenta ${accountFintocId} (link ${link._id})`);
            dispararSync(link).catch((err) => console.error('[Webhook Fintoc] Error en sync:', err.message));
          } else {
            console.warn(`[Webhook Fintoc] Link no encontrado para cuenta ${accountFintocId}`);
          }
        } else {
          console.warn(`[Webhook Fintoc] Account no encontrada para fintocId: ${accountFintocId}`);
        }
      } else if (linkId) {
        const link = await FintocLink.findOne({ linkId }).lean();
        if (link) {
          console.log(`[Webhook Fintoc] Evento "${tipo}" para link ${link._id} (usuario ${link.user})`);
          dispararSync(link).catch((err) => console.error('[Webhook Fintoc] Error en sync:', err.message));
        } else {
          console.warn(`[Webhook Fintoc] Link no encontrado para linkId: ${linkId}`);
        }
      } else {
        // Fallback: sin referencia específica — sincronizar todos
        console.log(`[Webhook Fintoc] Sin account/link ID — sincronizando todos los usuarios`);
        syncAllUsers().catch((err) => console.error('[Webhook Fintoc] Error en syncAllUsers:', err.message));
      }
    } else {
      console.log(`[Webhook Fintoc] Evento ignorado: ${tipo}`);
    }
  } catch (err) {
    console.error('[Webhook Fintoc] Error procesando evento:', err.message);
  }
});

module.exports = router;
