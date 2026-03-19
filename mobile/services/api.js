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
export const crearLinkIntent = () => api.post('/fintoc/link-intent');
export const intercambiarToken = (exchangeToken) => api.post('/fintoc/exchange', { exchangeToken });
export const obtenerCuentas = () => api.get('/fintoc/accounts');
export const obtenerMovimientos = (accountId) => api.get(`/fintoc/accounts/${accountId}/movements`);
export const obtenerConexiones = () => api.get('/fintoc/links');
export const refrescarDatos = () => api.post('/fintoc/refresh');
export const resincronizarDatos = () => api.post('/fintoc/resync');

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
export const obtenerCategoriasDisponibles = () => api.get('/estado/categorias');
export const categorizarMovimiento = (descripcion, categoria) => api.post('/estado/categorizar', { descripcion, categoria });

// ============ NOTIFICACIONES ============
export const registrarPushToken = (token) => api.post('/notifications/register-token', { token });
export const obtenerNotificaciones = () => api.get('/notifications');
export const marcarNotificacionLeida = (id) => api.put(`/notifications/${id}/read`);

// ============ CONFIGURACIÓN / PERFIL ============
export const actualizarPerfil = (datos) => api.put('/auth/perfil', datos);
export const cambiarPassword = (datos) => api.put('/auth/password', datos);
export const eliminarCuentaAPI = (password) => api.delete('/auth/cuenta', { data: { password } });

export default api;
