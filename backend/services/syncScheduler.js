const cron = require('node-cron');
const FintocLink = require('../models/FintocLink');
const Account = require('../models/Account');
const Movement = require('../models/Movement');
const fintocService = require('./fintocService');
const { calcularActualizacionError, calcularActualizacionExito } = require('./fintocErrorHandler');
const { enviarNotificacion } = require('./notificationService');

// Sincroniza un único link. Acepta sinceOverride (string 'YYYY-MM-DD') para limitar el lookback.
// Cuando sinceOverride no se pasa, usa el lookback estándar de 30 días desde lastSyncedAt.
async function syncSingleLink(link, options = {}) {
  const { sinceOverride } = options;
  const userId = String(link.user);

  try {
    const accountsData = await fintocService.getAccounts(link.linkToken);

    let totalNuevos = 0;

    const accountPromises = accountsData.map(async (accData) => {
      const account = await Account.findOne({ fintocId: accData.id });
      if (!account) return;

      // Actualizar balance
      await Account.findByIdAndUpdate(account._id, {
        balance: {
          available: accData.balance?.available || 0,
          current: accData.balance?.current || 0,
          limit: accData.balance?.limit || 0,
        },
      });

      // Calcular fecha desde donde buscar movimientos
      let sinceDate = sinceOverride || '2000-01-01';
      if (!sinceOverride && account.lastSyncedAt) {
        // 30 días de margen para capturar pendientes que se confirmaron después
        const margen = new Date(account.lastSyncedAt);
        margen.setDate(margen.getDate() - 30);
        sinceDate = margen.toISOString().split('T')[0];
      }

      const movementsData = await fintocService.getMovements(accData.id, link.linkToken, { since: sinceDate });

      console.log(`[SyncScheduler] Cuenta ${accData.id}: ${movementsData.length} movimientos desde Fintoc (since: ${sinceDate})`);

      if (movementsData.length > 0) {
        const bulkOps = movementsData.map((movData) => {
          const fechaPost = movData.post_date ? new Date(movData.post_date) : null;
          const fechaTx = movData.transaction_date ? new Date(movData.transaction_date) : null;
          return {
            updateOne: {
              filter: { fintocId: movData.id, user: account.user }, // índice compuesto {fintocId, user}
              update: {
                $set: {
                  user: account.user,
                  fintocId: movData.id,
                  amount: movData.amount || 0,
                  description: movData.description || '',
                  postDate: fechaPost || fechaTx || new Date(),
                  transactionDate: fechaTx,
                  currency: movData.currency || 'CLP',
                  type: movData.type || '',
                  pending: movData.pending || false,
                  senderAccount: movData.sender_account || null,
                  recipientAccount: movData.recipient_account || null,
                  comment: movData.comment || '',
                  account: account._id,
                },
              },
              upsert: true,
            },
          };
        });
        const bulkResult = await Movement.bulkWrite(bulkOps, { ordered: false });
        const nuevos = bulkResult.upsertedCount || 0;
        totalNuevos += nuevos;
        console.log(`[SyncScheduler] Usuario ${userId} - cuenta ${accData.id}: ${movementsData.length} movimientos (${nuevos} nuevos)`);

        if (nuevos > 0) {
          const cuerpo = nuevos === 1
            ? 'Se detectó 1 nueva transacción en tu cuenta bancaria.'
            : `Se detectaron ${nuevos} nuevas transacciones en tu cuenta bancaria.`;
          enviarNotificacion(userId, {
            titulo: 'Nueva transacción bancaria',
            cuerpo,
            tipo: 'nueva_transaccion',
          }).catch((err) => console.error('[SyncScheduler] Error enviando notificación:', err.message));
        }
      }

      await Account.findByIdAndUpdate(account._id, { lastSyncedAt: new Date() });
    });

    await Promise.allSettled(accountPromises);

    // Éxito: reset contador de fallos y guardar resultado del sync
    await FintocLink.findByIdAndUpdate(link._id, {
      ...calcularActualizacionExito(),
      lastSyncResult: { movimientos: totalNuevos, error: null, fecha: new Date() },
    });

  } catch (err) {
    console.error(`[SyncScheduler] Error en link ${link._id}:`, err.message);

    const actualizacion = calcularActualizacionError(err, link);
    await FintocLink.findByIdAndUpdate(link._id, {
      ...actualizacion,
      lastSyncResult: { movimientos: 0, error: err.message, fecha: new Date() },
    }).catch(() => {});

    if (actualizacion.status === 'error') {
      console.error(`[SyncScheduler] Link ${link._id} marcado como 'error' tras ${link.syncFailureCount + 1} fallos consecutivos`);
    } else {
      console.warn(`[SyncScheduler] Error transitorio en link ${link._id} (fallo #${actualizacion.syncFailureCount}), se reintentará`);
    }
  }
}

async function syncAllUsers() {
  console.log('[SyncScheduler] Iniciando sincronización automática...');

  // Incluir links en 'error' para permitir auto-recovery: si Fintoc responde OK,
  // calcularActualizacionExito() los resetea automáticamente a status:'active'
  const activeLinks = await FintocLink.find({
    $or: [
      { status: 'active' },
      // Links en error por fallos transitorios (timeout/5xx): pueden auto-recuperarse
      { status: 'error', lastSyncError: { $not: /^\[Permanente\]/ } },
    ],
  }).lean();
  if (!activeLinks.length) {
    console.log('[SyncScheduler] No hay links para sincronizar');
    return;
  }

  for (const link of activeLinks) {
    // Solicitar a Fintoc datos frescos del banco. Fintoc responde vía webhook
    // 'account.refresh_intent.succeeded' cuando los datos están listos.
    // El syncSingleLink de abajo es fallback por si el webhook no llega.
    try {
      await fintocService.createRefreshIntent(link.linkToken, 'only_last');
      console.log(`[SyncScheduler] Refresh intent creado para link ${link._id}`);
    } catch (err) {
      const status = err.response?.status;
      // 409 = refresh ya en curso (cooldown activo), ignorar
      if (status !== 409) {
        console.warn(`[SyncScheduler] Refresh intent fallido para link ${link._id} (${status}): ${err.message}`);
      }
    }
    await syncSingleLink(link);
  }

  console.log('[SyncScheduler] Sincronización automática completada');
}

function iniciarSyncScheduler() {
  // Cada 5 minutos para detectar transacciones recientes más rápido
  cron.schedule('*/5 * * * *', syncAllUsers);
  console.log('[SyncScheduler] Cron de sincronización iniciado (cada 5 minutos)');
}

module.exports = { iniciarSyncScheduler, syncAllUsers, syncSingleLink };
