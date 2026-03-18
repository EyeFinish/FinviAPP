import axios from 'axios';
import { getItem, deleteItem } from '../utils/storage';

// Para dispositivo físico en la misma red WiFi:
const API_URL = 'http://192.168.0.10:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: agregar JWT a cada request
api.interceptors.request.use(async (config) => {
  const token = await getItem('finvi_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: manejar 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await deleteItem('finvi_token');
      await deleteItem('finvi_user');
    }
    return Promise.reject(error);
  }
);

// ============ AUTH ============
export const registrarUsuario = (datos) => api.post('/auth/registro', datos);
export const loginUsuario = (datos) => api.post('/auth/login', datos);
export const obtenerUsuarioActual = () => api.get('/auth/me');

// ============ FINTOC / CUENTAS ============
export const obtenerCuentas = () => api.get('/fintoc/accounts');
export const obtenerMovimientos = (accountId) => api.get(`/fintoc/accounts/${accountId}/movements`);
export const obtenerConexiones = () => api.get('/fintoc/links');
export const refrescarDatos = () => api.post('/fintoc/refresh');
export const resincronizarDatos = () => api.post('/fintoc/resync');

// ============ CRÉDITOS ============
export const obtenerResumenCreditos = () => api.get('/creditos/resumen');
export const obtenerProyeccionCreditos = () => api.get('/creditos/proyeccion');
export const obtenerCreditosPendientes = () => api.get('/creditos/pendientes');
export const obtenerCreditos = (estado) => api.get('/creditos', { params: estado ? { estado } : {} });
export const crearCredito = (datos) => api.post('/creditos', datos);
export const actualizarCredito = (id, datos) => api.put(`/creditos/${id}`, datos);
export const eliminarCredito = (id) => api.delete(`/creditos/${id}`);

// ============ PAGOS DE CRÉDITOS (detección automática) ============
export const obtenerPagosSinVincular = () => api.get('/creditos/pagos-sin-vincular');
export const obtenerPagosDetectados = (creditoId) => api.get(`/creditos/${creditoId}/pagos-detectados`);
export const confirmarPagoCredito = (creditoId, movimientoId) => api.post(`/creditos/${creditoId}/confirmar-pago`, { movimientoId });
export const desvincularPagoCredito = (creditoId, movimientoId) => api.post(`/creditos/${creditoId}/desvincular-pago`, { movimientoId });
export const obtenerTransaccionesCredito = (creditoId) => api.get(`/creditos/${creditoId}/transacciones`);
// ============ OBLIGACIONES FINANCIERAS ============
export const obtenerResumenObligaciones = () => api.get('/obligaciones/resumen');
export const obtenerIngresos = () => api.get('/obligaciones/ingresos');
export const crearIngreso = (datos) => api.post('/obligaciones/ingresos', datos);
export const actualizarIngreso = (id, datos) => api.put(`/obligaciones/ingresos/${id}`, datos);
export const eliminarIngreso = (id) => api.delete(`/obligaciones/ingresos/${id}`);
export const obtenerCostosFijos = () => api.get('/obligaciones/costos');
export const crearCostoFijo = (datos) => api.post('/obligaciones/costos', datos);
export const actualizarCostoFijo = (id, datos) => api.put(`/obligaciones/costos/${id}`, datos);
export const eliminarCostoFijo = (id) => api.delete(`/obligaciones/costos/${id}`);
export const obtenerDeudas = () => api.get('/obligaciones/deudas');
export const crearDeuda = (datos) => api.post('/obligaciones/deudas', datos);
export const actualizarDeuda = (id, datos) => api.put(`/obligaciones/deudas/${id}`, datos);
export const eliminarDeuda = (id) => api.delete(`/obligaciones/deudas/${id}`);
export const obtenerTablaAmortizacion = (id) => api.get(`/obligaciones/deudas/${id}/amortizacion`);
export const obtenerProgresoMensual = (mes) => api.get('/obligaciones/progreso-mensual', { params: mes ? { mes } : {} });

// ============ MOVIMIENTOS (ASIGNACIÓN) ============
export const obtenerMovimientosSinAsignar = (mes) => api.get('/movimientos/sin-asignar', { params: mes ? { mes } : {} });
export const asignarMovimiento = (id, tipo, referenciaId) => api.put(`/movimientos/${id}/asignar`, { tipo, referenciaId });
export const desasignarMovimiento = (id) => api.put(`/movimientos/${id}/desasignar`);

// ============ ESTADO FINANCIERO ============
export const obtenerEstadoFinanciero = (mes) => api.get('/estado', { params: mes ? { mes } : {} });

// ============ NOTIFICACIONES ============
export const registrarPushToken = (token) => api.post('/notifications/register-token', { token });
export const obtenerNotificaciones = () => api.get('/notifications');
export const marcarNotificacionLeida = (id) => api.put(`/notifications/${id}/read`);

export default api;
