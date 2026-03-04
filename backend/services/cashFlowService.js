const Movement = require('../models/Movement');
const Account = require('../models/Account');
const Credit = require('../models/Credit');
const CashFlowCategory = require('../models/CashFlowCategory');

/**
 * Normaliza una descripción de movimiento para agrupar similares
 */
function normalizarDescripcion(desc) {
  return (desc || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\d{2}\/\d{2}\/\d{4}/g, '') // quitar fechas
    .replace(/\d{2}-\d{2}-\d{4}/g, '')
    .replace(/nro?\s*\d+/gi, '') // quitar nro operación
    .replace(/\*{3,}\d+/g, '') // quitar tarjetas enmascaradas
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Agrupa movimientos por descripción normalizada
 */
function agruparMovimientos(movimientos) {
  const grupos = {};

  for (const mov of movimientos) {
    const clave = normalizarDescripcion(mov.description);
    if (!clave || clave.length < 3) continue;

    if (!grupos[clave]) {
      grupos[clave] = {
        descripcion: mov.description,
        clave,
        movimientos: [],
        mesesPresente: new Set(),
        montos: [],
        esIngreso: false,
      };
    }

    const fecha = mov.postDate || mov.transactionDate;
    if (fecha) {
      const mesKey = new Date(fecha).toISOString().slice(0, 7);
      grupos[clave].mesesPresente.add(mesKey);
    }

    grupos[clave].movimientos.push(mov);
    grupos[clave].montos.push(mov.amount);
    // En Fintoc, ingresos tienen amount > 0 o type que indica crédito
    grupos[clave].esIngreso = mov.amount > 0;
  }

  return grupos;
}

/**
 * Calcula estadísticas de un grupo de movimientos
 */
function calcularEstadisticas(grupo, totalMesesAnalizados) {
  const montos = grupo.montos.map(Math.abs);
  const promedio = montos.reduce((s, m) => s + m, 0) / montos.length;
  const mesesPresente = grupo.mesesPresente.size;

  // Calcular desviación estándar para ver qué tan consistente es
  const varianza = montos.reduce((s, m) => s + Math.pow(m - promedio, 2), 0) / montos.length;
  const desviacion = Math.sqrt(varianza);
  const coefVariacion = promedio > 0 ? (desviacion / promedio) * 100 : 100;

  // Un gasto/ingreso es "fijo" si:
  // - Aparece en 2+ de los meses analizados
  // - Su coeficiente de variación es < 30% (montos similares)
  const esFijo = mesesPresente >= Math.max(2, totalMesesAnalizados * 0.5) && coefVariacion < 30;

  // Confianza basada en recurrencia y consistencia
  const confianzaRecurrencia = Math.min(100, (mesesPresente / totalMesesAnalizados) * 100);
  const confianzaConsistencia = Math.max(0, 100 - coefVariacion);
  const confianza = Math.round((confianzaRecurrencia * 0.6 + confianzaConsistencia * 0.4));

  // Monto promedio mensual (sumando todos los movimientos del grupo y dividiendo por meses)
  const totalAbsoluto = montos.reduce((s, m) => s + m, 0);
  const promedioMensual = Math.round(totalAbsoluto / Math.max(mesesPresente, 1));

  return {
    promedioMensual,
    mesesPresente,
    esFijo,
    confianza,
    coefVariacion: Math.round(coefVariacion),
    totalMovimientos: grupo.movimientos.length,
  };
}

/**
 * Analiza los movimientos bancarios y detecta categorías de flujo de caja.
 * Retorna categorías agrupadas por tipo.
 */
async function analizarMovimientos() {
  // 1. Obtener movimientos de los últimos 6 meses
  const hace6Meses = new Date();
  hace6Meses.setMonth(hace6Meses.getMonth() - 6);

  const movimientos = await Movement.find({
    postDate: { $gte: hace6Meses },
  }).sort({ postDate: -1 });

  if (movimientos.length === 0) {
    return { ingresos: [], costosFijos: [], costosVariables: [], totalMesesAnalizados: 0 };
  }

  // 2. Calcular cuántos meses diferentes tenemos
  const mesesUnicos = new Set();
  movimientos.forEach((m) => {
    if (m.postDate) mesesUnicos.add(new Date(m.postDate).toISOString().slice(0, 7));
  });
  const totalMesesAnalizados = mesesUnicos.size;

  // 3. Agrupar por descripción normalizada
  const grupos = agruparMovimientos(movimientos);

  // 4. Clasificar cada grupo
  const ingresos = [];
  const costosFijos = [];
  const costosVariables = [];

  for (const [clave, grupo] of Object.entries(grupos)) {
    // Ignorar grupos con pocos movimientos (ruido)
    if (grupo.movimientos.length < 2) continue;

    const stats = calcularEstadisticas(grupo, totalMesesAnalizados);

    // Ignorar montos muy pequeños (< $1.000)
    if (stats.promedioMensual < 1000) continue;

    const categoria = {
      nombre: grupo.descripcion,
      clave,
      montoPromedio: stats.promedioMensual,
      mesesDetectado: stats.mesesPresente,
      confianza: stats.confianza,
      totalMovimientos: stats.totalMovimientos,
      esIngreso: grupo.esIngreso,
    };

    if (grupo.esIngreso) {
      ingresos.push({ ...categoria, tipo: 'ingreso', esFijo: stats.esFijo });
    } else if (stats.esFijo) {
      costosFijos.push({ ...categoria, tipo: 'costo_fijo' });
    } else {
      costosVariables.push({ ...categoria, tipo: 'costo_variable' });
    }
  }

  // 5. Ordenar cada grupo por monto descendente
  ingresos.sort((a, b) => b.montoPromedio - a.montoPromedio);
  costosFijos.sort((a, b) => b.montoPromedio - a.montoPromedio);
  costosVariables.sort((a, b) => b.montoPromedio - a.montoPromedio);

  return { ingresos, costosFijos, costosVariables, totalMesesAnalizados };
}

/**
 * Sincroniza las categorías detectadas con la BD.
 * No borra las categorías existentes, solo actualiza o crea nuevas.
 */
async function sincronizarCategorias() {
  const analisis = await analizarMovimientos();
  const todasDetectadas = [
    ...analisis.ingresos.map((c) => ({ ...c, tipo: 'ingreso' })),
    ...analisis.costosFijos.map((c) => ({ ...c, tipo: 'costo_fijo' })),
    ...analisis.costosVariables.map((c) => ({ ...c, tipo: 'costo_variable' })),
  ];

  const categoriasGuardadas = [];

  for (const det of todasDetectadas) {
    const cat = await CashFlowCategory.findOneAndUpdate(
      { patronDescripcion: det.clave, esAutomatico: true },
      {
        nombre: det.nombre,
        tipo: det.tipo,
        montoPromedio: det.montoPromedio,
        patronDescripcion: det.clave,
        esAutomatico: true,
        mesesDetectado: det.mesesDetectado,
        confianza: det.confianza,
      },
      { upsert: true, new: true }
    );
    categoriasGuardadas.push(cat);
  }

  // Sincronizar créditos activos como costos fijos
  const creditos = await Credit.find({
    estado: { $in: ['activo', 'moroso'] },
    cuotaMensual: { $gt: 0 },
  });

  for (const credito of creditos) {
    const cat = await CashFlowCategory.findOneAndUpdate(
      { creditoId: credito._id },
      {
        nombre: `Cuota ${credito.nombre}`,
        tipo: 'costo_fijo',
        montoPromedio: credito.cuotaMensual,
        esAutomatico: true,
        mesesDetectado: credito.cuotasTotales - credito.cuotasPagadas,
        confianza: 100,
        creditoId: credito._id,
      },
      { upsert: true, new: true }
    );
    categoriasGuardadas.push(cat);
  }

  return {
    categorias: categoriasGuardadas,
    resumenAnalisis: {
      totalMesesAnalizados: analisis.totalMesesAnalizados,
      ingresosDetectados: analisis.ingresos.length,
      costosFijosDetectados: analisis.costosFijos.length,
      costosVariablesDetectados: analisis.costosVariables.length,
      creditosIntegrados: creditos.length,
    },
  };
}

/**
 * Genera la proyección de flujo de caja mes a mes.
 * @param {number} mesesAdelante - Meses a proyectar (6, 12 o 24)
 */
async function generarProyeccion(mesesAdelante = 12) {
  // 1. Obtener saldo real actual de todas las cuentas
  const cuentas = await Account.find({});
  const saldoActual = cuentas.reduce((sum, c) => sum + (c.balance?.available || c.balance?.current || 0), 0);

  // 2. Obtener categorías activas
  const categorias = await CashFlowCategory.find({ activo: true });

  if (categorias.length === 0) {
    // Si no hay categorías, intentar sincronizar primero
    await sincronizarCategorias();
    const categoriasNuevas = await CashFlowCategory.find({ activo: true });
    if (categoriasNuevas.length === 0) {
      return {
        saldoActual,
        meses: [],
        categorias: [],
        resumen: {
          ingresosMensuales: 0,
          egresosMensuales: 0,
          flujoNeto: 0,
          mesesHastaQuiebre: null,
        },
      };
    }
    return generarProyeccionConCategorias(saldoActual, categoriasNuevas, mesesAdelante);
  }

  return generarProyeccionConCategorias(saldoActual, categorias, mesesAdelante);
}

/**
 * Genera la proyección con categorías ya cargadas
 */
async function generarProyeccionConCategorias(saldoActual, categorias, mesesAdelante) {
  // Obtener créditos para saber cuándo terminan las cuotas
  const creditos = await Credit.find({ estado: { $in: ['activo', 'moroso'] } });
  const creditosMap = {};
  creditos.forEach((c) => {
    creditosMap[c._id.toString()] = {
      cuotasRestantes: c.cuotasTotales - c.cuotasPagadas,
      cuotaMensual: c.cuotaMensual,
      nombre: c.nombre,
    };
  });

  // Separar categorías por tipo
  const ingresosItems = categorias.filter((c) => c.tipo === 'ingreso');
  const fijoItems = categorias.filter((c) => c.tipo === 'costo_fijo' && !c.creditoId);
  const variableItems = categorias.filter((c) => c.tipo === 'costo_variable');
  const creditoItems = categorias.filter((c) => c.tipo === 'costo_fijo' && c.creditoId);

  // Calcular totales mensuales base
  const ingresosMensuales = ingresosItems.reduce((s, c) => s + c.montoPromedio, 0);
  const fijosMensuales = fijoItems.reduce((s, c) => s + c.montoPromedio, 0);
  const variablesMensuales = variableItems.reduce((s, c) => s + c.montoPromedio, 0);

  // Generar proyección mes a mes
  const hoy = new Date();
  const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const meses = [];
  let saldoAcumulado = saldoActual;
  let mesesHastaQuiebre = null;

  for (let i = 0; i < mesesAdelante; i++) {
    const fechaMes = new Date(mesActual);
    fechaMes.setMonth(fechaMes.getMonth() + i);
    const mesKey = fechaMes.toISOString().slice(0, 7);
    const mesLabel = fechaMes.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });

    // Ingresos del mes
    const detalleIngresos = ingresosItems.map((c) => ({
      id: c._id,
      nombre: c.nombre,
      monto: c.montoPromedio,
    }));
    const totalIngresos = ingresosMensuales;

    // Costos fijos del mes
    const detalleFijos = fijoItems.map((c) => ({
      id: c._id,
      nombre: c.nombre,
      monto: c.montoPromedio,
    }));
    const totalFijos = fijosMensuales;

    // Costos variables del mes
    const detalleVariables = variableItems.map((c) => ({
      id: c._id,
      nombre: c.nombre,
      monto: c.montoPromedio,
    }));
    const totalVariables = variablesMensuales;

    // Cuotas de créditos (pueden terminar en cierto mes)
    let totalCreditos = 0;
    const detalleCreditos = [];
    for (const catCredito of creditoItems) {
      const creditoInfo = catCredito.creditoId ? creditosMap[catCredito.creditoId.toString()] : null;
      if (creditoInfo && i < creditoInfo.cuotasRestantes) {
        totalCreditos += catCredito.montoPromedio;
        detalleCreditos.push({
          id: catCredito._id,
          nombre: catCredito.nombre,
          monto: catCredito.montoPromedio,
          cuotasRestantes: creditoInfo.cuotasRestantes - i,
        });
      }
    }

    // Calcular flujo neto
    const totalEgresos = totalFijos + totalVariables + totalCreditos;
    const flujoNeto = totalIngresos - totalEgresos;
    saldoAcumulado += flujoNeto;

    // Detectar quiebre (saldo negativo)
    if (saldoAcumulado < 0 && mesesHastaQuiebre === null) {
      mesesHastaQuiebre = i + 1;
    }

    meses.push({
      mes: mesKey,
      mesLabel,
      saldoInicial: Math.round(saldoAcumulado - flujoNeto),
      ingresos: {
        total: Math.round(totalIngresos),
        detalle: detalleIngresos,
      },
      costosFijos: {
        total: Math.round(totalFijos),
        detalle: detalleFijos,
      },
      costosVariables: {
        total: Math.round(totalVariables),
        detalle: detalleVariables,
      },
      creditosCuotas: {
        total: Math.round(totalCreditos),
        detalle: detalleCreditos,
      },
      totalEgresos: Math.round(totalEgresos),
      flujoNeto: Math.round(flujoNeto),
      saldoFinal: Math.round(saldoAcumulado),
    });
  }

  // Armar objeto de categorías para el frontend
  const categoriasResumen = categorias.map((c) => ({
    id: c._id,
    nombre: c.nombre,
    tipo: c.tipo,
    montoPromedio: c.montoPromedio,
    activo: c.activo,
    esAutomatico: c.esAutomatico,
    confianza: c.confianza,
    mesesDetectado: c.mesesDetectado,
    creditoId: c.creditoId,
  }));

  return {
    saldoActual,
    meses,
    categorias: categoriasResumen,
    resumen: {
      ingresosMensuales: Math.round(ingresosMensuales),
      costosFijosMensuales: Math.round(fijosMensuales),
      costosVariablesMensuales: Math.round(variablesMensuales),
      creditosMensuales: Math.round(creditoItems.reduce((s, c) => {
        const info = c.creditoId ? creditosMap[c.creditoId.toString()] : null;
        return s + (info && info.cuotasRestantes > 0 ? c.montoPromedio : 0);
      }, 0)),
      flujoNeto: Math.round(ingresosMensuales - fijosMensuales - variablesMensuales -
        creditoItems.reduce((s, c) => s + c.montoPromedio, 0)),
      mesesHastaQuiebre,
    },
  };
}

module.exports = {
  analizarMovimientos,
  sincronizarCategorias,
  generarProyeccion,
};
