const axios = require('axios');

const FINTOC_BASE_URL = 'https://api.fintoc.com/v1';

const fintocApi = axios.create({
  baseURL: FINTOC_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // 30s por request para evitar cuelgues
});

fintocApi.interceptors.request.use((config) => {
  config.headers.Authorization = process.env.FINTOC_SECRET_KEY;
  return config;
});

const createLinkIntent = async () => {
  const response = await fintocApi.post('/link_intents', {
    product: 'movements',
    country: 'cl',
    holder_type: 'individual',
  });
  return response.data;
};

const exchangeToken = async (exchangeToken) => {
  const response = await fintocApi.get('/links/exchange', {
    params: { exchange_token: exchangeToken },
  });
  return response.data;
};

const getAccounts = async (linkToken) => {
  const response = await fintocApi.get('/accounts', {
    params: { link_token: linkToken },
  });
  return response.data;
};

const getAccount = async (accountId, linkToken) => {
  const response = await fintocApi.get(`/accounts/${accountId}`, {
    params: { link_token: linkToken },
  });
  return response.data;
};

const getMovements = async (accountId, linkToken, params = {}) => {
  const allMovements = [];
  let page = 1;
  const perPage = 100;
  const maxMovements = 50000; // Sin límite práctico: obtener todo el historial
  const maxPages = 500; // Suficiente para historial completo

  while (allMovements.length < maxMovements && page <= maxPages) {
    try {
      const response = await fintocApi.get(`/accounts/${accountId}/movements`, {
        params: { link_token: linkToken, per_page: perPage, page, ...params },
        timeout: 15000, // 15s por página de movimientos
      });
      const data = response.data;
      if (!Array.isArray(data) || data.length === 0) break;
      allMovements.push(...data);
      if (data.length < perPage) break;
      page++;
    } catch (err) {
      // Si falla una página, devolver lo que se tiene hasta ahora
      console.warn(`Página ${page} de movimientos falló para cuenta ${accountId}:`, err.message);
      break;
    }
  }

  return allMovements.slice(0, maxMovements);
};

const deleteLink = async (linkToken) => {
  const response = await fintocApi.delete('/links', {
    params: { link_token: linkToken },
  });
  return response.data;
};

module.exports = {
  createLinkIntent,
  exchangeToken,
  getAccounts,
  getAccount,
  getMovements,
  deleteLink,
};
