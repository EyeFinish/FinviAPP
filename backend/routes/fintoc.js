const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const fintocService = require('../services/fintocService');
const FintocLink = require('../models/FintocLink');
const Account = require('../models/Account');
const Movement = require('../models/Movement');
const Credit = require('../models/Credit');
const { calcularActualizacionError, calcularActualizacionExito } = require('../services/fintocErrorHandler');
const { enviarNotificacion } = require('../services/notificationService');
const { syncSingleLink } = require('../services/syncScheduler');

// Todas las rutas requieren autenticación
router.use(auth);

// POST /api/fintoc/link-intent
router.post('/link-intent', async (req, res) => {
  try {
    const linkIntent = await fintocService.createLinkIntent();
    res.json({
      widgetToken: linkIntent.widget_token,
      publicKey: process.env.FINTOC_PUBLIC_KEY,
    });
  } catch (error) {
    console.error('Error creando Link Intent:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || 'Error al crear la intención de conexión';
    res.status(status).json({ message });
  }
});

// POST /api/fintoc/exchange
router.post('/exchange', async (req, res) => {
  try {
    console.log('Body recibido en /exchange:', JSON.stringify(req.body));
    const { exchangeToken } = req.body;

    if (!exchangeToken) {
      return res.status(400).json({ message: 'El exchange_token es obligatorio' });
    }

    const userId = req.user._id;

    // 1. Intercambiar exchange_token por el Link completo
    console.log('Intercambiando exchange_token...');
    const linkData = await fintocService.exchangeToken(exchangeToken);

    // 2. Guardar el Link en MongoDB
    const fintocLink = await FintocLink.findOneAndUpdate(
      { linkToken: linkData.link_token },
      {
        user: userId,
        linkToken: linkData.link_token,
        linkId: linkData.id,
        institutionName: linkData.institution?.name || '',
        holderName: linkData.holder_name || '',
        holderType: linkData.holder_type || 'individual',
        status: 'active',
      },
      { upsert: true, new: true }
    );

    console.log('Link guardado:', fintocLink._id);

    // 3. Obtener cuentas desde Fintoc
    console.log('Obteniendo cuentas...');
    const accountsData = await fintocService.getAccounts(linkData.link_token);

    // 4. Guardar cuentas en BD primero (rápido)
    const savedAccountsMap = new Map();
    for (const accData of accountsData) {
      const account = await Account.findOneAndUpdate(
        { fintocId: accData.id },
        {
          user: userId,
          fintocId: accData.id,
          name: accData.name || '',
          officialName: accData.official_name || '',
          number: accData.number || '',
          balance: {
            available: accData.balance?.available || 0,
            current: accData.balance?.current || 0,
            limit: accData.balance?.limit || 0,
          },
          currency: accData.currency || 'CLP',
          type: accData.type || '',
          link: fintocLink._id,
        },
        { upsert: true, new: true }
      );
      savedAccountsMap.set(accData.id, { account, fintocData: accData, movements: [] });
    }

    // 5. Obtener movimientos de TODAS las cuentas en paralelo — historial completo
    const sinceFecha = '2000-01-01';

    const movimientosPromises = accountsData.map(async (accData) => {
      const entry = savedAccountsMap.get(accData.id);
      try {
        console.log(`Obteniendo movimientos para cuenta ${accData.id}...`);
        const movementsData = await fintocService.getMovements(accData.id, linkData.link_token, { since: sinceFecha });

        // Guardar movimientos en bulk (más eficiente que uno por uno)
        const bulkOps = movementsData.map((movData) => {
          const fechaPost = movData.post_date ? new Date(movData.post_date) : null;
          const fechaTx = movData.transaction_date ? new Date(movData.transaction_date) : null;
          return {
            updateOne: {
              filter: { fintocId: movData.id, user: userId }, // índice compuesto {fintocId, user}
              update: {
                $set: {
                  user: userId,
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
                  account: entry.account._id,
                },
              },
              upsert: true,
            },
          };
        });

        if (bulkOps.length > 0) {
          await Movement.bulkWrite(bulkOps, { ordered: false });
        }
        await Account.findByIdAndUpdate(entry.account._id, { lastSyncedAt: new Date() });
        entry.movements = movementsData;
        console.log(`Cuenta ${accData.id}: ${movementsData.length} movimientos sincronizados`);
      } catch (movError) {
        console.error(`Error obteniendo movimientos de cuenta ${accData.id}:`, movError.message);
      }
    });

    await Promise.allSettled(movimientosPromises);

    // 6. Auto-crear créditos para tarjetas de crédito y líneas de crédito
    const creditosAuto = [];
    const tiposEncontrados = {};
    for (const [, entry] of savedAccountsMap) {
      const acc = entry.account;
      tiposEncontrados[acc.type] = (tiposEncontrados[acc.type] || 0) + 1;
      if (acc.type === 'credit_card' || acc.type === 'line_of_credit') {
        const yaExiste = await Credit.findOne({ fintocAccountId: acc._id });
        if (!yaExiste) {
          const tipoCredito = acc.type === 'credit_card' ? 'tarjeta_credito' : 'linea_credito';
          const hoy = new Date();
          // Deuda real = cupo - disponible (balance.current en créditos suele ser = limit, NO la deuda)
          const cupoTotal = Math.abs(acc.balance?.limit || 0);
          const disponible = Math.abs(acc.balance?.available || 0);
          const deudaReal = cupoTotal > 0 ? Math.max(cupoTotal - disponible, 0) : Math.abs(acc.balance?.current || 0);
          console.log(`Crédito ${acc.type}: limit=${acc.balance?.limit}, available=${acc.balance?.available}, current=${acc.balance?.current} → cupo=${cupoTotal}, deuda=${deudaReal}`);
          const creditoAuto = await Credit.create({
            user: userId,
            nombre: acc.officialName || acc.name || (acc.type === 'credit_card' ? 'Tarjeta de Crédito' : 'Línea de Crédito'),
            institucion: fintocLink.institutionName || '',
            tipoCredito,
            montoOriginal: cupoTotal,
            saldoPendiente: deudaReal,
            tasaInteres: 0,
            cuotaMensual: 0,
            cuotasPagadas: 0,
            cuotasTotales: 0,
            fechaInicio: hoy,
            estado: 'activo',
            moneda: acc.currency || 'CLP',
            fintocAccountId: acc._id,
            requiereCompletar: true,
          });
          creditosAuto.push(creditoAuto);
          console.log(`Crédito auto-creado para ${acc.type}: ${creditoAuto.nombre}`);
        }
      }
    }

    console.log('Tipos de cuenta encontrados:', tiposEncontrados);
    console.log(`Créditos auto-creados: ${creditosAuto.length}`);

    // 6b. Recalcular saldo de líneas de crédito desde transacciones de cuenta corriente
    const lineasCredito = await Credit.find({ user: userId, tipoCredito: 'linea_credito', estado: 'activo' });
    if (lineasCredito.length > 0) {
      const cuentasCorrientes = await Account.find({ user: userId, type: { $in: ['checking_account', 'sight_account'] } }).select('_id');
      if (cuentasCorrientes.length > 0) {
        const accountIds = cuentasCorrientes.map((c) => c._id);
        const movsLinea = await Movement.find({ account: { $in: accountIds }, description: { $regex: /linea\s*(de\s*)?cred/i } });
        let totalUsado = 0, totalPagado = 0;
        movsLinea.forEach((m) => { if (m.amount > 0) totalUsado += m.amount; else totalPagado += Math.abs(m.amount); });
        const saldoCalculado = Math.max(Math.round(totalUsado - totalPagado), 0);
        console.log(`Líneas de crédito: ${movsLinea.length} movimientos, uso=${totalUsado}, pago=${totalPagado}, saldo=${saldoCalculado}`);
        for (const lc of lineasCredito) {
          await Credit.findByIdAndUpdate(lc._id, { saldoPendiente: saldoCalculado });
        }
      }
    }

    // 7. Responder INMEDIATAMENTE al frontend con el resumen
    const savedAccounts = [...savedAccountsMap.values()];
    res.json({
      message: 'Conexión bancaria exitosa',
      link: {
        id: fintocLink._id,
        institution: fintocLink.institutionName,
        holder: fintocLink.holderName,
      },
      creditosImportados: creditosAuto.length,
      tiposEncontrados,
      totalCuentas: savedAccounts.length,
      accounts: savedAccounts.map((entry) => {
        const acc = entry.account;
        return {
          id: acc._id,
          fintocId: acc.fintocId,
          name: acc.name,
          officialName: acc.officialName,
          number: acc.number,
          balance: acc.balance,
          currency: acc.currency,
          type: acc.type,
          movementsCount: entry.movements.length,
        };
      }),
    });
  } catch (error) {
    console.error('Error en exchange y sync:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || 'Error al procesar la conexión bancaria';
    res.status(status).json({ message });
  }
});

// GET /api/fintoc/accounts
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await Account.find({ user: req.user._id }).populate('link').sort({ createdAt: -1 });

    const accountsWithMovements = await Promise.all(
      accounts.map(async (account) => {
        const movements = await Movement.find({ account: account._id })
          .sort({ postDate: -1 })
          .limit(500);

        return {
          id: account._id,
          fintocId: account.fintocId,
          name: account.name,
          officialName: account.officialName,
          number: account.number,
          balance: account.balance,
          currency: account.currency,
          type: account.type,
          institution: account.link?.institutionName || '',
          holder: account.link?.holderName || '',
          linkId: account.link?._id || null,
          lastSyncedAt: account.lastSyncedAt || null,
          movements: movements.map((mov) => ({
            id: mov._id,
            amount: mov.amount,
            description: mov.description,
            postDate: mov.postDate,
            transactionDate: mov.transactionDate,
            currency: mov.currency,
            type: mov.type,
            pending: mov.pending,
            comment: mov.comment,
          })),
        };
      })
    );

    res.json(accountsWithMovements);
  } catch (error) {
    console.error('Error obteniendo cuentas:', error.message);
    res.status(500).json({ message: 'Error al obtener cuentas' });
  }
});

// GET /api/fintoc/accounts/:accountId/movements
router.get('/accounts/:accountId/movements', async (req, res) => {
  try {
    const { accountId } = req.params;
    const account = await Account.findOne({ _id: accountId, user: req.user._id });
    if (!account) {
      return res.status(404).json({ message: 'Cuenta no encontrada' });
    }
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 500));
    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      Movement.find({ account: accountId }).sort({ postDate: -1 }).skip(skip).limit(limit),
      Movement.countDocuments({ account: accountId }),
    ]);

    res.json({
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('Error obteniendo movimientos:', error.message);
    res.status(500).json({ message: 'Error al obtener movimientos' });
  }
});

// GET /api/fintoc/links - Obtener todas las conexiones bancarias
router.get('/links', async (req, res) => {
  try {
    const links = await FintocLink.find({ user: req.user._id }).sort({ createdAt: -1 });

    const linksConDatos = await Promise.all(
      links.map(async (link) => {
        const accounts = await Account.find({ link: link._id });
        const totalBalance = accounts.reduce(
          (sum, acc) => sum + (acc.balance?.available || acc.balance?.current || 0),
          0
        );
        return {
          _id: link._id,
          linkToken: link.linkToken,
          linkId: link.linkId,
          institutionName: link.institutionName,
          holderName: link.holderName,
          holderType: link.holderType,
          status: link.status,
          accountsCount: accounts.length,
          totalBalance,
          createdAt: link.createdAt,
          updatedAt: link.updatedAt,
        };
      })
    );

    res.json(linksConDatos);
  } catch (error) {
    console.error('Error obteniendo links:', error.message);
    res.status(500).json({ message: 'Error al obtener conexiones bancarias' });
  }
});

// DELETE /api/fintoc/links/:linkId - Eliminar conexión bancaria
router.delete('/links/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await FintocLink.findOne({ _id: linkId, user: req.user._id });

    if (!link) {
      return res.status(404).json({ message: 'Conexión no encontrada' });
    }

    // Eliminar movimientos de las cuentas asociadas
    const accounts = await Account.find({ link: link._id });
    const accountIds = accounts.map((a) => a._id);
    for (const account of accounts) {
      await Movement.deleteMany({ account: account._id });
    }

    // Eliminar créditos vinculados a las cuentas del link
    await Credit.deleteMany({ fintocAccountId: { $in: accountIds } });

    // Eliminar cuentas asociadas
    await Account.deleteMany({ link: link._id });

    // Intentar revocar el link en Fintoc API
    try {
      await fintocService.deleteLink(link.linkToken);
    } catch (revokeErr) {
      console.error('Error revocando link en Fintoc (continuando eliminación local):', revokeErr.message);
    }

    // Eliminar el link de la BD
    await FintocLink.findByIdAndDelete(linkId);

    res.json({ message: 'Conexión bancaria eliminada correctamente' });
  } catch (error) {
    console.error('Error eliminando link:', error.message);
    res.status(500).json({ message: 'Error al eliminar la conexión bancaria' });
  }
});

// Mapa para evitar refreshes simultáneos por usuario
const refreshEnProgreso = new Map();

// Resultado del último sync por usuario: { movimientos, completedAt, error }
const lastSyncResult = new Map();

// Lógica de refresh extraída para ejecutarse en background
async function ejecutarRefresh(userId, links) {
  let totalMovimientos = 0;
  let totalNuevos = 0;
  let errorMsg = null;
  try {
    for (const link of links) {
      try {
        const accountsData = await fintocService.getAccounts(link.linkToken);

        // Refresh intent opera a nivel de link — una sola llamada por link.
        // Fire-and-forget: el webhook account.refresh_intent.succeeded traerá los datos frescos.
        try {
          await fintocService.createRefreshIntent(link.linkToken);
          console.log(`[Refresh] Refresh intent creado para link ${link._id}`);
        } catch (riErr) {
          console.warn(`[Refresh] No se pudo crear refresh intent para link ${link._id}: ${riErr.message}`);
        }

        const accountPromises = accountsData.map(async (accData) => {
          const account = await Account.findOneAndUpdate(
            { fintocId: accData.id },
            {
              balance: {
                available: accData.balance?.available || 0,
                current: accData.balance?.current || 0,
                limit: accData.balance?.limit || 0,
              },
            },
            { new: true }
          );

          if (!account) return 0;

          if (accData.type === 'credit_card' || accData.type === 'line_of_credit') {
            const cupoTotal = Math.abs(accData.balance?.limit || 0);
            const disponible = Math.abs(accData.balance?.available || 0);
            const deudaReal = cupoTotal > 0 ? Math.max(cupoTotal - disponible, 0) : Math.abs(accData.balance?.current || 0);
            await Credit.findOneAndUpdate(
              { fintocAccountId: account._id },
              { saldoPendiente: deudaReal, montoOriginal: cupoTotal }
            );
          }

          // 30 días de margen para capturar pendientes confirmados después del último sync
          let sinceDate = '2000-01-01';
          if (account.lastSyncedAt) {
            const margen = new Date(account.lastSyncedAt);
            margen.setDate(margen.getDate() - 30);
            sinceDate = margen.toISOString().split('T')[0];
          }

          const movementsData = await fintocService.getMovements(accData.id, link.linkToken, { since: sinceDate });

          console.log(`[Refresh] Cuenta ${accData.id}: ${movementsData.length} movimientos desde Fintoc (since: ${sinceDate})`);

          if (movementsData.length > 0) {
            const bulkOps = movementsData.map((movData) => {
              const fechaPost = movData.post_date ? new Date(movData.post_date) : null;
              const fechaTx = movData.transaction_date ? new Date(movData.transaction_date) : null;
              return {
                updateOne: {
                  filter: { fintocId: movData.id, user: userId }, // índice compuesto {fintocId, user}
                  update: {
                    $set: {
                      user: userId,
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
            await Account.findByIdAndUpdate(account._id, { lastSyncedAt: new Date() });
            return { count: movementsData.length, nuevos: bulkResult.upsertedCount || 0 };
          }

          await Account.findByIdAndUpdate(account._id, { lastSyncedAt: new Date() });
          return { count: 0, nuevos: 0 };
        });

        const results = await Promise.allSettled(accountPromises);
        results.forEach((r) => {
          if (r.status === 'fulfilled' && r.value) {
            totalMovimientos += r.value.count || 0;
            totalNuevos += r.value.nuevos || 0;
          }
        });

        // Éxito: reset contador de fallos y registrar último sync exitoso
        await FintocLink.findByIdAndUpdate(link._id, calcularActualizacionExito());
      } catch (linkError) {
        console.error(`[Refresh] Error en link ${link._id}:`, linkError.message);
        errorMsg = linkError.message;

        // Clasificar: solo marcar permanentemente si es error de credenciales (401/403)
        const linkActual = await FintocLink.findById(link._id).lean() || link;
        const actualizacion = calcularActualizacionError(linkError, linkActual);
        await FintocLink.findByIdAndUpdate(link._id, actualizacion);

        if (actualizacion.status === 'error') {
          console.error(`[Refresh] Link ${link._id} marcado como 'error' tras ${linkActual.syncFailureCount + 1} fallos`);
        } else {
          console.warn(`[Refresh] Error transitorio en link ${link._id} (fallo #${actualizacion.syncFailureCount}), se reintentará`);
        }
      }
    }

    // Notificar al usuario si hay movimientos genuinamente nuevos
    if (totalNuevos > 0) {
      const cuerpo = totalNuevos === 1
        ? 'Se detectó 1 nueva transacción en tu cuenta bancaria.'
        : `Se detectaron ${totalNuevos} nuevas transacciones en tu cuenta bancaria.`;
      enviarNotificacion(userId, {
        titulo: 'Nueva transacción bancaria',
        cuerpo,
        tipo: 'nueva_transaccion',
      }).catch((err) => console.error('[Refresh] Error enviando notificación:', err.message));
    }

    // Recalcular saldo de líneas de crédito
    try {
      const lineasCredito = await Credit.find({ user: userId, tipoCredito: 'linea_credito', estado: 'activo' });
      if (lineasCredito.length > 0) {
        const cuentasCorrientes = await Account.find({ user: userId, type: { $in: ['checking_account', 'sight_account'] } }).select('_id');
        if (cuentasCorrientes.length > 0) {
          const accountIds = cuentasCorrientes.map((c) => c._id);
          const movsLinea = await Movement.find({ account: { $in: accountIds }, description: { $regex: /linea\s*(de\s*)?cred/i } });
          let totalUsado = 0, totalPagado = 0;
          movsLinea.forEach((m) => { if (m.amount > 0) totalUsado += m.amount; else totalPagado += Math.abs(m.amount); });
          const saldoCalculado = Math.max(Math.round(totalUsado - totalPagado), 0);
          for (const lc of lineasCredito) {
            await Credit.findByIdAndUpdate(lc._id, { saldoPendiente: saldoCalculado });
          }
        }
      }
    } catch (lcErr) {
      console.error('[Refresh] Error recalculando líneas de crédito:', lcErr.message);
    }

    console.log(`[Refresh] Completado para usuario ${userId}: ${totalMovimientos} movimientos`);
  } finally {
    lastSyncResult.set(String(userId), {
      movimientos: totalMovimientos,
      completedAt: new Date(),
      error: errorMsg,
    });
    refreshEnProgreso.delete(String(userId));
  }
}

// POST /api/fintoc/refresh — responde inmediatamente, procesa en background
router.post('/refresh', async (req, res) => {
  try {
    const userId = req.user._id;

    // Si ya hay un refresh corriendo para este usuario, no iniciar otro
    if (refreshEnProgreso.has(String(userId))) {
      return res.json({ message: 'Sincronización ya en progreso', status: 'running' });
    }

    // Incluir links en 'error' para permitir auto-recovery (si Fintoc responde OK → se resetea a 'active')
    const links = await FintocLink.find({ user: userId, status: { $in: ['active', 'error'] } });
    if (links.length === 0) {
      return res.status(404).json({ message: 'No hay conexiones bancarias activas' });
    }

    // Marcar como en progreso y lanzar en background sin await
    refreshEnProgreso.set(String(userId), true);
    ejecutarRefresh(userId, links); // sin await — procesa en background

    // Responder inmediatamente al cliente
    res.json({ message: 'Sincronización iniciada', status: 'running' });
  } catch (error) {
    console.error('Error iniciando refresh:', error.message);
    res.status(500).json({ message: 'Error al iniciar la sincronización' });
  }
});

// Lógica de resync completo ejecutada en background
async function ejecutarResync(userId) {
  try {
    console.log(`[Resync] Iniciando re-sincronización completa para usuario ${userId}`);

    // 1. Resetear lastSyncedAt en todas las cuentas ANTES de borrar movimientos
    //    Así, si el proceso falla a mitad, el próximo refresh pedirá historial completo
    await Account.updateMany({ user: userId }, { lastSyncedAt: null });

    // 2. Borrar todos los movimientos del usuario
    const deleted = await Movement.deleteMany({ user: userId });
    console.log(`[Resync] ${deleted.deletedCount} movimientos eliminados para usuario ${userId}`);

    // 3. Re-fetchear desde Fintoc reutilizando ejecutarRefresh
    //    Como lastSyncedAt=null, usará since:'2000-01-01' (historial completo)
    const links = await FintocLink.find({ user: userId, status: 'active' });
    if (links.length > 0) {
      await ejecutarRefresh(userId, links);
    } else {
      // Sin links activos: registrar como completado con 0 movimientos
      lastSyncResult.set(String(userId), {
        movimientos: 0,
        completedAt: new Date(),
        error: 'No hay conexiones bancarias activas',
      });
      refreshEnProgreso.delete(String(userId));
    }

    console.log(`[Resync] Re-sincronización completa finalizada para usuario ${userId}`);
  } catch (err) {
    console.error(`[Resync] Error en re-sincronización de usuario ${userId}:`, err.message);
    lastSyncResult.set(String(userId), {
      movimientos: 0,
      completedAt: new Date(),
      error: err.message,
    });
    refreshEnProgreso.delete(String(userId));
  }
}

// POST /api/fintoc/resync - Re-sincronizar desde cero (async, igual que /refresh)
// Responde inmediatamente; el proceso corre en background.
// El cliente debe hacer polling a GET /sync-status para detectar cuando termina.
router.post('/resync', async (req, res) => {
  try {
    const userId = req.user._id;

    if (refreshEnProgreso.has(String(userId))) {
      return res.json({ message: 'Sincronización ya en progreso', status: 'running' });
    }

    // Marcar en progreso y lanzar en background sin await
    refreshEnProgreso.set(String(userId), true);
    ejecutarResync(userId); // sin await

    res.json({ message: 'Re-sincronización iniciada', status: 'running' });
  } catch (error) {
    console.error('Error iniciando resync:', error.message);
    res.status(500).json({ message: 'Error al iniciar la re-sincronización' });
  }
});

// GET /api/fintoc/sync-status
router.get('/sync-status', async (req, res) => {
  try {
    const userId = String(req.user._id);
    const [accounts, links] = await Promise.all([
      Account.find({ user: req.user._id }).select('_id name lastSyncedAt').lean(),
      FintocLink.find({ user: req.user._id }).select('institutionName holderName status lastSyncError syncFailureCount lastSuccessSync').lean(),
    ]);

    const lastSync = accounts.reduce((latest, a) => {
      if (!a.lastSyncedAt) return latest;
      return !latest || a.lastSyncedAt > latest ? a.lastSyncedAt : latest;
    }, null);

    const resultado = lastSyncResult.get(userId) || null;

    // Detectar si alguna conexión tiene problemas
    const hayConexionEnError = links.some((l) => l.status === 'error');

    res.json({
      accounts: accounts.map((a) => ({ id: a._id, name: a.name, lastSyncedAt: a.lastSyncedAt })),
      lastSync,
      sincronizando: refreshEnProgreso.has(userId),
      hayConexionEnError,
      conexiones: links.map((l) => ({
        id: l._id,
        banco: l.institutionName,
        titular: l.holderName,
        status: l.status,
        ultimoError: l.lastSyncError,
        fallosConsecutivos: l.syncFailureCount || 0,
        ultimoExito: l.lastSuccessSync,
      })),
      ultimoResultado: resultado
        ? {
            movimientos: resultado.movimientos,
            completedAt: resultado.completedAt,
            error: resultado.error,
          }
        : null,
    });
  } catch (error) {
    console.error('Error obteniendo sync status:', error.message);
    res.status(500).json({ message: 'Error al obtener estado de sincronización' });
  }
});

// GET /api/fintoc/diagnostico — Verifica el estado real de cada conexión contra la API de Fintoc
router.get('/diagnostico', async (req, res) => {
  try {
    const links = await FintocLink.find({ user: req.user._id }).lean();
    if (!links.length) {
      return res.json({ diagnostico: [], mensaje: 'No hay conexiones bancarias registradas' });
    }

    const resultados = await Promise.all(links.map(async (link) => {
      try {
        const cuentas = await fintocService.getAccounts(link.linkToken);
        const cuentasEnBD = await Account.find({ link: link._id }).select('name fintocId lastSyncedAt').lean();
        return {
          linkId: link._id,
          banco: link.institutionName,
          titular: link.holderName,
          statusEnBD: link.status,
          tokenValido: true,
          cuentasEnFintoc: cuentas.length,
          cuentasEnBD: cuentasEnBD.map((c) => ({
            nombre: c.name,
            fintocId: c.fintocId,
            ultimaSync: c.lastSyncedAt,
          })),
          syncFailureCount: link.syncFailureCount,
          lastSuccessSync: link.lastSuccessSync,
          lastSyncError: link.lastSyncError,
        };
      } catch (err) {
        return {
          linkId: link._id,
          banco: link.institutionName,
          titular: link.holderName,
          statusEnBD: link.status,
          tokenValido: false,
          errorFintoc: err.response?.data?.error?.message || err.message,
          codigoError: err.response?.status || null,
          syncFailureCount: link.syncFailureCount,
          lastSyncError: link.lastSyncError,
          accion: 'Desconecta y reconecta el banco en la app para obtener un token nuevo',
        };
      }
    }));

    res.json({ diagnostico: resultados });
  } catch (error) {
    console.error('[Diagnostico] Error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/fintoc/sync-now
// Dispara un sync inmediato de todos los links del usuario autenticado.
// Llama createRefreshIntent (para que Fintoc actualice desde el banco) y luego
// sincroniza los movimientos disponibles en ese momento con lookback de 7 días.
// El webhook account.refresh_intent.succeeded hará un segundo sync cuando Fintoc termine.
router.post('/sync-now', async (req, res) => {
  try {
    const links = await FintocLink.find({ user: req.user.id, status: { $in: ['active', 'error'] } }).lean();
    if (!links.length) {
      return res.json({ queued: false, message: 'No hay cuentas bancarias conectadas' });
    }

    const sinceOverride = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Responder inmediatamente — el sync corre en background
    res.json({ queued: true, links: links.length });

    for (const link of links) {
      // Fire-and-forget: pedir a Fintoc que refresque desde el banco
      fintocService.createRefreshIntent(link.linkToken).catch((err) =>
        console.warn(`[SyncNow] No se pudo crear refresh intent para link ${link._id}: ${err.message}`)
      );
      // Sync inmediato con lo que ya tiene Fintoc (últimos 7 días)
      syncSingleLink(link, { sinceOverride }).catch((err) =>
        console.error(`[SyncNow] Error en syncSingleLink para link ${link._id}: ${err.message}`)
      );
    }
  } catch (error) {
    console.error('[SyncNow] Error:', error.message);
    // Si res ya fue enviada, no volver a responder
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
});

// Exportar ejecutarRefresh para uso externo (webhook de Fintoc)
// Recibe userId y array de links (documentos de FintocLink)
router.ejecutarRefreshExterno = async (userId, links) => {
  const userIdStr = String(userId);
  if (refreshEnProgreso.has(userIdStr)) return; // ya hay un sync en curso
  refreshEnProgreso.set(userIdStr, true);
  await ejecutarRefresh(userId, links);
};

module.exports = router;
