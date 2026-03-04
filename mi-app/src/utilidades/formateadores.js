/**
 * Formatea un número como moneda chilena (CLP)
 */
export const formatearMoneda = (monto, moneda = 'CLP') => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto);
};

/**
 * Formatea una fecha ISO a formato legible
 */
export const formatearFecha = (fechaString) => {
  if (!fechaString) return '-';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(fechaString));
};

/**
 * Traduce el tipo de cuenta de Fintoc
 */
export const traducirTipoCuenta = (tipo) => {
  const tipos = {
    checking_account: 'Cuenta Corriente',
    sight_account: 'Cuenta Vista',
    savings_account: 'Cuenta de Ahorro',
    credit_card: 'Tarjeta de Crédito',
    line_of_credit: 'Línea de Crédito',
  };
  return tipos[tipo] || tipo || 'Cuenta';
};

/**
 * Traduce el tipo de crédito
 */
export const traducirTipoCredito = (tipo) => {
  const tipos = {
    hipotecario: 'Hipotecario',
    consumo: 'Consumo',
    automotriz: 'Automotriz',
    educacion: 'Educación',
    tarjeta_credito: 'Tarjeta de Crédito',
    linea_credito: 'Línea de Crédito',
    otro: 'Otro',
  };
  return tipos[tipo] || tipo || 'Crédito';
};

/**
 * Traduce el estado del crédito
 */
export const traducirEstadoCredito = (estado) => {
  const estados = {
    activo: 'Activo',
    pagado: 'Pagado',
    moroso: 'Moroso',
    refinanciado: 'Refinanciado',
  };
  return estados[estado] || estado || 'Desconocido';
};

/**
 * Obtiene información visual de un banco chileno por nombre de institución
 */
export const obtenerInfoBanco = (institutionName = '') => {
  const nombre = (institutionName || '').toLowerCase();

  const bancos = [
    { match: ['banco de chile', 'chile'], nombre: 'Banco de Chile', icono: '🔵', color: '#003DA6', colorClaro: '#e0edff' },
    { match: ['estado', 'bancoestado'], nombre: 'BancoEstado', icono: '🟢', color: '#00A651', colorClaro: '#d4f5e2' },
    { match: ['santander'], nombre: 'Santander', icono: '🔴', color: '#EC0000', colorClaro: '#ffe0e0' },
    { match: ['bci'], nombre: 'BCI', icono: '🟠', color: '#FF6600', colorClaro: '#fff0e0' },
    { match: ['scotiabank', 'scotia'], nombre: 'Scotiabank', icono: '🔴', color: '#EC111A', colorClaro: '#ffe0e2' },
    { match: ['itau', 'itaú'], nombre: 'Itaú', icono: '🟠', color: '#FF6200', colorClaro: '#fff0e0' },
    { match: ['falabella'], nombre: 'Banco Falabella', icono: '🟢', color: '#8CC63F', colorClaro: '#edf8d9' },
    { match: ['bice'], nombre: 'BICE', icono: '🔵', color: '#002F6C', colorClaro: '#dde8f5' },
    { match: ['security'], nombre: 'Banco Security', icono: '🔵', color: '#1B3A5C', colorClaro: '#dde5ee' },
    { match: ['consorcio'], nombre: 'Consorcio', icono: '🟣', color: '#6B1F7C', colorClaro: '#f0e0f7' },
    { match: ['ripley'], nombre: 'Banco Ripley', icono: '🟣', color: '#6D1076', colorClaro: '#f3e0f7' },
    { match: ['internacional'], nombre: 'Banco Internacional', icono: '🔵', color: '#0055A4', colorClaro: '#e0edff' },
  ];

  for (const banco of bancos) {
    if (banco.match.some((m) => nombre.includes(m))) {
      return banco;
    }
  }

  return { nombre: institutionName || 'Banco', icono: '🏦', color: '#6b7280', colorClaro: '#f3f4f6' };
};

/**
 * Agrupa cuentas por institución bancaria
 * Retorna: [{ institution, infoBanco, cuentas: [], balanceTotal }]
 */
export const agruparCuentasPorBanco = (cuentas) => {
  const grupos = {};

  cuentas.forEach((cuenta) => {
    const key = cuenta.institution || 'Sin institución';
    if (!grupos[key]) {
      grupos[key] = {
        institution: key,
        infoBanco: obtenerInfoBanco(key),
        cuentas: [],
        balanceTotal: 0,
      };
    }
    grupos[key].cuentas.push(cuenta);
    grupos[key].balanceTotal += cuenta.balance?.available || cuenta.balance?.current || 0;
  });

  return Object.values(grupos).sort((a, b) => b.balanceTotal - a.balanceTotal);
};

/**
 * Calcula el puntaje de salud financiera (0-100)
 */
export const calcularSaludFinanciera = (balanceTotal, totalDeuda, cuotaMensualTotal) => {
  if (totalDeuda === 0 && balanceTotal >= 0) return { puntaje: 100, nivel: 'Excelente', color: '#10b981' };

  // Ratio deuda / activos (mientras menor, mejor)
  const ratioDeuda = balanceTotal > 0 ? totalDeuda / balanceTotal : 10;
  // Ratio cuota mensual / balance (capacidad de pago)
  const ratioCuota = balanceTotal > 0 ? cuotaMensualTotal / balanceTotal : 1;

  let puntaje = 100;

  // Penalizar por ratio deuda/activos
  if (ratioDeuda > 5) puntaje -= 50;
  else if (ratioDeuda > 3) puntaje -= 35;
  else if (ratioDeuda > 1.5) puntaje -= 20;
  else if (ratioDeuda > 0.5) puntaje -= 10;

  // Penalizar por cuota mensual vs balance
  if (ratioCuota > 0.5) puntaje -= 30;
  else if (ratioCuota > 0.3) puntaje -= 20;
  else if (ratioCuota > 0.15) puntaje -= 10;

  // Ajustar si balance es negativo
  if (balanceTotal < 0) puntaje -= 20;

  puntaje = Math.max(0, Math.min(100, puntaje));

  let nivel, color;
  if (puntaje >= 80) { nivel = 'Excelente'; color = '#10b981'; }
  else if (puntaje >= 60) { nivel = 'Buena'; color = '#3b82f6'; }
  else if (puntaje >= 40) { nivel = 'Regular'; color = '#f59e0b'; }
  else if (puntaje >= 20) { nivel = 'Riesgosa'; color = '#f97316'; }
  else { nivel = 'Crítica'; color = '#ef4444'; }

  return { puntaje, nivel, color };
};
