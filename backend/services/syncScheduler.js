const cron = require('node-cron');
const FintocLink = require('../models/FintocLink');
const Account = require('../models/Account');
const Movement = require('../models/Movement');
const fintocService = require('./fintocService');

async function syncAllUsers() {
  console.log('[SyncScheduler] Iniciando sincronización automática...');

  const activeLinks = await FintocLink.find({ status: 'active' }).lean();
  if (!activeLinks.length) {
    console.log('[SyncScheduler] No hay links activos para sincronizar');
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

          if (movementsData.length > 0) {
            const bulkOps = movementsData.map((movData) => {
              const fechaPost = movData.post_date ? new Date(movData.post_date) : null;
              const fechaTx = movData.transaction_date ? new Date(movData.transaction_date) : null;
              return {
                updateOne: {
                  filter: { fintocId: movData.id },
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
      } catch (err) {
        console.error(`[SyncScheduler] Error en link ${link._id}:`, err.message);
        await FintocLink.findByIdAndUpdate(link._id, { status: 'error' }).catch(() => {});
      }
    }
  }

  console.log('[SyncScheduler] Sincronización automática completada');
}

function iniciarSyncScheduler() {
  // Cada hora en el minuto 0
  cron.schedule('0 * * * *', syncAllUsers);
  console.log('[SyncScheduler] Cron de sincronización iniciado (cada hora)');
}

module.exports = { iniciarSyncScheduler, syncAllUsers };
