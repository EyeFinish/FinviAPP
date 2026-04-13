const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Movement = require('../models/Movement');
const FixedCost = require('../models/FixedCost');
const Debt = require('../models/Debt');
const Income = require('../models/Income');
const CategoryMapping = require('../models/CategoryMapping');
const { clasificarMovimiento } = require('../services/categorizador');
const { obtenerCruceCategoria } = require('../services/categoryMap');

router.use(auth);

// ===================== MOVIMIENTOS SIN ASIGNAR =====================

router.get('/sin-asignar', async (req, res) => {
  try {
    const filtro = {
      user: req.user._id,
      amount: { $lt: 0 }, // solo gastos
      'asignacion.tipo': null,
    };

    // Filtrar por mes opcional (formato YYYY-MM)
    if (req.query.mes) {
      const [anio, mes] = req.query.mes.split('-').map(Number);
      const inicio = new Date(anio, mes - 1, 1);
      const fin = new Date(anio, mes, 1);
      filtro.postDate = { $gte: inicio, $lt: fin };
    }

    const movimientos = await Movement.find(filtro)
      .sort({ postDate: -1 })
      .limit(100)
      .select('amount description postDate type currency account');

    res.json(movimientos);
  } catch (error) {
    console.error('Error obteniendo movimientos sin asignar:', error.message);
    res.status(500).json({ message: 'Error al obtener movimientos sin asignar' });
  }
});

// ===================== MOVIMIENTOS ASIGNADOS =====================

router.get('/asignados', async (req, res) => {
  try {
    const filtro = {
      user: req.user._id,
      'asignacion.tipo': { $ne: null },
    };

    if (req.query.mes) {
      filtro['asignacion.mes'] = req.query.mes;
    }

    if (req.query.tipo && req.query.referenciaId) {
      filtro['asignacion.tipo'] = req.query.tipo;
      filtro['asignacion.referenciaId'] = new mongoose.Types.ObjectId(req.query.referenciaId);
    }

    const movimientos = await Movement.find(filtro)
      .sort({ postDate: -1 })
      .select('amount description postDate type currency account asignacion');

    res.json(movimientos);
  } catch (error) {
    console.error('Error obteniendo movimientos asignados:', error.message);
    res.status(500).json({ message: 'Error al obtener movimientos asignados' });
  }
});

// ===================== ASIGNAR MOVIMIENTO =====================

router.put('/:id/asignar', async (req, res) => {
  try {
    const { tipo, referenciaId } = req.body;

    if (!tipo || !referenciaId) {
      return res.status(400).json({ message: 'Se requiere tipo y referenciaId' });
    }

    if (!['costoFijo', 'deuda'].includes(tipo)) {
      return res.status(400).json({ message: 'Tipo inválido. Debe ser costoFijo o deuda' });
    }

    if (!mongoose.Types.ObjectId.isValid(referenciaId)) {
      return res.status(400).json({ message: 'referenciaId con formato inválido' });
    }

    // Verificar que el movimiento existe y pertenece al usuario
    const movimiento = await Movement.findOne({ _id: req.params.id, user: req.user._id });
    if (!movimiento) {
      return res.status(404).json({ message: 'Movimiento no encontrado' });
    }

    // Verificar que no esté ya asignado
    if (movimiento.asignacion?.tipo) {
      return res.status(400).json({ message: 'Este movimiento ya está asignado a una obligación' });
    }

    // Verificar que la obligación existe y pertenece al usuario
    let obligacion;
    if (tipo === 'costoFijo') {
      obligacion = await FixedCost.findOne({ _id: referenciaId, user: req.user._id });
    } else {
      obligacion = await Debt.findOne({ _id: referenciaId, user: req.user._id });
    }

    if (!obligacion) {
      return res.status(404).json({ message: 'Obligación no encontrada' });
    }

    // Calcular mes desde postDate del movimiento
    const fecha = movimiento.postDate || movimiento.transactionDate || new Date();
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

    movimiento.asignacion = { tipo, referenciaId, mes };
    await movimiento.save();

    res.json(movimiento);
  } catch (error) {
    console.error('Error asignando movimiento:', error.message);
    res.status(500).json({ message: 'Error al asignar movimiento' });
  }
});

// ===================== DESASIGNAR MOVIMIENTO =====================

router.put('/:id/desasignar', async (req, res) => {
  try {
    const movimiento = await Movement.findOne({ _id: req.params.id, user: req.user._id });
    if (!movimiento) {
      return res.status(404).json({ message: 'Movimiento no encontrado' });
    }

    movimiento.asignacion = { tipo: null, referenciaId: null, mes: null };
    await movimiento.save();

    res.json(movimiento);
  } catch (error) {
    console.error('Error desasignando movimiento:', error.message);
    res.status(500).json({ message: 'Error al desasignar movimiento' });
  }
});

// ===================== SIN ASIGNAR AGRUPADOS POR CATEGORÍA =====================

router.get('/sin-asignar-agrupados', async (req, res) => {
  try {
    const userId = req.user._id;

    // Filtro base: gastos sin asignar
    const filtro = {
      user: userId,
      amount: { $lt: 0 },
      'asignacion.tipo': null,
    };

    if (req.query.mes && /^\d{4}-\d{2}$/.test(req.query.mes)) {
      const [anio, mes] = req.query.mes.split('-').map(Number);
      const inicio = new Date(anio, mes - 1, 1);
      const fin = new Date(anio, mes, 1);
      filtro.postDate = { $gte: inicio, $lt: fin };
    }

    // Cargar movimientos, mappings personalizados y obligaciones en paralelo
    const [movimientos, mappingsArr, costosFijos, deudas] = await Promise.all([
      Movement.find(filtro).sort({ postDate: -1 }).limit(200)
        .select('amount description postDate type currency account').lean(),
      CategoryMapping.find({ user: userId }).lean(),
      FixedCost.find({ user: userId }).lean(),
      Debt.find({ user: userId }).lean(),
    ]);

    // Construir mapa de mappings personalizados
    const customMap = new Map();
    mappingsArr.forEach(m => customMap.set(m.descKey, m.categoria));

    // Agrupar movimientos por categoría
    const categMap = new Map();
    movimientos.forEach((mov) => {
      const { categoria, icono, color } = clasificarMovimiento(mov.description, customMap);
      if (!categMap.has(categoria)) {
        categMap.set(categoria, { nombre: categoria, icono, color, total: 0, cantidad: 0, movimientos: [] });
      }
      const cat = categMap.get(categoria);
      cat.total += Math.abs(mov.amount);
      cat.cantidad += 1;
      cat.movimientos.push({
        _id: mov._id,
        description: mov.description,
        amount: mov.amount,
        postDate: mov.postDate,
        type: mov.type,
        currency: mov.currency,
      });
    });

    // Para cada categoría, buscar obligaciones sugeridas usando el mapa de cruce
    const categorias = [...categMap.values()].map((cat) => {
      const cruce = obtenerCruceCategoria(cat.nombre);
      const obligacionesSugeridas = [];

      if (cruce.tipoObligacion === 'costoFijo' && cruce.categoriasObligacion.length > 0) {
        costosFijos.forEach((cf) => {
          if (cruce.categoriasObligacion.includes(cf.categoria)) {
            obligacionesSugeridas.push({
              _id: cf._id,
              nombre: cf.nombre,
              tipo: 'costoFijo',
              categoria: cf.categoria,
              monto: cf.monto,
            });
          }
        });
      }

      return {
        nombre: cat.nombre,
        icono: cat.icono,
        color: cat.color,
        total: Math.round(cat.total),
        cantidad: cat.cantidad,
        obligacionesSugeridas,
        movimientos: cat.movimientos,
      };
    }).sort((a, b) => b.total - a.total);

    res.json({ categorias, totalMovimientos: movimientos.length });
  } catch (error) {
    console.error('Error obteniendo sin asignar agrupados:', error.message);
    res.status(500).json({ message: 'Error al obtener movimientos agrupados' });
  }
});

// ===================== AUTO-ASIGNAR MOVIMIENTOS =====================

router.post('/auto-asignar', async (req, res) => {
  try {
    const userId = req.user._id;
    const { mes, modo } = req.body;

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return res.status(400).json({ message: 'Se requiere mes en formato YYYY-MM' });
    }
    if (!['preview', 'aplicar'].includes(modo)) {
      return res.status(400).json({ message: 'Modo debe ser preview o aplicar' });
    }

    const [anio, mesNum] = mes.split('-').map(Number);
    const inicio = new Date(anio, mesNum - 1, 1);
    const fin = new Date(anio, mesNum, 1);

    // Cargar todo en paralelo
    const [movimientos, mappingsArr, costosFijos] = await Promise.all([
      Movement.find({
        user: userId,
        amount: { $lt: 0 },
        'asignacion.tipo': null,
        postDate: { $gte: inicio, $lt: fin },
      }).lean(),
      CategoryMapping.find({ user: userId }).lean(),
      FixedCost.find({ user: userId }).lean(),
    ]);

    const customMap = new Map();
    mappingsArr.forEach(m => customMap.set(m.descKey, m.categoria));

    // Indexar gastos fijos por categoría
    const costosPorCategoria = new Map();
    costosFijos.forEach((cf) => {
      if (!costosPorCategoria.has(cf.categoria)) {
        costosPorCategoria.set(cf.categoria, []);
      }
      costosPorCategoria.get(cf.categoria).push(cf);
    });

    const asignaciones = [];     // Asignación clara (1 obligación match)
    const requierenRevision = []; // Múltiples matches o sin match

    movimientos.forEach((mov) => {
      const { categoria } = clasificarMovimiento(mov.description, customMap);
      const cruce = obtenerCruceCategoria(categoria);

      if (cruce.tipoObligacion !== 'costoFijo' || cruce.categoriasObligacion.length === 0) {
        requierenRevision.push({
          _id: mov._id,
          description: mov.description,
          amount: mov.amount,
          postDate: mov.postDate,
          categoria,
          razon: 'Sin cruce de categoría',
        });
        return;
      }

      // Buscar obligaciones que coincidan
      const matches = [];
      cruce.categoriasObligacion.forEach((catOblig) => {
        const encontrados = costosPorCategoria.get(catOblig) || [];
        matches.push(...encontrados);
      });

      if (matches.length === 0) {
        requierenRevision.push({
          _id: mov._id,
          description: mov.description,
          amount: mov.amount,
          postDate: mov.postDate,
          categoria,
          razon: 'No hay obligación en esa categoría',
        });
      } else if (matches.length === 1) {
        asignaciones.push({
          movimientoId: mov._id,
          description: mov.description,
          amount: mov.amount,
          postDate: mov.postDate,
          categoria,
          obligacion: {
            _id: matches[0]._id,
            nombre: matches[0].nombre,
            tipo: 'costoFijo',
            monto: matches[0].monto,
          },
        });
      } else {
        requierenRevision.push({
          _id: mov._id,
          description: mov.description,
          amount: mov.amount,
          postDate: mov.postDate,
          categoria,
          razon: 'Múltiples obligaciones en la categoría',
          opciones: matches.map(m => ({ _id: m._id, nombre: m.nombre, monto: m.monto })),
        });
      }
    });

    // Si modo preview, solo retornamos el plan
    if (modo === 'preview') {
      return res.json({
        totalMovimientos: movimientos.length,
        asignables: asignaciones.length,
        requierenRevision: requierenRevision.length,
        asignaciones,
        requierenRevision: requierenRevision,
      });
    }

    // Modo aplicar: ejecutar asignaciones
    let asignados = 0;
    for (const a of asignaciones) {
      const fecha = new Date(a.postDate);
      const mesAsig = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      await Movement.updateOne(
        { _id: a.movimientoId, user: userId },
        { $set: { asignacion: { tipo: 'costoFijo', referenciaId: a.obligacion._id, mes: mesAsig } } }
      );
      asignados++;
    }

    res.json({
      totalMovimientos: movimientos.length,
      asignados,
      requierenRevision: requierenRevision.length,
      detalle: { asignaciones, requierenRevision },
    });
  } catch (error) {
    console.error('Error en auto-asignar:', error.message);
    res.status(500).json({ message: 'Error al auto-asignar movimientos' });
  }
});

module.exports = router;
