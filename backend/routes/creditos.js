const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Credit = require('../models/Credit');
const Movement = require('../models/Movement');
const Account = require('../models/Account');

const TIPOS_ROTATIVOS = ['tarjeta_credito', 'linea_credito'];
const REGEX_LINEA_CREDITO = /linea\s*(de\s*)?cred/i;

// Helper: obtener movimientos de línea de crédito desde cuentas corrientes
async function obtenerMovimientosLineaCredito(userId) {
  const cuentasCorrientes = await Account.find({
    user: userId,
    type: { $in: ['checking_account', 'sight_account'] },
  }).select('_id');

  if (cuentasCorrientes.length === 0) return { movimientos: [], resumen: { totalUsado: 0, totalPagado: 0, saldoCalculado: 0 } };

  const accountIds = cuentasCorrientes.map((c) => c._id);
  const movimientos = await Movement.find({
    account: { $in: accountIds },
    description: { $regex: REGEX_LINEA_CREDITO },
  }).sort({ postDate: -1 });

  let totalUsado = 0;
  let totalPagado = 0;
  movimientos.forEach((m) => {
    if (m.amount > 0) totalUsado += m.amount;
    else totalPagado += Math.abs(m.amount);
  });

  return {
    movimientos,
    resumen: {
      totalUsado: Math.round(totalUsado),
      totalPagado: Math.round(totalPagado),
      saldoCalculado: Math.max(Math.round(totalUsado - totalPagado), 0),
    },
  };
}

// Todas las rutas requieren autenticación
router.use(auth);

// GET /api/creditos - Obtener todos los créditos
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;
    const filtro = { user: req.user._id };
    if (estado) filtro.estado = estado;
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
    const pendientes = await Credit.find({ user: req.user._id, requiereCompletar: true }).sort({ createdAt: -1 });
    res.json(pendientes);
  } catch (error) {
    console.error('Error obteniendo créditos pendientes:', error.message);
    res.status(500).json({ message: 'Error al obtener créditos pendientes' });
  }
});

// GET /api/creditos/resumen - Resumen de salud financiera
router.get('/resumen', async (req, res) => {
  try {
    const creditos = await Credit.find({ user: req.user._id, estado: { $in: ['activo', 'moroso'] } });

    const enCuotas = creditos.filter((c) => !TIPOS_ROTATIVOS.includes(c.tipoCredito));
    const rotativos = creditos.filter((c) => TIPOS_ROTATIVOS.includes(c.tipoCredito));

    // Para líneas de crédito: calcular saldo real desde transacciones de cuenta corriente
    const lineasCredito = rotativos.filter((c) => c.tipoCredito === 'linea_credito');
    let saldoLineaCalculado = null;
    if (lineasCredito.length > 0) {
      const { resumen: resumenLinea } = await obtenerMovimientosLineaCredito(req.user._id);
      saldoLineaCalculado = resumenLinea;
    }

    const totalDeuda = creditos.reduce((sum, c) => sum + c.saldoPendiente, 0);
    const cuotaMensualTotal = enCuotas.reduce((sum, c) => sum + c.cuotaMensual, 0);
    const totalCreditosActivos = creditos.filter((c) => c.estado === 'activo').length;
    const totalCreditosMorosos = creditos.filter((c) => c.estado === 'moroso').length;

    // Cálculos solo para créditos en cuotas
    const totalPagadoGlobal = enCuotas.reduce((sum, c) => sum + (c.cuotaMensual * c.cuotasPagadas), 0);
    const totalAPagarGlobal = enCuotas.reduce((sum, c) => sum + (c.cuotaMensual * c.cuotasTotales), 0);
    const costoInteresGlobal = totalAPagarGlobal - enCuotas.reduce((sum, c) => sum + c.montoOriginal, 0);

    // Resumen rotativos
    const cupoTotalRotativos = rotativos.reduce((sum, c) => sum + c.montoOriginal, 0);
    const deudaRotativos = rotativos.reduce((sum, c) => sum + c.saldoPendiente, 0);
    const disponibleRotativos = cupoTotalRotativos - deudaRotativos;
    const utilizacionRotativos = cupoTotalRotativos > 0
      ? Math.round((deudaRotativos / cupoTotalRotativos) * 100) : 0;

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

    // Progreso promedio solo para créditos en cuotas
    const progresoPromedio =
      enCuotas.length > 0
        ? enCuotas.reduce((sum, c) => sum + (c.cuotasTotales > 0 ? (c.cuotasPagadas / c.cuotasTotales) * 100 : 0), 0) /
          enCuotas.length
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
      // Datos rotativos
      cupoTotalRotativos,
      deudaRotativos,
      disponibleRotativos,
      utilizacionRotativos,
      cantidadRotativos: rotativos.length,
      cantidadEnCuotas: enCuotas.length,
      desglosePorTipo,
      creditos: creditos.map((c) => {
        const esRotativo = TIPOS_ROTATIVOS.includes(c.tipoCredito);
        const base = {
          id: c._id,
          nombre: c.nombre,
          institucion: c.institucion,
          tipoCredito: c.tipoCredito,
          esRotativo,
          montoOriginal: c.montoOriginal,
          saldoPendiente: c.saldoPendiente,
          tasaInteres: c.tasaInteres,
          estado: c.estado,
          moneda: c.moneda,
          fintocAccountId: c.fintocAccountId,
        };

        if (esRotativo) {
          let deudaReal = c.saldoPendiente;
          // Para líneas de crédito: usar saldo calculado desde transacciones
          if (c.tipoCredito === 'linea_credito' && saldoLineaCalculado) {
            deudaReal = saldoLineaCalculado.saldoCalculado;
          }
          const cupo = c.montoOriginal;
          return {
            ...base,
            cupo,
            deuda: deudaReal,
            disponible: Math.max(cupo - deudaReal, 0),
            utilizacion: cupo > 0 ? Math.round((deudaReal / cupo) * 100) : 0,
            // Datos extra para líneas de crédito
            ...(c.tipoCredito === 'linea_credito' && saldoLineaCalculado ? {
              totalUsado: saldoLineaCalculado.totalUsado,
              totalPagado: saldoLineaCalculado.totalPagado,
              saldoCalculado: saldoLineaCalculado.saldoCalculado,
            } : {}),
          };
        }

        return {
          ...base,
          cuotaMensual: c.cuotaMensual,
          cuotasPagadas: c.cuotasPagadas,
          cuotasTotales: c.cuotasTotales,
          fechaInicio: c.fechaInicio,
          fechaVencimiento: c.fechaVencimiento,
          progreso: c.cuotasTotales > 0 ? Math.round((c.cuotasPagadas / c.cuotasTotales) * 100) : 0,
          totalPagado: c.cuotaMensual * c.cuotasPagadas,
          totalAPagar: c.cuotaMensual * c.cuotasTotales,
          costoInteres: (c.cuotaMensual * c.cuotasTotales) - c.montoOriginal,
          restantePorPagar: c.cuotaMensual * (c.cuotasTotales - c.cuotasPagadas),
        };
      }),
    });
  } catch (error) {
    console.error('Error obteniendo resumen:', error.message);
    res.status(500).json({ message: 'Error al obtener resumen de créditos' });
  }
});

// GET /api/creditos/proyeccion - Proyección de flujo de caja mes a mes (solo créditos en cuotas)
router.get('/proyeccion', async (req, res) => {
  try {
    const creditos = await Credit.find({
      user: req.user._id,
      estado: { $in: ['activo', 'moroso'] },
      tipoCredito: { $nin: TIPOS_ROTATIVOS },
    });

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

// GET /api/creditos/pagos-sin-vincular - Transacciones que parecen pagos de crédito sin vincular
router.get('/pagos-sin-vincular', async (req, res) => {
  try {
    const movimientos = await Movement.find({
      user: req.user._id,
      amount: { $lt: 0 },
      creditoVinculado: { $exists: false },
    }).sort({ postDate: -1 }).limit(50);
    res.json(movimientos);
  } catch (error) {
    console.error('Error obteniendo pagos sin vincular:', error.message);
    res.status(500).json({ message: 'Error al obtener pagos sin vincular' });
  }
});

// GET /api/creditos/:id/pagos-detectados - Pagos detectados para un crédito
router.get('/:id/pagos-detectados', async (req, res) => {
  try {
    const pagos = await Movement.find({
      user: req.user._id,
      creditoVinculado: req.params.id,
    }).sort({ postDate: -1 });
    res.json(pagos);
  } catch (error) {
    console.error('Error obteniendo pagos detectados:', error.message);
    res.status(500).json({ message: 'Error al obtener pagos detectados' });
  }
});

// POST /api/creditos/:id/confirmar-pago - Confirmar que un movimiento es pago de este crédito
router.post('/:id/confirmar-pago', async (req, res) => {
  try {
    const { movimientoId } = req.body;
    if (!movimientoId) {
      return res.status(400).json({ message: 'movimientoId es requerido' });
    }
    const movimiento = await Movement.findOneAndUpdate(
      { _id: movimientoId, user: req.user._id },
      { creditoVinculado: req.params.id },
      { new: true }
    );
    if (!movimiento) {
      return res.status(404).json({ message: 'Movimiento no encontrado' });
    }
    res.json({ message: 'Pago vinculado correctamente', movimiento });
  } catch (error) {
    console.error('Error confirmando pago:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/creditos/:id/desvincular-pago - Desvincular un movimiento de un crédito
router.post('/:id/desvincular-pago', async (req, res) => {
  try {
    const { movimientoId } = req.body;
    if (!movimientoId) {
      return res.status(400).json({ message: 'movimientoId es requerido' });
    }
    const movimiento = await Movement.findOneAndUpdate(
      { _id: movimientoId, user: req.user._id },
      { $unset: { creditoVinculado: 1 } },
      { new: true }
    );
    if (!movimiento) {
      return res.status(404).json({ message: 'Movimiento no encontrado' });
    }
    res.json({ message: 'Pago desvinculado correctamente', movimiento });
  } catch (error) {
    console.error('Error desvinculando pago:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/creditos/:id/transacciones - Transacciones de un crédito rotativo
router.get('/:id/transacciones', async (req, res) => {
  try {
    const credito = await Credit.findOne({ _id: req.params.id, user: req.user._id });
    if (!credito) {
      return res.status(404).json({ message: 'Crédito no encontrado' });
    }

    // Líneas de crédito: buscar transacciones cruzadas en cuentas corrientes
    if (credito.tipoCredito === 'linea_credito') {
      const { movimientos, resumen } = await obtenerMovimientosLineaCredito(req.user._id);
      return res.json({ movimientos: movimientos.slice(0, 50), resumen });
    }

    // Otros rotativos (tarjetas): buscar por cuenta Fintoc vinculada
    if (!credito.fintocAccountId) {
      return res.json({ movimientos: [], resumen: null });
    }
    const movimientos = await Movement.find({ account: credito.fintocAccountId })
      .sort({ postDate: -1 })
      .limit(50);
    res.json({ movimientos, resumen: null });
  } catch (error) {
    console.error('Error obteniendo transacciones del crédito:', error.message);
    res.status(500).json({ message: 'Error al obtener transacciones' });
  }
});

// POST /api/creditos - Crear un crédito
router.post('/', async (req, res) => {
  try {
    const data = { ...req.body, user: req.user._id };
    const esRotativo = TIPOS_ROTATIVOS.includes(data.tipoCredito);

    // Para créditos en cuotas: auto-calcular fechaVencimiento si viene cuotasTotales + fechaInicio
    if (!esRotativo && data.cuotasTotales && data.fechaInicio && !data.fechaVencimiento) {
      const inicio = new Date(data.fechaInicio);
      inicio.setMonth(inicio.getMonth() + Number(data.cuotasTotales));
      data.fechaVencimiento = inicio;
    }

    // Para rotativos: defaults seguros
    if (esRotativo) {
      data.cuotaMensual = data.cuotaMensual || 0;
      data.cuotasTotales = data.cuotasTotales || 0;
      data.cuotasPagadas = data.cuotasPagadas || 0;
      if (!data.fechaInicio) data.fechaInicio = new Date();
    }

    const credito = await Credit.create(data);
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
    const credito = await Credit.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
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
    const credito = await Credit.findOneAndDelete({ _id: req.params.id, user: req.user._id });
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
