import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

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

// ===== FLUJO DE CAJA =====
export const obtenerAnalisisFlujo = async () => {
  const response = await api.get('/flujo/analisis');
  return response.data;
};

export const obtenerProyeccionFlujoCompleta = async (meses = 12) => {
  const response = await api.get('/flujo/proyeccion', { params: { meses } });
  return response.data;
};

export const actualizarCategoriaFlujo = async (id, datos) => {
  const response = await api.put(`/flujo/categorias/${id}`, datos);
  return response.data;
};

export const crearCategoriaFlujo = async (datos) => {
  const response = await api.post('/flujo/categorias', datos);
  return response.data;
};

export const eliminarCategoriaFlujo = async (id) => {
  const response = await api.delete(`/flujo/categorias/${id}`);
  return response.data;
};

export const reanalizarFlujo = async () => {
  const response = await api.post('/flujo/reanalizar');
  return response.data;
};

export default api;
