const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Income = require('../models/Income');
const FixedCost = require('../models/FixedCost');
const Debt = require('../models/Debt');
const Movement = require('../models/Movement');

const SISTEMAS_LABEL = { frances: 'Francés', aleman: 'Alemán', simple: 'Simple' };

router.use(auth);

// ===================== INGRESOS =====================

router.get('/ingresos', async (req, res) => {
  try {
    const ingresos = await Income.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(ingresos);
  } catch (error) {
    console.error('Error obteniendo ingresos:', error.message);
    res.status(500).json({ message: 'Error al obtener ingresos' });
  }
});

router.post('/ingresos', async (req, res) => {
  try {
    const ingreso = await Income.create({ ...req.body, user: req.user._id });
    res.status(201).json(ingreso);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const mensajes = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Error de validación', errors: mensajes });
    }
    console.error('Error creando ingreso:', error.message);
    res.status(500).json({ message: 'Error al crear ingreso' });
  }
});

router.put('/ingresos/:id', async (req, res) => {
  try {
    const ingreso = await Income.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!ingreso) return res.status(404).json({ message: 'Ingreso no encontrado' });
    res.json(ingreso);
  } catch (error) {
    console.error('Error actualizando ingreso:', error.message);
    res.status(500).json({ message: 'Error al actualizar ingreso' });
  }
});

router.delete('/ingresos/:id', async (req, res) => {
  try {
    const ingreso = await Income.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!ingreso) return res.status(404).json({ message: 'Ingreso no encontrado' });
    res.json({ message: 'Ingreso eliminado' });
  } catch (error) {
    console.error('Error eliminando ingreso:', error.message);
    res.status(500).json({ message: 'Error al eliminar ingreso' });
  }
});

// ===================== COSTOS FIJOS =====================

router.get('/costos', async (req, res) => {
  try {
    const costos = await FixedCost.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(costos);
  } catch (error) {
    console.error('Error obteniendo costos fijos:', error.message);
    res.status(500).json({ message: 'Error al obtener costos fijos' });
  }
});

router.post('/costos', async (req, res) => {
  try {
    const costo = await FixedCost.create({ ...req.body, user: req.user._id });
    res.status(201).json(costo);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const mensajes = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Error de validación', errors: mensajes });
    }
    console.error('Error creando costo fijo:', error.message);
    res.status(500).json({ message: 'Error al crear costo fijo' });
  }
});

router.put('/costos/:id', async (req, res) => {
  try {
    const costo = await FixedCost.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!costo) return res.status(404).json({ message: 'Costo no encontrado' });
    res.json(costo);
  } catch (error) {
    console.error('Error actualizando costo fijo:', error.message);
    res.status(500).json({ message: 'Error al actualizar costo fijo' });
  }
});

router.delete('/costos/:id', async (req, res) => {
  try {
    const costo = await FixedCost.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!costo) return res.status(404).json({ message: 'Costo no encontrado' });
    res.json({ message: 'Costo eliminado' });
  } catch (error) {
    console.error('Error eliminando costo fijo:', error.message);
    res.status(500).json({ message: 'Error al eliminar costo fijo' });
  }
});

// ===================== DEUDAS =====================

router.get('/deudas', async (req, res) => {
  try {
    const deudas = await Debt.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(deudas);
  } catch (error) {
    console.error('Error obteniendo deudas:', error.message);
    res.status(500).json({ message: 'Error al obtener deudas' });
  }
});

router.post('/deudas', async (req, res) => {
  try {
    const deuda = await Debt.create({ ...req.body, user: req.user._id });
    res.status(201).json(deuda);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const mensajes = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Error de validación', errors: mensajes });
    }
    console.error('Error creando deuda:', error.message, error.stack);
    res.status(500).json({ message: 'Error al crear deuda', detail: error.message });
  }
});

// PUT usa findOne + save para activar el pre-save hook de cálculos
router.put('/deudas/:id', async (req, res) => {
  try {
    const deuda = await Debt.findOne({ _id: req.params.id, user: req.user._id });
    if (!deuda) return res.status(404).json({ message: 'Deuda no encontrada' });
    Object.assign(deuda, req.body);
    await deuda.save();
    res.json(deuda);
  } catch (error) {
    console.error('Error actualizando deuda:', error.message);
    res.status(500).json({ message: 'Error al actualizar deuda' });
  }
});

router.delete('/deudas/:id', async (req, res) => {
  try {
    const deuda = await Debt.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!deuda) return res.status(404).json({ message: 'Deuda no encontrada' });
    res.json({ message: 'Deuda eliminada' });
  } catch (error) {
    console.error('Error eliminando deuda:', error.message);
    res.status(500).json({ message: 'Error al eliminar deuda' });
  }
});

// ===================== TABLA DE AMORTIZACIÓN =====================

function generarTablaAmortizacion(montoTotal, tasaAnual, cuotasTotales, sistema) {
  const tabla = [];
  const r = tasaAnual / 100 / 12;
  let saldo = montoTotal;

  if (sistema === 'frances') {
    let cuota;
    if (r > 0) {
      cuota = montoTotal * r * Math.pow(1 + r, cuotasTotales) / (Math.pow(1 + r, cuotasTotales) - 1);
    } else {
      cuota = montoTotal / cuotasTotales;
    }
    for (let i = 1; i <= cuotasTotales; i++) {
      const interes = saldo * r;
      const amortizacion = cuota - interes;
      saldo -= amortizacion;
      tabla.push({ cuota: i, montoCuota: Math.round(cuota), interes: Math.round(interes), amortizacion: Math.round(amortizacion), saldo: Math.max(0, Math.round(saldo)) });
    }
  } else if (sistema === 'aleman') {
    const amortConst = montoTotal / cuotasTotales;
    for (let i = 1; i <= cuotasTotales; i++) {
      const interes = saldo * r;
      const cuota = amortConst + interes;
      saldo -= amortConst;
      tabla.push({ cuota: i, montoCuota: Math.round(cuota), interes: Math.round(interes), amortizacion: Math.round(amortConst), saldo: Math.max(0, Math.round(saldo)) });
    }
  } else {
    const interesTotal = montoTotal * (tasaAnual / 100) * (cuotasTotales / 12);
    const cuota = (montoTotal + interesTotal) / cuotasTotales;
    const interesMensual = interesTotal / cuotasTotales;
    const amortMensual = montoTotal / cuotasTotales;
    for (let i = 1; i <= cuotasTotales; i++) {
      saldo -= amortMensual;
      tabla.push({ cuota: i, montoCuota: Math.round(cuota), interes: Math.round(interesMensual), amortizacion: Math.round(amortMensual), saldo: Math.max(0, Math.round(saldo)) });
    }
  }
  return tabla;
}

router.get('/deudas/:id/amortizacion', async (req, res) => {
  try {
    const deuda = await Debt.findOne({ _id: req.params.id, user: req.user._id });
    if (!deuda) return res.status(404).json({ message: 'Deuda no encontrada' });
    const tabla = generarTablaAmortizacion(deuda.montoTotal, deuda.tasaInteres, deuda.cuotasTotales, deuda.sistemaAmortizacion);
    res.json({ deuda: deuda.nombre, tabla });
  } catch (error) {
    console.error('Error generando tabla de amortización:', error.message);
    res.status(500).json({ message: 'Error al generar tabla de amortización' });
  }
});

// ===================== RESUMEN / CÁLCULOS =====================

function costoActivoEnMes(costo, fechaMes) {
  if (costo.tipoCompromiso === 'permanente') return true;
  if (costo.tipoCompromiso === 'temporal' && costo.duracion) {
    const fin = new Date(costo.createdAt);
    fin.setMonth(fin.getMonth() + costo.duracion);
    return fechaMes < fin;
  }
  return true;
}

function deudaActivaEnMes(deuda, fechaMes, mesOffset) {
  // La deuda está activa si aún le quedan cuotas por pagar contando el offset de meses
  const restantes = (deuda.cuotasTotales || 0) - (deuda.cuotasPagadas || 0);
  return restantes > mesOffset;
}

router.get('/resumen', async (req, res) => {
  try {
    const [ingresos, costos, deudas] = await Promise.all([
      Income.find({ user: req.user._id }),
      FixedCost.find({ user: req.user._id }),
      Debt.find({ user: req.user._id }),
    ]);

    const hoy = new Date();
    const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const totalIngresos = ingresos.reduce((s, i) => s + i.monto, 0);

    // Costos activos este mes
    const totalCostos = costos
      .filter((c) => costoActivoEnMes(c, mesActual))
      .reduce((s, c) => s + c.monto, 0);

    // Deudas activas este mes (offset 0 = mes actual)
    const totalDeudas = deudas
      .filter((d) => deudaActivaEnMes(d, mesActual, 0))
      .reduce((s, d) => s + d.cuotaMensual, 0);

    const flujoCaja = totalIngresos - totalCostos - totalDeudas;
    const porcentajeComprometido = totalIngresos > 0
      ? Math.round(((totalCostos + totalDeudas) / totalIngresos) * 100) : 0;

    let nivelCarga, riesgoSobreendeudamiento;
    if (porcentajeComprometido <= 40) {
      nivelCarga = 'Bajo'; riesgoSobreendeudamiento = 'Bajo';
    } else if (porcentajeComprometido <= 60) {
      nivelCarga = 'Moderado'; riesgoSobreendeudamiento = 'Moderado';
    } else if (porcentajeComprometido <= 80) {
      nivelCarga = 'Alto'; riesgoSobreendeudamiento = 'Alto';
    } else {
      nivelCarga = 'Crítico'; riesgoSobreendeudamiento = 'Muy alto';
    }

    // Proyección 12 meses con cálculo dinámico por mes
    const proyeccion = [];
    for (let i = 0; i < 12; i++) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const mesLabel = fecha.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });

      const ingMes = totalIngresos;
      const cosMes = costos.filter((c) => costoActivoEnMes(c, fecha)).reduce((s, c) => s + c.monto, 0);
      const deuMes = deudas.filter((d) => deudaActivaEnMes(d, fecha, i)).reduce((s, d) => s + d.cuotaMensual, 0);

      // Items activos del mes
      const items = [];
      costos.filter((c) => costoActivoEnMes(c, fecha)).forEach((c) => {
        items.push({ tipo: 'costo', nombre: c.nombre, monto: c.monto, detalle: c.tipoCompromiso === 'temporal' ? `Temporal (${c.duracion} meses)` : 'Permanente' });
      });
      deudas.filter((d) => deudaActivaEnMes(d, fecha, i)).forEach((d) => {
        const cuotaNum = (d.cuotasPagadas || 0) + i + 1;
        items.push({ tipo: 'deuda', nombre: d.nombre, monto: d.cuotaMensual, detalle: `Cuota ${cuotaNum}/${d.cuotasTotales} · ${SISTEMAS_LABEL[d.sistemaAmortizacion] || d.sistemaAmortizacion}` });
      });
      ingresos.forEach((ing) => {
        items.push({ tipo: 'ingreso', nombre: ing.nombre, monto: ing.monto });
      });

      proyeccion.push({
        mes: mesKey,
        mesLabel,
        ingresos: Math.round(ingMes),
        costos: Math.round(cosMes),
        deudas: Math.round(deuMes),
        flujo: Math.round(ingMes - cosMes - deuMes),
        items,
      });
    }

    // Desglose por categoría
    const desgloseCostos = {};
    costos.filter((c) => costoActivoEnMes(c, mesActual)).forEach((c) => {
      if (!desgloseCostos[c.categoria]) desgloseCostos[c.categoria] = 0;
      desgloseCostos[c.categoria] += c.monto;
    });

    res.json({
      totalIngresos: Math.round(totalIngresos),
      totalCostos: Math.round(totalCostos),
      totalDeudas: Math.round(totalDeudas),
      flujoCaja: Math.round(flujoCaja),
      porcentajeComprometido,
      nivelCarga,
      riesgoSobreendeudamiento,
      cantidadIngresos: ingresos.length,
      cantidadCostos: costos.length,
      cantidadDeudas: deudas.length,
      desgloseCostos,
      proyeccion,
    });
  } catch (error) {
    console.error('Error generando resumen obligaciones:', error.message);
    res.status(500).json({ message: 'Error al generar resumen de obligaciones' });
  }
});

// ===================== PROGRESO MENSUAL DE OBLIGACIONES =====================

router.get('/progreso-mensual', async (req, res) => {
  try {
    const hoy = new Date();
    const mes = req.query.mes || `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

    const [costos, deudas] = await Promise.all([
      FixedCost.find({ user: req.user._id }),
      Debt.find({ user: req.user._id }),
    ]);

    // Obtener todos los movimientos asignados de este mes
    const movimientosAsignados = await Movement.find({
      user: req.user._id,
      'asignacion.mes': mes,
      'asignacion.tipo': { $ne: null },
    }).select('amount description postDate asignacion').lean();

    // Agrupar montos por tipo + referenciaId
    const pagosMap = {};
    const movsPorObligacion = {};
    for (const mov of movimientosAsignados) {
      const key = `${mov.asignacion.tipo}_${mov.asignacion.referenciaId}`;
      // amount es negativo (gasto), lo convertimos a positivo para sumar pagos
      const monto = Math.abs(mov.amount);
      pagosMap[key] = (pagosMap[key] || 0) + monto;
      if (!movsPorObligacion[key]) movsPorObligacion[key] = [];
      movsPorObligacion[key].push({
        _id: mov._id,
        amount: mov.amount,
        description: mov.description,
        postDate: mov.postDate,
      });
    }

    // Verificar actividad del mes
    const [anio, mesNum] = mes.split('-').map(Number);
    const fechaMes = new Date(anio, mesNum - 1, 1);

    // Progreso de costos fijos
    const progresoCostos = costos
      .filter((c) => costoActivoEnMes(c, fechaMes))
      .map((c) => {
        const key = `costoFijo_${c._id}`;
        const montoPagado = pagosMap[key] || 0;
        return {
          _id: c._id,
          nombre: c.nombre,
          categoria: c.categoria,
          tipo: 'costoFijo',
          montoObjetivo: c.monto,
          montoPagado,
          porcentaje: c.monto > 0 ? Math.min(100, Math.round((montoPagado / c.monto) * 100)) : 0,
          movimientos: movsPorObligacion[key] || [],
        };
      });

    // Calcular el offset del mes respecto al mes actual para deudas
    const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const mesOffset = (anio - mesActual.getFullYear()) * 12 + (mesNum - 1 - mesActual.getMonth());

    // Progreso de deudas
    const progresoDeudas = deudas
      .filter((d) => deudaActivaEnMes(d, fechaMes, Math.max(0, mesOffset)))
      .map((d) => {
        const key = `deuda_${d._id}`;
        const montoPagado = pagosMap[key] || 0;
        const objetivo = d.cuotaMensual || 0;
        return {
          _id: d._id,
          nombre: d.nombre,
          tipo: 'deuda',
          montoObjetivo: objetivo,
          montoPagado,
          porcentaje: objetivo > 0 ? Math.min(100, Math.round((montoPagado / objetivo) * 100)) : 0,
          movimientos: movsPorObligacion[key] || [],
        };
      });

    const obligaciones = [...progresoCostos, ...progresoDeudas];
    const totalComprometido = obligaciones.reduce((s, o) => s + o.montoObjetivo, 0);
    const totalPagado = obligaciones.reduce((s, o) => s + o.montoPagado, 0);
    const porcentajeGeneral = totalComprometido > 0
      ? Math.min(100, Math.round((totalPagado / totalComprometido) * 100))
      : 0;

    res.json({
      mes,
      obligaciones,
      totalComprometido: Math.round(totalComprometido),
      totalPagado: Math.round(totalPagado),
      porcentajeGeneral,
    });
  } catch (error) {
    console.error('Error obteniendo progreso mensual:', error.message);
    res.status(500).json({ message: 'Error al obtener progreso mensual' });
  }
});

module.exports = router;
