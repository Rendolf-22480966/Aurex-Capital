import { getToken, setToken } from './apiCore.js';
import { cachedFetch, cacheKeyFor, CACHE_TTL, invalidateMarketCache } from './state/marketCache.js';

export { getToken, setToken, invalidateMarketCache };

async function cachedGet(path, ttl) {
  return cachedFetch(cacheKeyFor(path), () => rawRequest(path), ttl);
}

async function rawRequest(path, options = {}, attempt = 0) {
  const API = '/api';
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const timeoutMs = options.timeoutMs ?? 25_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${API}${path}`, {
      credentials: 'include',
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — the server may be waking up. Please refresh.');
    }
    throw err;
  }
  clearTimeout(timer);

  const data = await res.json().catch(() => ({}));
  if (res.status === 503 && attempt < 4) {
    const wait = (data.retryAfter || 2) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return rawRequest(path, options, attempt + 1);
  }
  if (res.status === 429) {
    const retry = data.retryAfter ? ` Try again in ${data.retryAfter}s.` : '';
    throw new Error((data.error || 'Too many requests') + retry);
  }
  if (!res.ok) {
    if (res.status === 401 && attempt === 0 && path !== '/auth/login') {
      setToken(null);
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

async function request(path, options = {}) {
  return rawRequest(path, options);
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

  getMarketDashboard: () => cachedGet('/market/dashboard', CACHE_TTL.dashboard),
  getUserDashboard: () => cachedGet('/dashboard/user', CACHE_TTL.userDashboard),
  refreshUserDashboard: () => {
    invalidateMarketCache('GET /dashboard/user');
    return rawRequest('/dashboard/user', {}, 0);
  },
  getGlobal: () => cachedGet('/market/global', CACHE_TTL.global),
  getGlobalChart: (days = 7) =>
    cachedGet(`/market/global-chart?days=${days}`, CACHE_TTL.globalChart),
  getHealth: () => request('/health'),
  getTrending: () => cachedGet('/market/trending', CACHE_TTL.trending),
  getGainers: (perPage = 20) =>
    cachedGet(`/market/gainers?per_page=${perPage}`, CACHE_TTL.gainers),
  getLosers: (perPage = 20) =>
    cachedGet(`/market/losers?per_page=${perPage}`, CACHE_TTL.losers),
  getMarkets: (page = 1, perPage = 50, sort = 'market_cap') =>
    cachedGet(
      `/market/coins?page=${page}&per_page=${perPage}&sort=${sort}`,
      CACHE_TTL.markets
    ),
  getMarketsByIds: (ids) => {
    const sorted = [...ids].sort().join(',');
    return cachedGet(
      `/market/coins?ids=${sorted}&per_page=${ids.length}`,
      CACHE_TTL.marketsByIds
    );
  },
  getCoin: (id) => cachedGet(`/market/coin/${encodeURIComponent(id)}`, CACHE_TTL.coin),
  getChart: (id, days) =>
    cachedGet(`/market/chart/${encodeURIComponent(id)}?days=${days}`, CACHE_TTL.chart),
  search: (q) => {
    const trimmed = q.trim();
    if (!trimmed) return Promise.resolve({ results: {} });
    return cachedGet(
      `/market/search?q=${encodeURIComponent(trimmed)}`,
      CACHE_TTL.search
    );
  },

  getNews: async (page = 1, limit = 20) => {
    const path = `/news?page=${page}&limit=${limit}`;
    const data = await cachedGet(path, CACHE_TTL.news);
    if (!data.configured) {
      invalidateMarketCache(`GET ${path}`);
      return rawRequest(path);
    }
    return data;
  },
  getAdSlots: async (slotId) => {
    const path = slotId
      ? `/advertising/slots?slot=${encodeURIComponent(slotId)}`
      : '/advertising/slots';
    const data = await cachedGet(path, CACHE_TTL.ads);
    const pool = data.slots?.overview_leaderboard?.creatives;
    const stale = !data.configured || !Array.isArray(pool) || pool.length === 0;
    if (stale) {
      invalidateMarketCache(`GET ${path}`);
      const fresh = await rawRequest(path);
      const freshPool = fresh.slots?.overview_leaderboard?.creatives;
      if (Array.isArray(freshPool) && freshPool.length > 0) return fresh;
      invalidateMarketCache(`GET ${path}`);
      return fresh;
    }
    return data;
  },

  getPortfolio: () => request('/portfolio'),
  getTransactions: (limit = 100) => request(`/transactions?limit=${limit}`),
  trade: async (payload) => {
    const result = await request('/trade', { method: 'POST', body: JSON.stringify(payload) });
    invalidateMarketCache('GET /dashboard');
    invalidateMarketCache('GET /dashboard/user');
    return result;
  },

  getWatchlist: () => request('/watchlist'),
  syncWatchlist: (coinIds) =>
    request('/watchlist/sync', { method: 'POST', body: JSON.stringify({ coinIds }) }),
  toggleWatchlist: (coinId) =>
    request('/watchlist/toggle', { method: 'POST', body: JSON.stringify({ coinId }) }),
  removeFromWatchlist: (coinId) =>
    request(`/watchlist/${encodeURIComponent(coinId)}`, { method: 'DELETE' }),
};
