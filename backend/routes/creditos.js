const express = require('express');
const router = express.Router();
const Credit = require('../models/Credit');

// GET /api/creditos - Obtener todos los créditos
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;
    const filtro = estado ? { estado } : {};
    const creditos = await Credit.find(filtro).sort({ createdAt: -1 });
    res.json(creditos);
  } catch (error) {
    console.error('Error obteniendo créditos:', error.message);
    res.status(500).json({ message: 'Error al obtener créditos' });
  }
});

// GET /api/creditos/pendientes - Créditos importados que requieren completar datos
router.get('/pendientes', async (req, res) => {
  try {
    const pendientes = await Credit.find({ requiereCompletar: true }).sort({ createdAt: -1 });
    res.json(pendientes);
  } catch (error) {
    console.error('Error obteniendo créditos pendientes:', error.message);
    res.status(500).json({ message: 'Error al obtener créditos pendientes' });
  }
});

// GET /api/creditos/resumen - Resumen de salud financiera
router.get('/resumen', async (req, res) => {
  try {
    const creditos = await Credit.find({ estado: { $in: ['activo', 'moroso'] } });

    const totalDeuda = creditos.reduce((sum, c) => sum + c.saldoPendiente, 0);
    const cuotaMensualTotal = creditos.reduce((sum, c) => sum + c.cuotaMensual, 0);
    const totalCreditosActivos = creditos.filter((c) => c.estado === 'activo').length;
    const totalCreditosMorosos = creditos.filter((c) => c.estado === 'moroso').length;

    // Cálculos de pagos e intereses
    const totalPagadoGlobal = creditos.reduce((sum, c) => sum + (c.cuotaMensual * c.cuotasPagadas), 0);
    const totalAPagarGlobal = creditos.reduce((sum, c) => sum + (c.cuotaMensual * c.cuotasTotales), 0);
    const costoInteresGlobal = totalAPagarGlobal - creditos.reduce((sum, c) => sum + c.montoOriginal, 0);

    // Desglose por tipo
    const desglosePorTipo = {};
    creditos.forEach((c) => {
      if (!desglosePorTipo[c.tipoCredito]) {
        desglosePorTipo[c.tipoCredito] = { cantidad: 0, deuda: 0, cuotaMensual: 0 };
      }
      desglosePorTipo[c.tipoCredito].cantidad += 1;
      desglosePorTipo[c.tipoCredito].deuda += c.saldoPendiente;
      desglosePorTipo[c.tipoCredito].cuotaMensual += c.cuotaMensual;
    });

    // Progreso promedio de pago
    const progresoPromedio =
      creditos.length > 0
        ? creditos.reduce((sum, c) => sum + (c.cuotasPagadas / c.cuotasTotales) * 100, 0) /
          creditos.length
        : 0;

    res.json({
      totalDeuda,
      cuotaMensualTotal,
      totalCreditosActivos,
      totalCreditosMorosos,
      totalPagadoGlobal,
      totalAPagarGlobal,
      costoInteresGlobal,
      progresoPromedio: Math.round(progresoPromedio),
      desglosePorTipo,
      creditos: creditos.map((c) => ({
        id: c._id,
        nombre: c.nombre,
        institucion: c.institucion,
        tipoCredito: c.tipoCredito,
        montoOriginal: c.montoOriginal,
        saldoPendiente: c.saldoPendiente,
        tasaInteres: c.tasaInteres,
        cuotaMensual: c.cuotaMensual,
        cuotasPagadas: c.cuotasPagadas,
        cuotasTotales: c.cuotasTotales,
        fechaInicio: c.fechaInicio,
        fechaVencimiento: c.fechaVencimiento,
        estado: c.estado,
        moneda: c.moneda,
        progreso: Math.round((c.cuotasPagadas / c.cuotasTotales) * 100),
        totalPagado: c.cuotaMensual * c.cuotasPagadas,
        totalAPagar: c.cuotaMensual * c.cuotasTotales,
        costoInteres: (c.cuotaMensual * c.cuotasTotales) - c.montoOriginal,
        restantePorPagar: c.cuotaMensual * (c.cuotasTotales - c.cuotasPagadas),
      })),
    });
  } catch (error) {
    console.error('Error obteniendo resumen:', error.message);
    res.status(500).json({ message: 'Error al obtener resumen de créditos' });
  }
});

// GET /api/creditos/proyeccion - Proyección de flujo de caja mes a mes
router.get('/proyeccion', async (req, res) => {
  try {
    const creditos = await Credit.find({ estado: { $in: ['activo', 'moroso'] } });

    if (creditos.length === 0) {
      return res.json({ meses: [], resumen: { fechaLibreDeuda: null, totalIntereses: 0, totalPagos: 0 } });
    }

    const hoy = new Date();
    const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    // Para cada crédito, calcular sus cuotas restantes y en qué mes vencen
    const creditosProyeccion = creditos.map((c) => {
      const cuotasRestantes = c.cuotasTotales - c.cuotasPagadas;
      const tasaMensual = (c.tasaInteres || 0) / 100 / 12;

      // Calcular tabla de amortización desde la cuota actual
      let saldo = c.saldoPendiente;
      const cuotas = [];

      for (let i = 0; i < cuotasRestantes; i++) {
        const interesMes = saldo * tasaMensual;
        const capitalMes = c.cuotaMensual - interesMes;
        saldo = Math.max(saldo - capitalMes, 0);

        const fechaCuota = new Date(mesActual);
        fechaCuota.setMonth(fechaCuota.getMonth() + i);

        cuotas.push({
          mes: fechaCuota.toISOString().slice(0, 7), // "YYYY-MM"
          cuota: c.cuotaMensual,
          interes: Math.round(interesMes),
          capital: Math.round(capitalMes),
          saldoRestante: Math.round(saldo),
          creditoNombre: c.nombre,
          creditoId: c._id,
        });
      }

      return {
        id: c._id,
        nombre: c.nombre,
        institucion: c.institucion,
        cuotaMensual: c.cuotaMensual,
        cuotasRestantes,
        saldoPendiente: c.saldoPendiente,
        tasaInteres: c.tasaInteres,
        fechaVencimiento: c.fechaVencimiento,
        cuotas,
      };
    });

    // Encontrar la fecha más lejana (último pago)
    let maxMeses = 0;
    creditosProyeccion.forEach((cp) => {
      if (cp.cuotas.length > maxMeses) maxMeses = cp.cuotas.length;
    });

    // Construir flujo de caja mes a mes consolidado
    const meses = [];
    let deudaAcumulada = creditos.reduce((sum, c) => sum + c.saldoPendiente, 0);
    let totalPagadoAcum = 0;
    let totalInteresAcum = 0;

    for (let i = 0; i < maxMeses; i++) {
      const fechaMes = new Date(mesActual);
      fechaMes.setMonth(fechaMes.getMonth() + i);
      const mesKey = fechaMes.toISOString().slice(0, 7);

      let pagoMes = 0;
      let interesMes = 0;
      let capitalMes = 0;
      let creditosActivosEnMes = 0;
      const detallePorCredito = [];

      creditosProyeccion.forEach((cp) => {
        const cuotaMes = cp.cuotas.find((q) => q.mes === mesKey);
        if (cuotaMes) {
          pagoMes += cuotaMes.cuota;
          interesMes += cuotaMes.interes;
          capitalMes += cuotaMes.capital;
          creditosActivosEnMes++;
          detallePorCredito.push({
            nombre: cp.nombre,
            cuota: cuotaMes.cuota,
            saldoRestante: cuotaMes.saldoRestante,
          });
        }
      });

      deudaAcumulada -= capitalMes;
      totalPagadoAcum += pagoMes;
      totalInteresAcum += interesMes;

      meses.push({
        mes: mesKey,
        mesLabel: fechaMes.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }),
        pagoTotal: Math.round(pagoMes),
        interes: Math.round(interesMes),
        capital: Math.round(capitalMes),
        deudaRestante: Math.round(Math.max(deudaAcumulada, 0)),
        totalPagadoAcumulado: Math.round(totalPagadoAcum),
        totalInteresAcumulado: Math.round(totalInteresAcum),
        creditosActivos: creditosActivosEnMes,
        detalle: detallePorCredito,
      });
    }

    // Fecha libre de deuda
    const ultimoMes = meses.length > 0 ? meses[meses.length - 1] : null;
    const fechaLibreDeuda = ultimoMes ? ultimoMes.mes : null;

    // Créditos que terminan primero y después (hitos)
    const hitos = creditosProyeccion
      .filter((cp) => cp.cuotas.length > 0)
      .map((cp) => ({
        nombre: cp.nombre,
        mesTermino: cp.cuotas[cp.cuotas.length - 1].mes,
        mesTerminoLabel: new Date(cp.cuotas[cp.cuotas.length - 1].mes + '-01').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }),
        cuotasRestantes: cp.cuotasRestantes,
        totalRestante: Math.round(cp.cuotaMensual * cp.cuotasRestantes),
      }))
      .sort((a, b) => a.mesTermino.localeCompare(b.mesTermino));

    res.json({
      meses,
      hitos,
      resumen: {
        fechaLibreDeuda,
        fechaLibreDeudaLabel: fechaLibreDeuda
          ? new Date(fechaLibreDeuda + '-01').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
          : null,
        totalPagos: Math.round(totalPagadoAcum),
        totalIntereses: Math.round(totalInteresAcum),
        mesesRestantes: maxMeses,
        cuotaMensualActual: creditos.reduce((sum, c) => sum + c.cuotaMensual, 0),
      },
    });
  } catch (error) {
    console.error('Error generando proyección:', error.message);
    res.status(500).json({ message: 'Error al generar proyección de flujo de caja' });
  }
});

// POST /api/creditos - Crear un crédito
router.post('/', async (req, res) => {
  try {
    const credito = await Credit.create(req.body);
    res.status(201).json(credito);
  } catch (error) {
    console.error('Error creando crédito:', error.message);
    if (error.name === 'ValidationError') {
      const mensajes = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Error de validación', errors: mensajes });
    }
    res.status(500).json({ message: 'Error al crear crédito' });
  }
});

// PUT /api/creditos/:id - Actualizar un crédito
router.put('/:id', async (req, res) => {
  try {
    const credito = await Credit.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!credito) {
      return res.status(404).json({ message: 'Crédito no encontrado' });
    }
    res.json(credito);
  } catch (error) {
    console.error('Error actualizando crédito:', error.message);
    res.status(500).json({ message: 'Error al actualizar crédito' });
  }
});

// DELETE /api/creditos/:id - Eliminar un crédito
router.delete('/:id', async (req, res) => {
  try {
    const credito = await Credit.findByIdAndDelete(req.params.id);
    if (!credito) {
      return res.status(404).json({ message: 'Crédito no encontrado' });
    }
    res.json({ message: 'Crédito eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando crédito:', error.message);
    res.status(500).json({ message: 'Error al eliminar crédito' });
  }
});

module.exports = router;
