const express = require('express');
const router = express.Router();
const fintocService = require('../services/fintocService');
const FintocLink = require('../models/FintocLink');
const Account = require('../models/Account');
const Movement = require('../models/Movement');
const Credit = require('../models/Credit');

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

    // 1. Intercambiar exchange_token por el Link completo
    console.log('Intercambiando exchange_token...');
    const linkData = await fintocService.exchangeToken(exchangeToken);

    // 2. Guardar el Link en MongoDB
    const fintocLink = await FintocLink.findOneAndUpdate(
      { linkToken: linkData.link_token },
      {
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
    const savedAccounts = [];

    for (const accData of accountsData) {
      const account = await Account.findOneAndUpdate(
        { fintocId: accData.id },
        {
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

      // 4. Obtener movimientos de cada cuenta
      console.log(`Obteniendo movimientos para cuenta ${accData.id}...`);
      try {
        const movementsData = await fintocService.getMovements(accData.id, linkData.link_token);
        const savedMovements = [];

        for (const movData of movementsData) {
          const movement = await Movement.findOneAndUpdate(
            { fintocId: movData.id },
            {
              fintocId: movData.id,
              amount: movData.amount || 0,
              description: movData.description || '',
              postDate: movData.post_date ? new Date(movData.post_date) : null,
              transactionDate: movData.transaction_date ? new Date(movData.transaction_date) : null,
              currency: movData.currency || 'CLP',
              type: movData.type || '',
              pending: movData.pending || false,
              senderAccount: movData.sender_account || null,
              recipientAccount: movData.recipient_account || null,
              comment: movData.comment || '',
              account: account._id,
            },
            { upsert: true, new: true }
          );
          savedMovements.push(movement);
        }

        savedAccounts.push({ ...account.toObject(), movements: savedMovements });
      } catch (movError) {
        console.error(`Error obteniendo movimientos de cuenta ${accData.id}:`, movError.message);
        savedAccounts.push({ ...account.toObject(), movements: [] });
      }
    }

    // 5. Auto-crear créditos para tarjetas de crédito y líneas de crédito
    const creditosAuto = [];
    const tiposEncontrados = {};
    for (const acc of savedAccounts) {
      tiposEncontrados[acc.type] = (tiposEncontrados[acc.type] || 0) + 1;
      if (acc.type === 'credit_card' || acc.type === 'line_of_credit') {
        const yaExiste = await Credit.findOne({ fintocAccountId: acc._id });
        if (!yaExiste) {
          const tipoCredito = acc.type === 'credit_card' ? 'tarjeta_credito' : 'linea_credito';
          const hoy = new Date();
          const creditoAuto = await Credit.create({
            nombre: acc.officialName || acc.name || (acc.type === 'credit_card' ? 'Tarjeta de Crédito' : 'Línea de Crédito'),
            institucion: fintocLink.institutionName || '',
            tipoCredito,
            montoOriginal: Math.abs(acc.balance?.limit || 0),
            saldoPendiente: Math.abs(acc.balance?.current || 0),
            tasaInteres: 0,
            cuotaMensual: 0,
            cuotasPagadas: 0,
            cuotasTotales: 1,
            fechaInicio: hoy,
            fechaVencimiento: new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate()),
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

    // 6. Retornar resumen al frontend
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
      accounts: savedAccounts.map((acc) => ({
        id: acc._id,
        fintocId: acc.fintocId,
        name: acc.name,
        officialName: acc.officialName,
        number: acc.number,
        balance: acc.balance,
        currency: acc.currency,
        type: acc.type,
        movementsCount: acc.movements.length,
        movements: acc.movements.slice(0, 20).map((mov) => ({
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
      })),
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
    const accounts = await Account.find().populate('link').sort({ createdAt: -1 });

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
    const links = await FintocLink.find().sort({ createdAt: -1 });

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
    const link = await FintocLink.findById(linkId);

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
    const links = await FintocLink.find({ status: 'active' });

    if (links.length === 0) {
      return res.status(404).json({ message: 'No hay conexiones bancarias activas' });
    }

    const results = [];

    for (const link of links) {
      try {
        const accountsData = await fintocService.getAccounts(link.linkToken);

        for (const accData of accountsData) {
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

          if (account) {
            // Sincronizar saldo de créditos vinculados (tarjetas/líneas)
            if (accData.type === 'credit_card' || accData.type === 'line_of_credit') {
              await Credit.findOneAndUpdate(
                { fintocAccountId: account._id },
                {
                  saldoPendiente: Math.abs(accData.balance?.current || 0),
                  montoOriginal: Math.abs(accData.balance?.limit || 0),
                }
              );
            }

            const movementsData = await fintocService.getMovements(accData.id, link.linkToken);

            for (const movData of movementsData) {
              await Movement.findOneAndUpdate(
                { fintocId: movData.id },
                {
                  fintocId: movData.id,
                  amount: movData.amount || 0,
                  description: movData.description || '',
                  postDate: movData.post_date ? new Date(movData.post_date) : null,
                  transactionDate: movData.transaction_date ? new Date(movData.transaction_date) : null,
                  currency: movData.currency || 'CLP',
                  type: movData.type || '',
                  pending: movData.pending || false,
                  senderAccount: movData.sender_account || null,
                  recipientAccount: movData.recipient_account || null,
                  comment: movData.comment || '',
                  account: account._id,
                },
                { upsert: true, new: true }
              );
            }

            results.push({
              accountId: account.fintocId,
              name: account.name,
              movementsUpdated: movementsData.length,
            });
          }
        }
      } catch (linkError) {
        console.error(`Error refrescando link ${link._id}:`, linkError.message);
        // Marcar link como error si falla al refrescar
        await FintocLink.findByIdAndUpdate(link._id, { status: 'error' });
        results.push({ linkId: link._id, error: linkError.message });
      }
    }

    res.json({ message: 'Datos actualizados', results });
  } catch (error) {
    console.error('Error refrescando datos:', error.message);
    res.status(500).json({ message: 'Error al refrescar datos' });
  }
});

module.exports = router;
