import { getToken, setToken } from './api.js';

const API = '/api';

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { credentials: 'include', ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const adminApi = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  users: () => request('/admin/users'),
  audit: (limit = 100, action = null) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (action) params.set('action', action);
    return request(`/admin/audit?${params}`);
  },
  auditVerify: () => request('/admin/audit/verify'),
  auditDetail: (sequenceNum) => request(`/admin/audit/${sequenceNum}`),
  deposit: (userId, amount, note) =>
    request(`/admin/users/${userId}/deposit`, { method: 'POST', body: JSON.stringify({ amount, note }) }),
  withdraw: (userId, amount, note) =>
    request(`/admin/users/${userId}/withdraw`, { method: 'POST', body: JSON.stringify({ amount, note }) }),
  creditCrypto: (userId, payload) =>
    request(`/admin/users/${userId}/credit-crypto`, { method: 'POST', body: JSON.stringify(payload) }),
  reset: (userId) => request(`/admin/reset/${userId}`, { method: 'POST' }),
  userDetail: (userId) => request(`/admin/users/${userId}`),
  suspend: (userId, reason) =>
    request(`/admin/users/${userId}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  activate: (userId) => request(`/admin/users/${userId}/activate`, { method: 'POST' }),
  deleteUser: (userId, reason) =>
    request(`/admin/users/${userId}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
};
