const cron = require('node-cron');
const FintocLink = require('../models/FintocLink');
const Account = require('../models/Account');
const Movement = require('../models/Movement');
const fintocService = require('./fintocService');
const { calcularActualizacionError, calcularActualizacionExito } = require('./fintocErrorHandler');

async function syncAllUsers() {
  console.log('[SyncScheduler] Iniciando sincronización automática...');

  // Incluir links en 'error' para permitir auto-recovery: si Fintoc responde OK,
  // calcularActualizacionExito() los resetea automáticamente a status:'active'
  const activeLinks = await FintocLink.find({ status: { $in: ['active', 'error'] } }).lean();
  if (!activeLinks.length) {
    console.log('[SyncScheduler] No hay links para sincronizar');
    return;
  }

  // Agrupar links por usuario para procesar secuencialmente
  const linksByUser = activeLinks.reduce((map, link) => {
    const uid = String(link.user);
    if (!map[uid]) map[uid] = [];
    map[uid].push(link);
    return map;
  }, {});

  for (const [userId, links] of Object.entries(linksByUser)) {
    for (const link of links) {
      try {
        const accountsData = await fintocService.getAccounts(link.linkToken);

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

          // 30 días de margen para capturar pendientes que se confirmaron después
          let sinceDate = '2000-01-01';
          if (account.lastSyncedAt) {
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
            await Movement.bulkWrite(bulkOps, { ordered: false });
            console.log(`[SyncScheduler] Usuario ${userId} - cuenta ${accData.id}: ${movementsData.length} movimientos`);
          }

          await Account.findByIdAndUpdate(account._id, { lastSyncedAt: new Date() });
        });

        await Promise.allSettled(accountPromises);

        // Éxito: reset contador de fallos
        await FintocLink.findByIdAndUpdate(link._id, calcularActualizacionExito());

      } catch (err) {
        console.error(`[SyncScheduler] Error en link ${link._id}:`, err.message);

        // Clasificar error: solo marcar permanentemente si es error de credenciales
        // Para errores transitorios (timeout, red, 5xx): mantener activo hasta MAX fallos
        const actualizacion = calcularActualizacionError(err, link);
        await FintocLink.findByIdAndUpdate(link._id, actualizacion).catch(() => {});

        if (actualizacion.status === 'error') {
          console.error(`[SyncScheduler] Link ${link._id} marcado como 'error' tras ${link.syncFailureCount + 1} fallos consecutivos`);
        } else {
          console.warn(`[SyncScheduler] Error transitorio en link ${link._id} (fallo #${actualizacion.syncFailureCount}), se reintentará`);
        }
      }
    }
  }

  console.log('[SyncScheduler] Sincronización automática completada');
}

function iniciarSyncScheduler() {
  // Cada 5 minutos para detectar transacciones recientes más rápido
  cron.schedule('*/5 * * * *', syncAllUsers);
  console.log('[SyncScheduler] Cron de sincronización iniciado (cada 5 minutos)');
}

module.exports = { iniciarSyncScheduler, syncAllUsers };
