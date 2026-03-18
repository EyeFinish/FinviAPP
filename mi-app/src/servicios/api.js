import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: adjuntar token JWT a cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('finvi_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: si el servidor responde 401, cerrar sesión
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('finvi_token')) {
      localStorage.removeItem('finvi_token');
      localStorage.removeItem('finvi_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ===== AUTH =====
export const registrarUsuario = async (datos) => {
  const response = await api.post('/auth/registro', datos);
  return response.data;
};

export const loginUsuario = async (datos) => {
  const response = await api.post('/auth/login', datos);
  return response.data;
};

export const obtenerUsuarioActual = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const crearLinkIntent = async () => {
  const response = await api.post('/fintoc/link-intent');
  return response.data;
};

export const intercambiarToken = async (exchangeToken) => {
  const response = await api.post('/fintoc/exchange', { exchangeToken });
  return response.data;
};

export const obtenerCuentas = async () => {
  const response = await api.get('/fintoc/accounts');
  return response.data;
};

export const obtenerMovimientos = async (accountId) => {
  const response = await api.get(`/fintoc/accounts/${accountId}/movements`);
  return response.data;
};

export const refrescarDatos = async () => {
  const response = await api.post('/fintoc/refresh');
  return response.data;
};

export const resincronizarDatos = async () => {
  const response = await api.post('/fintoc/resync');
  return response.data;
};

// ===== CONEXIONES BANCARIAS =====
export const obtenerConexiones = async () => {
  const response = await api.get('/fintoc/links');
  return response.data;
};

export const eliminarConexion = async (linkId) => {
  const response = await api.delete(`/fintoc/links/${linkId}`);
  return response.data;
};

// ===== CRÉDITOS =====
export const obtenerResumenCreditos = async () => {
  const response = await api.get('/creditos/resumen');
  return response.data;
};

export const obtenerProyeccionFlujo = async () => {
  const response = await api.get('/creditos/proyeccion');
  return response.data;
};

export const obtenerCreditosPendientes = async () => {
  const response = await api.get('/creditos/pendientes');
  return response.data;
};

export const obtenerCreditos = async (estado) => {
  const params = estado ? { estado } : {};
  const response = await api.get('/creditos', { params });
  return response.data;
};

export const crearCredito = async (datos) => {
  const response = await api.post('/creditos', datos);
  return response.data;
};

export const actualizarCredito = async (id, datos) => {
  const response = await api.put(`/creditos/${id}`, datos);
  return response.data;
};

export const eliminarCredito = async (id) => {
  const response = await api.delete(`/creditos/${id}`);
  return response.data;
};

// ===== PAGOS DE CRÉDITOS (detección automática) =====
export const obtenerPagosSinVincular = async () => {
  const response = await api.get('/creditos/pagos-sin-vincular');
  return response.data;
};

export const obtenerPagosDetectados = async (creditoId) => {
  const response = await api.get(`/creditos/${creditoId}/pagos-detectados`);
  return response.data;
};

export const confirmarPagoCredito = async (creditoId, movimientoId) => {
  const response = await api.post(`/creditos/${creditoId}/confirmar-pago`, { movimientoId });
  return response.data;
};

export const desvincularPagoCredito = async (creditoId, movimientoId) => {
  const response = await api.post(`/creditos/${creditoId}/desvincular-pago`, { movimientoId });
  return response.data;
};

export const obtenerTransaccionesCredito = async (creditoId) => {
  const response = await api.get(`/creditos/${creditoId}/transacciones`);
  return response.data;
};

// ===== OBLIGACIONES FINANCIERAS =====
export const obtenerResumenObligaciones = async () => {
  const response = await api.get('/obligaciones/resumen');
  return response.data;
};

export const obtenerIngresos = async () => {
  const response = await api.get('/obligaciones/ingresos');
  return response.data;
};

export const crearIngreso = async (datos) => {
  const response = await api.post('/obligaciones/ingresos', datos);
  return response.data;
};

export const actualizarIngreso = async (id, datos) => {
  const response = await api.put(`/obligaciones/ingresos/${id}`, datos);
  return response.data;
};

export const eliminarIngreso = async (id) => {
  const response = await api.delete(`/obligaciones/ingresos/${id}`);
  return response.data;
};

export const obtenerCostosFijos = async () => {
  const response = await api.get('/obligaciones/costos');
  return response.data;
};

export const crearCostoFijo = async (datos) => {
  const response = await api.post('/obligaciones/costos', datos);
  return response.data;
};

export const actualizarCostoFijo = async (id, datos) => {
  const response = await api.put(`/obligaciones/costos/${id}`, datos);
  return response.data;
};

export const eliminarCostoFijo = async (id) => {
  const response = await api.delete(`/obligaciones/costos/${id}`);
  return response.data;
};

export const obtenerDeudas = async () => {
  const response = await api.get('/obligaciones/deudas');
  return response.data;
};

export const crearDeuda = async (datos) => {
  const response = await api.post('/obligaciones/deudas', datos);
  return response.data;
};

export const actualizarDeuda = async (id, datos) => {
  const response = await api.put(`/obligaciones/deudas/${id}`, datos);
  return response.data;
};

export const eliminarDeuda = async (id) => {
  const response = await api.delete(`/obligaciones/deudas/${id}`);
  return response.data;
};

export const obtenerTablaAmortizacion = async (id) => {
  const response = await api.get(`/obligaciones/deudas/${id}/amortizacion`);
  return response.data;
};

export const obtenerProgresoMensual = async (mes) => {
  const params = mes ? { mes } : {};
  const response = await api.get('/obligaciones/progreso-mensual', { params });
  return response.data;
};

// ===== MOVIMIENTOS (ASIGNACIÓN) =====
export const obtenerMovimientosSinAsignar = async (mes) => {
  const params = mes ? { mes } : {};
  const response = await api.get('/movimientos/sin-asignar', { params });
  return response.data;
};

export const asignarMovimiento = async (id, tipo, referenciaId) => {
  const response = await api.put(`/movimientos/${id}/asignar`, { tipo, referenciaId });
  return response.data;
};

export const desasignarMovimiento = async (id) => {
  const response = await api.put(`/movimientos/${id}/desasignar`);
  return response.data;
};

// ===== ESTADO FINANCIERO =====
export const obtenerEstadoFinanciero = async (mes) => {
  const params = mes ? { mes } : {};
  const response = await api.get('/estado', { params });
  return response.data;
};

export default api;
