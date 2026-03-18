const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const fintocService = require('../services/fintocService');
const FintocLink = require('../models/FintocLink');
const Account = require('../models/Account');
const Movement = require('../models/Movement');
const Credit = require('../models/Credit');

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
              filter: { fintocId: movData.id },
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
          .limit(20);

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
    const movements = await Movement.find({ account: accountId })
      .sort({ postDate: -1 })
      .limit(50);
    res.json(movements);
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

// POST /api/fintoc/refresh
router.post('/refresh', async (req, res) => {
  try {
    const links = await FintocLink.find({ user: req.user._id, status: 'active' });

    if (links.length === 0) {
      return res.status(404).json({ message: 'No hay conexiones bancarias activas' });
    }

    const results = [];

    for (const link of links) {
      try {
        const accountsData = await fintocService.getAccounts(link.linkToken);

        // Procesar cuentas en paralelo por link
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

          if (!account) return null;

          // Sincronizar saldo de créditos vinculados (tarjetas/líneas)
          if (accData.type === 'credit_card' || accData.type === 'line_of_credit') {
            const cupoTotal = Math.abs(accData.balance?.limit || 0);
            const disponible = Math.abs(accData.balance?.available || 0);
            const deudaReal = cupoTotal > 0 ? Math.max(cupoTotal - disponible, 0) : Math.abs(accData.balance?.current || 0);
            await Credit.findOneAndUpdate(
              { fintocAccountId: account._id },
              {
                saldoPendiente: deudaReal,
                montoOriginal: cupoTotal,
              }
            );
          }

          const movementsData = await fintocService.getMovements(accData.id, link.linkToken, { since: '2000-01-01' });

          // Guardar movimientos en bulk
          if (movementsData.length > 0) {
            const bulkOps = movementsData.map((movData) => {
              const fechaPost = movData.post_date ? new Date(movData.post_date) : null;
              const fechaTx = movData.transaction_date ? new Date(movData.transaction_date) : null;
              return {
                updateOne: {
                  filter: { fintocId: movData.id },
                  update: {
                    $set: {
                      user: req.user._id,
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
          }

          return {
            accountId: account.fintocId,
            name: account.name,
            movementsUpdated: movementsData.length,
          };
        });

        const accountResults = await Promise.allSettled(accountPromises);
        for (const r of accountResults) {
          if (r.status === 'fulfilled' && r.value) results.push(r.value);
        }
      } catch (linkError) {
        console.error(`Error refrescando link ${link._id}:`, linkError.message);
        await FintocLink.findByIdAndUpdate(link._id, { status: 'error' });
        results.push({ linkId: link._id, error: linkError.message });
      }
    }

    // Recalcular saldo de líneas de crédito desde transacciones de cuenta corriente
    try {
      const lineasCredito = await Credit.find({ user: req.user._id, tipoCredito: 'linea_credito', estado: 'activo' });
      if (lineasCredito.length > 0) {
        const cuentasCorrientes = await Account.find({ user: req.user._id, type: { $in: ['checking_account', 'sight_account'] } }).select('_id');
        if (cuentasCorrientes.length > 0) {
          const accountIds = cuentasCorrientes.map((c) => c._id);
          const movsLinea = await Movement.find({ account: { $in: accountIds }, description: { $regex: /linea\s*(de\s*)?cred/i } });
          let totalUsado = 0, totalPagado = 0;
          movsLinea.forEach((m) => { if (m.amount > 0) totalUsado += m.amount; else totalPagado += Math.abs(m.amount); });
          const saldoCalculado = Math.max(Math.round(totalUsado - totalPagado), 0);
          for (const lc of lineasCredito) {
            await Credit.findByIdAndUpdate(lc._id, { saldoPendiente: saldoCalculado });
          }
          console.log(`Refresh: Líneas de crédito actualizadas, saldo=${saldoCalculado}`);
        }
      }
    } catch (lcErr) {
      console.error('Error recalculando líneas de crédito:', lcErr.message);
    }

    res.json({ message: 'Datos actualizados', results });
  } catch (error) {
    console.error('Error refrescando datos:', error.message);
    res.status(500).json({ message: 'Error al refrescar datos' });
  }
});

// POST /api/fintoc/resync - Eliminar TODOS los movimientos y re-sincronizar desde Fintoc
router.post('/resync', async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Eliminar todos los movimientos del usuario
    const deleted = await Movement.deleteMany({ user: userId });
    console.log(`Resync: ${deleted.deletedCount} movimientos eliminados para usuario ${userId}`);

    // 2. Obtener links activos
    const links = await FintocLink.find({ user: userId, status: 'active' });
    if (links.length === 0) {
      return res.json({ message: 'Movimientos eliminados. No hay conexiones activas para re-sincronizar.', eliminados: deleted.deletedCount, sincronizados: 0 });
    }

    let totalSynced = 0;

    for (const link of links) {
      try {
        const accountsData = await fintocService.getAccounts(link.linkToken);

        const accountPromises = accountsData.map(async (accData) => {
          const account = await Account.findOne({ fintocId: accData.id, user: userId });
          if (!account) return 0;

          // Actualizar balance
          account.balance = {
            available: accData.balance?.available || 0,
            current: accData.balance?.current || 0,
            limit: accData.balance?.limit || 0,
          };
          await account.save();

          const movementsData = await fintocService.getMovements(accData.id, link.linkToken, { since: '2000-01-01' });

          if (movementsData.length > 0) {
            const bulkOps = movementsData.map((movData) => {
              const fechaPost = movData.post_date ? new Date(movData.post_date) : null;
              const fechaTx = movData.transaction_date ? new Date(movData.transaction_date) : null;
              return {
                updateOne: {
                  filter: { fintocId: movData.id },
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
            await Movement.bulkWrite(bulkOps, { ordered: false });
          }

          return movementsData.length;
        });

        const results = await Promise.allSettled(accountPromises);
        for (const r of results) {
          if (r.status === 'fulfilled') totalSynced += r.value;
        }
      } catch (linkError) {
        console.error(`Resync: Error con link ${link._id}:`, linkError.message);
      }
    }

    console.log(`Resync completado: ${totalSynced} movimientos sincronizados`);
    res.json({ message: 'Re-sincronización completada', eliminados: deleted.deletedCount, sincronizados: totalSynced });
  } catch (error) {
    console.error('Error en resync:', error.message);
    res.status(500).json({ message: 'Error al re-sincronizar datos' });
  }
});

module.exports = router;
