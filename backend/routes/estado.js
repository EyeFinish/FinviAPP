const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Movement = require('../models/Movement');
const Account = require('../models/Account');

router.use(auth);

// Normaliza una descripción de movimiento para agrupar similares
function normalizarDescripcion(desc) {
  if (!desc) return 'sin descripción';
  let n = desc.toLowerCase().trim();
  // Quitar números de referencia, IDs, fechas
  n = n.replace(/\b\d{6,}\b/g, '');
  n = n.replace(/[#*_\-]+/g, ' ');
  n = n.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, '');
  // Quitar sufijos tipo "*TRIP-123", "TXN123"
  n = n.replace(/\*\S+/g, '');
  n = n.replace(/txn\s*\S+/gi, '');
  // Normalizar espacios
  n = n.replace(/\s+/g, ' ').trim();
  // Si queda vacío
  if (!n || n.length < 2) return 'otros';
  // Capitalizar primera letra
  return n.charAt(0).toUpperCase() + n.slice(1);
}

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

    // Obtener cuentas del usuario para mapear nombres y filtrar
    const cuentas = await Account.find({ user: userId }).select('_id name officialName').lean();
    const cuentasMap = new Map();
    const accountIds = [];
    cuentas.forEach((c) => {
      cuentasMap.set(c._id.toString(), c.officialName || c.name || 'Cuenta');
      accountIds.push(c._id);
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
      });
    }

    // Calcular resumen
    let totalIngresos = 0;
    let totalGastos = 0;
    movimientos.forEach((m) => {
      if (m.amount >= 0) totalIngresos += m.amount;
      else totalGastos += Math.abs(m.amount);
    });
    const montoNeto = totalIngresos - totalGastos;
    const tasaAhorro = totalIngresos > 0 ? Math.round((montoNeto / totalIngresos) * 100) : 0;

    // --- Agrupación por categoría (descripción normalizada) ---
    const categMap = new Map();
    movimientos.forEach((m) => {
      const nombre = normalizarDescripcion(m.description);
      const tipo = m.amount >= 0 ? 'ingreso' : 'gasto';
      const key = `${tipo}:${nombre}`;
      if (!categMap.has(key)) {
        categMap.set(key, { nombre, tipo, monto: 0, cantidad: 0, movimientos: [] });
      }
      const cat = categMap.get(key);
      cat.monto += Math.abs(m.amount);
      cat.cantidad += 1;
      cat.movimientos.push({
        descripcion: m.description || 'Sin descripción',
        monto: m.amount,
        fecha: m.postDate,
        cuenta: cuentasMap.get(m.account?.toString()) || 'Cuenta',
      });
    });

    const categorias = [...categMap.values()]
      .map((c) => ({
        ...c,
        monto: Math.round(c.monto),
        porcentaje: c.tipo === 'ingreso'
          ? (totalIngresos > 0 ? Math.round((c.monto / totalIngresos) * 100) : 0)
          : (totalGastos > 0 ? Math.round((c.monto / totalGastos) * 100) : 0),
        movimientos: c.movimientos.sort((a, b) => Math.abs(b.monto) - Math.abs(a.monto)),
      }))
      .sort((a, b) => b.monto - a.monto);

    // --- Agrupación por tipo de movimiento ---
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

    // --- Top 5 gastos e ingresos individuales ---
    const gastos = movimientos.filter((m) => m.amount < 0).sort((a, b) => a.amount - b.amount);
    const ingresos = movimientos.filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount);

    const formatMov = (m) => ({
      descripcion: m.description || 'Sin descripción',
      monto: m.amount,
      fecha: m.postDate,
      cuenta: cuentasMap.get(m.account?.toString()) || 'Cuenta',
    });

    const topGastos = gastos.slice(0, 5).map(formatMov);
    const topIngresos = ingresos.slice(0, 5).map(formatMov);

    res.json({
      mes: mesKey,
      mesLabel,
      resumen: {
        totalIngresos: Math.round(totalIngresos),
        totalGastos: Math.round(totalGastos),
        montoNeto: Math.round(montoNeto),
        cantidadMovimientos: movimientos.length,
        tasaAhorro,
      },
      categorias,
      porTipo,
      topGastos,
      topIngresos,
    });
  } catch (error) {
    console.error('Error obteniendo estado financiero:', error.message);
    res.status(500).json({ message: 'Error al obtener estado financiero' });
  }
});

module.exports = router;
