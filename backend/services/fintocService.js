const axios = require('axios');

const FINTOC_BASE_URL = 'https://api.fintoc.com/v1';

const fintocApi = axios.create({
  baseURL: FINTOC_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
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
  const response = await fintocApi.get(`/accounts/${accountId}/movements`, {
    params: { link_token: linkToken, per_page: 30, ...params },
  });
  return response.data;
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
