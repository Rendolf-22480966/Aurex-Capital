const API = '/api';

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (username, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),

  getDashboard: () => request('/market/dashboard'),
  getGlobal: () => request('/market/global'),
  getHealth: () => request('/health'),
  getTrending: () => request('/market/trending'),
  getGainers: (perPage = 20) => request(`/market/gainers?per_page=${perPage}`),
  getLosers: (perPage = 20) => request(`/market/losers?per_page=${perPage}`),
  getMarkets: (page = 1, perPage = 50, sort = 'market_cap') =>
    request(`/market/coins?page=${page}&per_page=${perPage}&sort=${sort}`),
  getMarketsByIds: (ids) =>
    request(`/market/coins?ids=${ids.join(',')}&per_page=${ids.length}`),
  getCoin: (id) => request(`/market/coin/${id}`),
  getChart: (id, days) => request(`/market/chart/${id}?days=${days}`),
  search: (q) => request(`/market/search?q=${encodeURIComponent(q)}`),

  getPortfolio: () => request('/portfolio'),
  trade: (payload) => request('/trade', { method: 'POST', body: JSON.stringify(payload) }),
  adminUsers: () => request('/admin/users'),
  adminReset: (userId) => request(`/admin/reset/${userId}`, { method: 'POST' }),
};
