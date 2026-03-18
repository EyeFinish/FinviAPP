const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Movement = require('../models/Movement');
const FixedCost = require('../models/FixedCost');
const Debt = require('../models/Debt');

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

module.exports = router;
