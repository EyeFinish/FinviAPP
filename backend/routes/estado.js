const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Movement = require('../models/Movement');
const Account = require('../models/Account');
const CategoryMapping = require('../models/CategoryMapping');
const { clasificarMovimiento, obtenerCategorias } = require('../services/categorizador');

router.use(auth);

// Traduce tipos de movimiento de Fintoc
function traducirTipoMovimiento(type) {
  const tipos = {
    transfer: 'Transferencia',
    purchase: 'Compra',
    payment: 'Pago',
    withdrawal: 'Retiro',
    deposit: 'Depósito',
    fee: 'Comisión',
    interest: 'Interés',
    refund: 'Devolución',
    other: 'Otro',
  };
  return tipos[type] || type || 'Otro';
}

// Detecta si un movimiento es transferencia entre cuentas propias del usuario
function esTransferenciaInterna(mov, numeroCuentas) {
  if (mov.type !== 'transfer') return false;
  const sender = mov.senderAccount;
  const recipient = mov.recipientAccount;
  // Verificar si la cuenta destino u origen es una cuenta propia
  const senderNum = typeof sender === 'object' && sender ? (sender.number || sender.id || '') : String(sender || '');
  const recipientNum = typeof recipient === 'object' && recipient ? (recipient.number || recipient.id || '') : String(recipient || '');
  for (const num of numeroCuentas) {
    if (!num) continue;
    if (senderNum.includes(num) || recipientNum.includes(num)) return true;
  }
  return false;
}

// GET /api/estado?mes=2026-03
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;
    const ahora = new Date();

    // Determinar mes a consultar
    let anio, mes;
    if (req.query.mes && /^\d{4}-\d{2}$/.test(req.query.mes)) {
      [anio, mes] = req.query.mes.split('-').map(Number);
    } else {
      anio = ahora.getFullYear();
      mes = ahora.getMonth() + 1;
    }

    const inicioMes = new Date(anio, mes - 1, 1);
    const finMes = new Date(anio, mes, 1);
    const mesKey = `${anio}-${String(mes).padStart(2, '0')}`;
    const mesLabel = inicioMes.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

    // Obtener cuentas del usuario (incluir number para detección de transferencias internas)
    const cuentas = await Account.find({ user: userId }).select('_id name officialName number').lean();
    // Cargar mappings personalizados del usuario
    const mappingsArr = await CategoryMapping.find({ user: userId }).lean();
    const customMap = new Map();
    mappingsArr.forEach(m => customMap.set(m.descKey, m.categoria));
    const cuentasMap = new Map();
    const accountIds = [];
    const numeroCuentas = [];
    cuentas.forEach((c) => {
      cuentasMap.set(c._id.toString(), c.officialName || c.name || 'Cuenta');
      accountIds.push(c._id);
      if (c.number) numeroCuentas.push(c.number);
    });

    // Obtener movimientos del mes — solo de cuentas reales del usuario
    const movimientos = await Movement.find({
      user: userId,
      account: { $in: accountIds },
      postDate: { $gte: inicioMes, $lt: finMes },
    }).sort({ postDate: -1 }).lean();

    if (movimientos.length === 0) {
      return res.json({
        mes: mesKey,
        mesLabel,
        resumen: { totalIngresos: 0, totalGastos: 0, montoNeto: 0, cantidadMovimientos: 0, tasaAhorro: 0 },
        categorias: [],
        porTipo: [],
        topGastos: [],
        topIngresos: [],
        transferenciasInternas: { cantidad: 0, monto: 0 },
        suscripciones: [],
      });
    }

    // Separar transferencias internas
    const movsReales = [];
    const movsInternos = [];
    movimientos.forEach((m) => {
      if (esTransferenciaInterna(m, numeroCuentas)) {
        movsInternos.push(m);
      } else {
        movsReales.push(m);
      }
    });

    const montoInternoPositivo = movsInternos.filter(m => m.amount >= 0).reduce((s, m) => s + m.amount, 0);

    // Calcular resumen (excluyendo transferencias internas)
    let totalIngresos = 0;
    let totalGastos = 0;
    movsReales.forEach((m) => {
      if (m.amount >= 0) totalIngresos += m.amount;
      else totalGastos += Math.abs(m.amount);
    });
    const montoNeto = totalIngresos - totalGastos;
    const tasaAhorro = totalIngresos > 0 ? Math.round((montoNeto / totalIngresos) * 100) : 0;

    // --- Agrupación por categoría inteligente ---
    const categMap = new Map();
    movsReales.forEach((m) => {
      const { categoria, icono, color } = clasificarMovimiento(m.description, customMap);
      const tipo = m.amount >= 0 ? 'ingreso' : 'gasto';
      const key = `${tipo}:${categoria}`;
      if (!categMap.has(key)) {
        categMap.set(key, { nombre: categoria, icono, color, tipo, monto: 0, cantidad: 0, subgrupos: new Map() });
      }
      const cat = categMap.get(key);
      cat.monto += Math.abs(m.amount);
      cat.cantidad += 1;
      // Agrupar por descripción (mismo comercio)
      const desc = (m.description || 'Sin descripción').trim();
      const descKey = desc.toLowerCase();
      if (!cat.subgrupos.has(descKey)) {
        cat.subgrupos.set(descKey, { descripcion: desc, monto: 0, cantidad: 0 });
      }
      const sub = cat.subgrupos.get(descKey);
      sub.monto += Math.abs(m.amount);
      sub.cantidad += 1;
    });

    const categorias = [...categMap.values()]
      .map((c) => ({
        nombre: c.nombre,
        icono: c.icono,
        color: c.color,
        tipo: c.tipo,
        monto: Math.round(c.monto),
        cantidad: c.cantidad,
        porcentaje: c.tipo === 'ingreso'
          ? (totalIngresos > 0 ? Math.round((c.monto / totalIngresos) * 100) : 0)
          : (totalGastos > 0 ? Math.round((c.monto / totalGastos) * 100) : 0),
        movimientos: [...c.subgrupos.values()]
          .map((s) => ({ descripcion: s.descripcion, monto: Math.round(s.monto), cantidad: s.cantidad }))
          .sort((a, b) => b.monto - a.monto),
      }))
      .sort((a, b) => b.monto - a.monto);

    // --- Agrupación por tipo de movimiento (todos los movimientos) ---
    const tipoMap = new Map();
    movimientos.forEach((m) => {
      const tipo = m.type || 'other';
      if (!tipoMap.has(tipo)) {
        tipoMap.set(tipo, { tipo, tipoLabel: traducirTipoMovimiento(tipo), monto: 0, montoIngresos: 0, montoGastos: 0, cantidad: 0 });
      }
      const t = tipoMap.get(tipo);
      t.cantidad += 1;
      if (m.amount >= 0) {
        t.montoIngresos += m.amount;
      } else {
        t.montoGastos += Math.abs(m.amount);
      }
      t.monto += m.amount;
    });

    const porTipo = [...tipoMap.values()]
      .map((t) => ({
        ...t,
        monto: Math.round(t.monto),
        montoIngresos: Math.round(t.montoIngresos),
        montoGastos: Math.round(t.montoGastos),
      }))
      .sort((a, b) => b.cantidad - a.cantidad);

    // --- Top 5 gastos e ingresos (excluyendo transferencias internas) ---
    const gastos = movsReales.filter((m) => m.amount < 0).sort((a, b) => a.amount - b.amount);
    const ingresos = movsReales.filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount);

    const formatMov = (m) => ({
      descripcion: m.description || 'Sin descripción',
      monto: m.amount,
      fecha: m.postDate,
      cuenta: cuentasMap.get(m.account?.toString()) || 'Cuenta',
    });

    const topGastos = gastos.slice(0, 5).map(formatMov);
    const topIngresos = ingresos.slice(0, 5).map(formatMov);

    // --- Suscripciones: detectadas por nombre (categoría "Suscripciones") ---
    const suscripciones = [];
    const subVisto = new Set();
    movsReales.forEach((m) => {
      const { categoria, icono, color } = clasificarMovimiento(m.description, customMap);
      if (categoria !== 'Suscripciones') return;
      const desc = (m.description || '').toLowerCase().trim();
      if (subVisto.has(desc)) return;
      subVisto.add(desc);
      suscripciones.push({
        descripcion: m.description || 'Sin descripción',
        monto: Math.round(Math.abs(m.amount)),
        icono,
        color,
      });
    });
    suscripciones.sort((a, b) => b.monto - a.monto);

    res.json({
      mes: mesKey,
      mesLabel,
      resumen: {
        totalIngresos: Math.round(totalIngresos),
        totalGastos: Math.round(totalGastos),
        montoNeto: Math.round(montoNeto),
        cantidadMovimientos: movsReales.length,
        tasaAhorro,
      },
      categorias,
      porTipo,
      topGastos,
      topIngresos,
      transferenciasInternas: {
        cantidad: movsInternos.length,
        monto: Math.round(montoInternoPositivo),
      },
      suscripciones,
    });
  } catch (error) {
    console.error('Error obteniendo estado financiero:', error.message);
    res.status(500).json({ message: 'Error al obtener estado financiero' });
  }
});

// GET /api/estado/categorias — lista de categorías disponibles
router.get('/categorias', async (req, res) => {
  res.json(obtenerCategorias());
});

// POST /api/estado/categorizar — guardar mapping personalizado
router.post('/categorizar', async (req, res) => {
  try {
    const userId = req.user._id;
    const { descripcion, categoria } = req.body;
    if (!descripcion || !categoria) {
      return res.status(400).json({ message: 'Descripción y categoría son requeridos' });
    }
    const descKey = descripcion.toLowerCase().trim();
    await CategoryMapping.findOneAndUpdate(
      { user: userId, descKey },
      { user: userId, descKey, categoria },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Error guardando categorización:', error.message);
    res.status(500).json({ message: 'Error al guardar categorización' });
  }
});

module.exports = router;
