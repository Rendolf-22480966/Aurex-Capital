const BASE_URL = process.env.COINGECKO_API_BASE || 'https://api.coingecko.com/api/v3';
const API_KEY = process.env.COINGECKO_API_KEY || '';

const cache = new Map();
const inflight = new Map();

const TTL = {
  markets: 60_000,
  global: 60_000,
  trending: 120_000,
  movers: 90_000,
  chart: 300_000,
  coin: 120_000,
  search: 120_000,
  price: 45_000,
};

const MIN_INTERVAL = API_KEY ? 500 : 2500;
let lastRequestTime = 0;
let requestQueue = Promise.resolve();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildHeaders() {
  const headers = { Accept: 'application/json' };
  if (API_KEY) headers['x-cg-demo-api-key'] = API_KEY;
  return headers;
}

function cacheKey(path, params) {
  return `${path}?${JSON.stringify(params)}`;
}

function getCached(key) {
  return cache.get(key) || null;
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
}

function getCacheMeta(key) {
  const entry = cache.get(key);
  if (!entry) return { cachedAt: null, stale: false };
  return { cachedAt: new Date(entry.time).toISOString(), stale: false };
}

function enqueue(fn) {
  const run = requestQueue.then(fn, fn);
  requestQueue = run.catch(() => {});
  return run;
}

async function coingeckoFetch(path, params = {}, ttl = 60_000) {
  const key = cacheKey(path, params);
  const cached = getCached(key);

  if (cached && Date.now() - cached.time < ttl) {
    return { data: cached.data, meta: { ...getCacheMeta(key), fromCache: true } };
  }

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = enqueue(async () => {
    const stale = cached?.data ?? null;

    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = MIN_INTERVAL - (Date.now() - lastRequestTime);
      if (wait > 0) await sleep(wait);

      const url = new URL(`${BASE_URL}${path}`);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
      });

      lastRequestTime = Date.now();
      const response = await fetch(url, { headers: buildHeaders() });

      if (response.status === 429) {
        const retrySec = parseInt(response.headers.get('retry-after') || '0', 10);
        const backoff = retrySec > 0 ? retrySec * 1000 : (attempt + 1) * 8000;
        console.warn(`CoinGecko 429 — wait ${Math.round(backoff / 1000)}s`);
        if (stale) {
          return {
            data: stale,
            meta: { cachedAt: cached ? new Date(cached.time).toISOString() : null, stale: true, fromCache: true },
          };
        }
        await sleep(backoff);
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        if (stale) {
          return {
            data: stale,
            meta: { cachedAt: cached ? new Date(cached.time).toISOString() : null, stale: true, fromCache: true },
          };
        }
        throw new Error(`CoinGecko error ${response.status}: ${text.slice(0, 200)}`);
      }

      const data = await response.json();
      setCache(key, data);
      return { data, meta: { cachedAt: new Date().toISOString(), stale: false, fromCache: false } };
    }

    if (stale) {
      return {
        data: stale,
        meta: { cachedAt: cached ? new Date(cached.time).toISOString() : null, stale: true, fromCache: true },
      };
    }
    throw new Error('CoinGecko rate limit exceeded — try again shortly');
  });

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

async function getMarkets({ page = 1, perPage = 50, order = 'market_cap_desc', ids = null } = {}) {
  const params = {
    vs_currency: 'usd',
    order,
    per_page: Math.min(perPage, 250),
    page,
    sparkline: false,
    price_change_percentage: '24h',
  };
  if (ids?.length) {
    params.ids = ids.join(',');
    params.per_page = ids.length;
    params.page = 1;
  }
  const { data, meta } = await coingeckoFetch('/coins/markets', params, TTL.markets);
  return { coins: data, meta };
}

async function getGlobal() {
  const { data, meta } = await coingeckoFetch('/global', {}, TTL.global);
  return { global: data.data, meta };
}

async function getTrending() {
  const { data, meta } = await coingeckoFetch('/search/trending', {}, TTL.trending);
  return { trending: data, meta };
}

async function getGainers(perPage = 20) {
  return getMarkets({ page: 1, perPage, order: 'price_change_percentage_24h_desc' });
}

async function getLosers(perPage = 20) {
  return getMarkets({ page: 1, perPage, order: 'price_change_percentage_24h_asc' });
}

async function getCoin(id) {
  const { data, meta } = await coingeckoFetch(
    `/coins/${id}`,
    {
      localization: false,
      tickers: false,
      market_data: true,
      community_data: true,
      developer_data: false,
    },
    TTL.coin
  );
  return { coin: data, meta };
}

async function getMarketChart(id, days = 1) {
  const { data, meta } = await coingeckoFetch(
    `/coins/${id}/market_chart`,
    { vs_currency: 'usd', days: days === 'max' ? 'max' : days },
    TTL.chart
  );
  return { chart: data, meta };
}

async function getSimplePrices(ids) {
  const idList = Array.isArray(ids) ? ids.join(',') : ids;
  const { data } = await coingeckoFetch(
    '/simple/price',
    { ids: idList, vs_currencies: 'usd', include_24hr_change: true },
    TTL.price
  );
  return data;
}

async function searchCoins(query) {
  const { data, meta } = await coingeckoFetch('/search', { query }, TTL.search);
  return { results: data, meta };
}

async function getDashboardBundle() {
  const [globalRes, trendingRes, gainersRes, losersRes] = await Promise.all([
    getGlobal(),
    getTrending(),
    getGainers(10),
    getLosers(10),
  ]);
  return {
    global: globalRes.global,
    trending: trendingRes.trending,
    gainers: gainersRes.coins,
    losers: losersRes.coins,
    meta: {
      global: globalRes.meta,
      trending: trendingRes.meta,
      gainers: gainersRes.meta,
      losers: losersRes.meta,
    },
  };
}

module.exports = {
  getMarkets,
  getGlobal,
  getTrending,
  getGainers,
  getLosers,
  getCoin,
  getMarketChart,
  getSimplePrices,
  searchCoins,
  getDashboardBundle,
};
