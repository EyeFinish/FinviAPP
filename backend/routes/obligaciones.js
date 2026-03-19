const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Income = require('../models/Income');
const FixedCost = require('../models/FixedCost');
const Debt = require('../models/Debt');
const Movement = require('../models/Movement');
const Account = require('../models/Account');

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
    const finMesActual = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const mesActualKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

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

    // ===== Ingresos reales del mes actual (desde transacciones) =====
    const cuentas = await Account.find({ user: req.user._id }).select('_id balance').lean();
    const accountIds = cuentas.map((c) => c._id);
    const saldoInicial = cuentas.reduce((s, c) => s + (c.balance?.available ?? c.balance?.current ?? 0), 0);

    const movimientosMesActual = await Movement.find({
      user: req.user._id,
      account: { $in: accountIds },
      postDate: { $gte: mesActual, $lt: finMesActual },
    }).select('amount').lean();

    let ingresosRealesMes = 0;
    let gastosRealesMes = 0;
    movimientosMesActual.forEach((m) => {
      if (m.amount >= 0) ingresosRealesMes += m.amount;
      else gastosRealesMes += Math.abs(m.amount);
    });

    // ===== Totales acumulados desde transacciones asignadas =====
    const movimientosAsignados = await Movement.find({
      user: req.user._id,
      'asignacion.tipo': { $ne: null },
    }).select('amount asignacion').lean();

    const acumuladoCostos = {};
    const acumuladoDeudas = {};
    for (const mov of movimientosAsignados) {
      const monto = Math.abs(mov.amount);
      const refId = mov.asignacion.referenciaId?.toString();
      if (mov.asignacion.tipo === 'costoFijo' && refId) {
        acumuladoCostos[refId] = (acumuladoCostos[refId] || 0) + monto;
      } else if (mov.asignacion.tipo === 'deuda' && refId) {
        acumuladoDeudas[refId] = (acumuladoDeudas[refId] || 0) + monto;
      }
    }

    const totalAcumuladoCostos = Object.values(acumuladoCostos).reduce((s, v) => s + v, 0);
    const totalAcumuladoDeudas = Object.values(acumuladoDeudas).reduce((s, v) => s + v, 0);

    // ===== Gastos reales del mes en costos fijos (para calcular ahorro) =====
    const movsCostosMesActual = await Movement.find({
      user: req.user._id,
      'asignacion.tipo': 'costoFijo',
      'asignacion.mes': mesActualKey,
    }).select('amount').lean();
    const gastosRealesCostosFijos = movsCostosMesActual.reduce((s, m) => s + Math.abs(m.amount), 0);

    // ===== Gastos reales asignados a deudas este mes =====
    const movsDeudaMesActual = await Movement.find({
      user: req.user._id,
      'asignacion.tipo': 'deuda',
      'asignacion.mes': mesActualKey,
    }).select('amount').lean();
    const gastosRealesDeudas = movsDeudaMesActual.reduce((s, m) => s + Math.abs(m.amount), 0);

    // ===== Gastos variables = movimientos negativos del mes sin asignación =====
    const movsVariablesMesActual = await Movement.find({
      user: req.user._id,
      account: { $in: accountIds },
      amount: { $lt: 0 },
      postDate: { $gte: mesActual, $lt: finMesActual },
      $or: [
        { 'asignacion.tipo': null },
        { 'asignacion.tipo': { $exists: false } },
      ],
    }).select('amount').lean();
    const gastosVariablesMesActual = movsVariablesMesActual.reduce((s, m) => s + Math.abs(m.amount), 0);

    // ===== Proyección 12 meses con dos escenarios =====
    const proyeccion = [];
    let saldoAcumuladoConDeuda = saldoInicial;
    let saldoAcumuladoSinDeuda = saldoInicial;

    // Pre-cargar movimientos asignados por mes para los 12 meses de proyección
    const mesesKeys = [];
    for (let i = 0; i < 12; i++) {
      const f = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
      mesesKeys.push(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`);
    }
    const movsAsignadosProyeccion = await Movement.find({
      user: req.user._id,
      'asignacion.tipo': { $ne: null },
      'asignacion.mes': { $in: mesesKeys },
    }).select('amount asignacion').lean();

    // Agrupar pagos: { 'YYYY-MM' -> { 'tipo_refId' -> montoPagado } }
    const pagosPorMes = {};
    for (const mov of movsAsignadosProyeccion) {
      const mk = mov.asignacion.mes;
      if (!pagosPorMes[mk]) pagosPorMes[mk] = {};
      const key = `${mov.asignacion.tipo}_${mov.asignacion.referenciaId}`;
      pagosPorMes[mk][key] = (pagosPorMes[mk][key] || 0) + Math.abs(mov.amount);
    }

    // Mapa de deuda arrastrada: { deudaId -> montoAcumulado }
    const deudaArrastrada = {};
    const formatearMoneda = (v) => `$${Math.round(v).toLocaleString('es-CL')}`;

    for (let i = 0; i < 12; i++) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const mesLabel = fecha.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
      const esMesActualLoop = i === 0;

      // Mes actual: ingresos reales; meses futuros: ingresos seguros
      const ingMes = esMesActualLoop ? Math.round(ingresosRealesMes) : totalIngresos;

      const costosFijosEsperados = costos.filter((c) => costoActivoEnMes(c, fecha)).reduce((s, c) => s + c.monto, 0);

      // Mes actual: si gastaste menos en costos fijos, la diferencia es ahorro
      let cosMes;
      if (esMesActualLoop) {
        cosMes = Math.min(gastosRealesCostosFijos, costosFijosEsperados);
      } else {
        cosMes = costosFijosEsperados;
      }

      const ahorroCostos = esMesActualLoop ? Math.max(0, costosFijosEsperados - gastosRealesCostosFijos) : 0;

      const deuMes = deudas.filter((d) => deudaActivaEnMes(d, fecha, i)).reduce((s, d) => s + d.cuotaMensual, 0);

      // ===== Gastos variables (solo mes actual, no se proyectan) =====
      const gastosVarMes = esMesActualLoop ? gastosVariablesMesActual : 0;

      // ===== Arrastre de deudas impagas + interés moratorio =====
      let arrasteMes = 0;
      let interesMoraMes = 0;
      const itemsArrastre = [];

      if (esMesActualLoop) {
        // Mes actual: detectar deudas parcialmente pagadas → generar arrastre para meses futuros
        const pagosDelMesActual = pagosPorMes[mesKey] || {};
        for (const d of deudas.filter((dd) => deudaActivaEnMes(dd, fecha, 0))) {
          const keyD = `deuda_${d._id}`;
          const pagado = pagosDelMesActual[keyD] || 0;
          const faltante = Math.max(0, d.cuotaMensual - pagado);
          if (faltante > 0) {
            const dId = d._id.toString();
            deudaArrastrada[dId] = (deudaArrastrada[dId] || 0) + faltante;
          }
        }
      } else {
        // Meses futuros: aplicar arrastre acumulado + interés moratorio
        for (const dId of Object.keys(deudaArrastrada)) {
          const montoArr = deudaArrastrada[dId];
          if (montoArr <= 0) continue;
          const deuda = deudas.find((d) => d._id.toString() === dId);
          const tasaMensual = deuda ? (deuda.tasaInteres || 0) / 100 / 12 : 0;
          const interes = Math.round(montoArr * tasaMensual);
          arrasteMes += montoArr;
          interesMoraMes += interes;
          // El arrastre crece con el interés para el siguiente mes
          deudaArrastrada[dId] = montoArr + interes;
          itemsArrastre.push({
            tipo: 'arrastre',
            nombre: deuda ? deuda.nombre : 'Deuda',
            montoEsperado: Math.round(montoArr + interes),
            montoPagado: 0,
            porcentaje: 0,
            pagado: false,
            detalle: `Mora: ${formatearMoneda(montoArr)} + interés ${formatearMoneda(interes)}`,
          });
        }
      }

      const flujoConDeuda = ingMes - cosMes - deuMes - gastosVarMes - arrasteMes - interesMoraMes;
      const flujoSinDeuda = ingMes - cosMes - gastosVarMes;

      saldoAcumuladoConDeuda += flujoConDeuda;
      saldoAcumuladoSinDeuda += flujoSinDeuda;

      // ===== Items detalle con estado de pago =====
      const pagosDelMes = pagosPorMes[mesKey] || {};

      const itemsCostos = costos.filter((c) => costoActivoEnMes(c, fecha)).map((c) => {
        const key = `costoFijo_${c._id}`;
        const pagado = pagosDelMes[key] || 0;
        const pct = c.monto > 0 ? Math.min(100, Math.round((pagado / c.monto) * 100)) : 0;
        return {
          tipo: 'costo',
          nombre: c.nombre,
          montoEsperado: c.monto,
          montoPagado: Math.round(pagado),
          porcentaje: pct,
          pagado: pct >= 100,
        };
      });

      const itemsDeudas = deudas.filter((d) => deudaActivaEnMes(d, fecha, i)).map((d) => {
        const key = `deuda_${d._id}`;
        const pagado = pagosDelMes[key] || 0;
        const objetivo = d.cuotaMensual || 0;
        const pct = objetivo > 0 ? Math.min(100, Math.round((pagado / objetivo) * 100)) : 0;
        const cuotaNum = (d.cuotasPagadas || 0) + i + 1;
        return {
          tipo: 'deuda',
          nombre: d.nombre,
          montoEsperado: objetivo,
          montoPagado: Math.round(pagado),
          porcentaje: pct,
          pagado: pct >= 100,
          detalle: `Cuota ${cuotaNum}/${d.cuotasTotales}`,
        };
      });

      const allItems = [...itemsCostos, ...itemsDeudas, ...itemsArrastre];
      const totalEsperado = itemsCostos.reduce((s, c) => s + c.montoEsperado, 0) + itemsDeudas.reduce((s, d) => s + d.montoEsperado, 0);
      const totalPagadoMes = itemsCostos.reduce((s, c) => s + c.montoPagado, 0) + itemsDeudas.reduce((s, d) => s + d.montoPagado, 0);
      const porcentajeGlobal = totalEsperado > 0 ? Math.min(100, Math.round((totalPagadoMes / totalEsperado) * 100)) : 0;

      proyeccion.push({
        mes: mesKey,
        mesLabel,
        esActual: esMesActualLoop,
        ingresos: Math.round(ingMes),
        costosFijos: Math.round(cosMes),
        costosFijosEsperados: Math.round(costosFijosEsperados),
        ahorroCostos: Math.round(ahorroCostos),
        deudas: Math.round(deuMes),
        gastosVariables: Math.round(gastosVarMes),
        arrastre: Math.round(arrasteMes),
        interesMoratorio: Math.round(interesMoraMes),
        flujoConDeuda: Math.round(flujoConDeuda),
        flujoSinDeuda: Math.round(flujoSinDeuda),
        saldoAcumuladoConDeuda: Math.round(saldoAcumuladoConDeuda),
        saldoAcumuladoSinDeuda: Math.round(saldoAcumuladoSinDeuda),
        items: allItems,
        totalEsperado: Math.round(totalEsperado),
        totalPagadoMes: Math.round(totalPagadoMes),
        porcentajeGlobal,
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
      ingresosRealesMes: Math.round(ingresosRealesMes),
      gastosRealesMes: Math.round(gastosRealesMes),
      totalAcumuladoCostos: Math.round(totalAcumuladoCostos),
      totalAcumuladoDeudas: Math.round(totalAcumuladoDeudas),
      acumuladoCostos,
      acumuladoDeudas,
      saldoInicial: Math.round(saldoInicial),
      gastosVariablesMesActual: Math.round(gastosVariablesMesActual),
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
