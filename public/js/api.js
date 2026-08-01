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

  const res = await fetch(`${API}${path}`, { credentials: 'include', ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) {
    const retry = data.retryAfter ? ` Try again in ${data.retryAfter}s.` : '';
    throw new Error((data.error || 'Too many requests') + retry);
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: ({ firstName, lastName, email, password, confirmPassword }) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, email, password, confirmPassword }),
    }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  verifyEmail: (token) =>
    request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  resendVerification: () => request('/auth/verify-email/resend', { method: 'POST' }),
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: ({ token, password, confirmPassword }) =>
    request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password, confirmPassword }),
    }),

  getMarketDashboard: () => request('/market/dashboard'),
  getUserDashboard: () => request('/dashboard/user'),
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
  getTransactions: (limit = 100) => request(`/transactions?limit=${limit}`),
  trade: (payload) => request('/trade', { method: 'POST', body: JSON.stringify(payload) }),

  getWatchlist: () => request('/watchlist'),
  syncWatchlist: (coinIds) =>
    request('/watchlist/sync', { method: 'POST', body: JSON.stringify({ coinIds }) }),
  toggleWatchlist: (coinId) =>
    request('/watchlist/toggle', { method: 'POST', body: JSON.stringify({ coinId }) }),
  removeFromWatchlist: (coinId) => request(`/watchlist/${encodeURIComponent(coinId)}`, { method: 'DELETE' }),
};
