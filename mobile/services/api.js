import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getItem, deleteItem } from '../utils/storage';

const API_URL = 'https://finviapp.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Callback para notificar al AuthContext cuando hay 401
let _onUnauthorized = null;
export const setOnUnauthorized = (cb) => { _onUnauthorized = cb; };

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
      if (_onUnauthorized) _onUnauthorized();
    }
    return Promise.reject(error);
  }
);

// ============ AUTH ============
export const registrarUsuario = (datos) => api.post('/auth/registro', datos);
export const loginUsuario = (datos) => api.post('/auth/login', datos);
export const obtenerUsuarioActual = () => api.get('/auth/me');
export const solicitarRecuperacion = (datos) => api.post('/auth/forgot-password', datos);
export const restablecerPassword = (datos) => api.post('/auth/reset-password', datos);

// ============ FINTOC / CUENTAS ============
export const crearLinkIntent = () => api.post('/fintoc/link-intent');
export const intercambiarToken = (exchangeToken) => api.post('/fintoc/exchange', { exchangeToken });
export const obtenerCuentas = () => api.get('/fintoc/accounts');
export const obtenerMovimientos = (accountId, limite = 500) => api.get(`/fintoc/accounts/${accountId}/movements`, { params: { limit: limite } });
export const obtenerConexiones = () => api.get('/fintoc/links');
export const eliminarConexion = (linkId) => api.delete(`/fintoc/links/${linkId}`);
export const refrescarDatos = () => api.post('/fintoc/refresh');
export const resincronizarDatos = () => api.post('/fintoc/resync');
export const obtenerSyncStatus = () => api.get('/fintoc/sync-status');

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
export const obtenerSinAsignarAgrupados = (mes) => api.get('/movimientos/sin-asignar-agrupados', { params: mes ? { mes } : {} });
export const autoAsignarMovimientos = (mes, modo) => api.post('/movimientos/auto-asignar', { mes, modo });
export const asignarMovimiento = (id, tipo, referenciaId) => api.put(`/movimientos/${id}/asignar`, { tipo, referenciaId });
export const desasignarMovimiento = (id) => api.put(`/movimientos/${id}/desasignar`);

// ============ ESTADO FINANCIERO ============
export const obtenerEstadoFinanciero = (mes) => api.get('/estado', { params: mes ? { mes } : {} });
export const obtenerCategoriasDisponibles = () => api.get('/estado/categorias');
export const categorizarMovimiento = (descripcion, categoria) => api.post('/estado/categorizar', { descripcion, categoria });

// ============ NOTIFICACIONES ============
export const registrarTokenPush = (token, platform) => api.post('/notifications/register-token', { token, platform });
export const obtenerNotificaciones = () => api.get('/notifications');
export const marcarNotificacionLeida = (id) => api.put(`/notifications/${id}/read`);

// ============ CONFIGURACIÓN / PERFIL ============
export const actualizarPerfil = (datos) => api.put('/auth/perfil', datos);
export const cambiarPassword = (datos) => api.put('/auth/password', datos);
export const eliminarCuentaAPI = (password) => api.delete('/auth/cuenta', { data: { password } });

// ============ SUSCRIPCIÓN ============
export const obtenerEstadoSuscripcion = () => api.get('/suscripcion/estado');
export const vincularRevenueCat = (revenuecatId) => api.post('/suscripcion/vincular', { revenuecatId });

export default api;
