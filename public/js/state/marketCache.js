/** Client-side GET cache + in-flight deduplication (Phase 11). */
const store = new Map();
const inflight = new Map();

export const CACHE_TTL = {
  dashboard: 50_000,
  global: 50_000,
  globalChart: 120_000,
  trending: 90_000,
  gainers: 55_000,
  losers: 55_000,
  markets: 50_000,
  marketsByIds: 50_000,
  coin: 90_000,
  chart: 120_000,
  search: 25_000,
  news: 120_000,
  ads: 300_000,
  userDashboard: 45_000,
};

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > entry.ttl) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet(key, data, ttl) {
  store.set(key, { data, time: Date.now(), ttl });
}

export function cacheClear() {
  store.clear();
  inflight.clear();
}

export function invalidateMarketCache(prefix = '') {
  if (!prefix) {
    inflight.clear();
    for (const key of [...store.keys()]) {
      if (key.startsWith('GET /')) store.delete(key);
    }
    return;
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Dedupe concurrent identical GETs and serve fresh-enough cached JSON.
 */
export async function cachedFetch(key, fetcher, ttl = 30_000) {
  const cached = cacheGet(key);
  if (cached !== null) return cached;

  if (inflight.has(key)) return inflight.get(key);

  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      cacheSet(key, data, ttl);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function cacheKeyFor(path) {
  return `GET ${path}`;
}
