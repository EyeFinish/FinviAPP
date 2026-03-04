const express = require('express');
const router = express.Router();
const CashFlowCategory = require('../models/CashFlowCategory');
const cashFlowService = require('../services/cashFlowService');

// GET /api/flujo/analisis — Analizar movimientos y sincronizar categorías
router.get('/analisis', async (req, res) => {
  try {
    const resultado = await cashFlowService.sincronizarCategorias();

    // Agrupar por tipo para el frontend
    const categorias = await CashFlowCategory.find({ activo: true }).sort({ tipo: 1, montoPromedio: -1 });

    const agrupadas = {
      ingresos: categorias.filter((c) => c.tipo === 'ingreso'),
      costosFijos: categorias.filter((c) => c.tipo === 'costo_fijo'),
      costosVariables: categorias.filter((c) => c.tipo === 'costo_variable'),
    };

    res.json({
      categorias: agrupadas,
      resumen: resultado.resumenAnalisis,
    });
  } catch (error) {
    console.error('Error en análisis de flujo:', error.message);
    res.status(500).json({ message: 'Error al analizar movimientos' });
  }
});

// GET /api/flujo/proyeccion?meses=12 — Proyección de flujo de caja
router.get('/proyeccion', async (req, res) => {
  try {
    const meses = Math.min(Math.max(parseInt(req.query.meses) || 12, 1), 36);
    const proyeccion = await cashFlowService.generarProyeccion(meses);
    res.json(proyeccion);
  } catch (error) {
    console.error('Error generando proyección de flujo:', error.message);
    res.status(500).json({ message: 'Error al generar proyección' });
  }
});

// PUT /api/flujo/categorias/:id — Actualizar una categoría (toggle activo, editar monto)
router.put('/categorias/:id', async (req, res) => {
  try {
    const { activo, montoPromedio, nombre } = req.body;
    const updateData = {};

    if (typeof activo === 'boolean') updateData.activo = activo;
    if (typeof montoPromedio === 'number' && montoPromedio >= 0) updateData.montoPromedio = montoPromedio;
    if (typeof nombre === 'string' && nombre.trim()) updateData.nombre = nombre.trim();

    const categoria = await CashFlowCategory.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!categoria) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    res.json(categoria);
  } catch (error) {
    console.error('Error actualizando categoría:', error.message);
    res.status(500).json({ message: 'Error al actualizar categoría' });
  }
});

// POST /api/flujo/categorias — Crear categoría manual
router.post('/categorias', async (req, res) => {
  try {
    const { nombre, tipo, montoPromedio } = req.body;

    if (!nombre || !tipo || montoPromedio === undefined) {
      return res.status(400).json({ message: 'nombre, tipo y montoPromedio son requeridos' });
    }

    const categoria = await CashFlowCategory.create({
      nombre: nombre.trim(),
      tipo,
      montoPromedio,
      esAutomatico: false,
      activo: true,
      confianza: 100,
      mesesDetectado: 0,
    });

    res.status(201).json(categoria);
  } catch (error) {
    console.error('Error creando categoría:', error.message);
    res.status(500).json({ message: 'Error al crear categoría' });
  }
});

// DELETE /api/flujo/categorias/:id — Eliminar categoría
router.delete('/categorias/:id', async (req, res) => {
  try {
    const categoria = await CashFlowCategory.findByIdAndDelete(req.params.id);
    if (!categoria) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    console.error('Error eliminando categoría:', error.message);
    res.status(500).json({ message: 'Error al eliminar categoría' });
  }
});

// POST /api/flujo/reanalizar — Forzar re-análisis de movimientos
router.post('/reanalizar', async (req, res) => {
  try {
    // Limpiar categorías automáticas existentes
    await CashFlowCategory.deleteMany({ esAutomatico: true });

    // Re-analizar
    const resultado = await cashFlowService.sincronizarCategorias();
    const categorias = await CashFlowCategory.find({ activo: true }).sort({ tipo: 1, montoPromedio: -1 });

    res.json({
      categorias: {
        ingresos: categorias.filter((c) => c.tipo === 'ingreso'),
        costosFijos: categorias.filter((c) => c.tipo === 'costo_fijo'),
        costosVariables: categorias.filter((c) => c.tipo === 'costo_variable'),
      },
      resumen: resultado.resumenAnalisis,
      message: 'Análisis completado',
    });
  } catch (error) {
    console.error('Error re-analizando:', error.message);
    res.status(500).json({ message: 'Error al re-analizar movimientos' });
  }
});

module.exports = router;
