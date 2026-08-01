import { api, getToken } from './api.js';

const KEY = 'aurex_watchlist';
let cache = null;

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLocal(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function getWatchlist() {
  if (getToken() && cache) return [...cache];
  return readLocal();
}

export async function initWatchlist() {
  if (!getToken()) {
    cache = null;
    return readLocal();
  }
  try {
    const { coin_ids } = await api.getWatchlist();
    cache = coin_ids;
    return coin_ids;
  } catch {
    cache = readLocal();
    return cache;
  }
}

export async function syncWatchlistOnLogin() {
  const local = readLocal();
  if (!getToken()) return local;
  try {
    const { coin_ids } = local.length
      ? await api.syncWatchlist(local)
      : await api.getWatchlist();
    cache = coin_ids;
    if (local.length) localStorage.removeItem(KEY);
    return coin_ids;
  } catch {
    return initWatchlist();
  }
}

export function isWatchlisted(coinId) {
  return getWatchlist().includes(coinId);
}

export async function toggleWatchlist(coinId) {
  if (getToken()) {
    const { watchlisted, coin_ids } = await api.toggleWatchlist(coinId);
    cache = coin_ids;
    return watchlisted;
  }

  const list = readLocal();
  const idx = list.indexOf(coinId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(coinId);
  writeLocal(list);
  return list.includes(coinId);
}

export function removeFromWatchlist(coinId) {
  if (getToken() && cache) {
    cache = cache.filter((id) => id !== coinId);
    api.removeFromWatchlist(coinId).catch(() => {});
    return;
  }
  writeLocal(readLocal().filter((id) => id !== coinId));
}

export function clearWatchlistCache() {
  cache = null;
}
