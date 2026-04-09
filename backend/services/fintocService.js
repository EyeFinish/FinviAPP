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
    let intentos = 0;
    let paginaCompletada = false;

    while (intentos < 2 && !paginaCompletada) {
      try {
        const response = await fintocApi.get(`/accounts/${accountId}/movements`, {
          params: { link_token: linkToken, per_page: perPage, page, ...params },
          timeout: 20000, // 20s por página (aumentado para bancos lentos)
        });
        const data = response.data;

        // Respuesta vacía o no-array = fin legítimo del historial
        if (!Array.isArray(data) || data.length === 0) {
          return allMovements.slice(0, maxMovements);
        }

        allMovements.push(...data);
        paginaCompletada = true;

        // Última página: devolvemos lo que tenemos
        if (data.length < perPage) {
          return allMovements.slice(0, maxMovements);
        }

        page++;
      } catch (err) {
        // Error de autenticación: token inválido o revocado — propagar inmediatamente
        // No reintentar ni saltar: el caller (syncScheduler/refresh) debe clasificarlo y marcar el link
        if (err.response?.status === 401 || err.response?.status === 403) {
          console.error(`[Fintoc] Token inválido/revocado (${err.response.status}) para cuenta ${accountId} — propagando error`);
          throw err;
        }

        intentos++;
        console.warn(`[Fintoc] Página ${page} falló (intento ${intentos}/2) para cuenta ${accountId}: ${err.message}`);

        if (intentos >= 2) {
          // Después de 2 intentos fallidos por error transitorio (timeout, 5xx), saltar esta página
          console.warn(`[Fintoc] Saltando página ${page} y continuando paginación...`);
          page++;
          paginaCompletada = true;
        }
        // Si intentos < 2, reintenta inmediatamente (siguiente iteración del while interno)
      }
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
