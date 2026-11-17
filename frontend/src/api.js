import { expireSession } from './utils/session.js';

const BASE_URL = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = path.startsWith('/auth/') ? null : getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401) expireSession(token);
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error || `Request failed with status ${res.status}`);
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  signup: (email, password) =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getCategories: () => request('/categories'),
  createCategory: (name) =>
    request('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  getTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/transactions${query ? `?${query}` : ''}`);
  },
  createTransaction: (data) =>
    request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id, data) =>
    request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  getSummary: () => request('/transactions/meta/summary'),
  getMe: () => request('/users/me'),
  updateHomeCurrency: (homeCurrency) =>
    request('/users/me', { method: 'PUT', body: JSON.stringify({ homeCurrency }) }),
  getBudgets: (month) => request(`/budgets${month ? `?month=${month}` : ''}`),
  saveBudget: (categoryId, month, amount, currency) =>
    request('/budgets', {
      method: 'POST',
      body: JSON.stringify({ categoryId, month, amount, currency }),
    }),
  deleteBudget: (id) => request(`/budgets/${id}`, { method: 'DELETE' }),
};
