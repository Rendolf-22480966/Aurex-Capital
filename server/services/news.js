/**
 * News feed — live RSS by default (no API key). Optional CryptoCompare / CoinGecko with keys.
 */

const rssNews = require('./rssNews');

const NEWS_PROVIDER = (process.env.NEWS_PROVIDER || 'rss').trim().toLowerCase();
const NEWS_API_KEY = (process.env.NEWS_API_KEY || '').trim();
const COINGECKO_API_KEY = (process.env.COINGECKO_API_KEY || '').trim();

function isConfigured() {
  if (NEWS_PROVIDER === 'rss') return true;
  return Boolean(NEWS_API_KEY);
}

function normalizeArticle(raw, defaults = {}) {
  return {
    id: raw.id || raw.ID || raw.url,
    title: raw.title || raw.TITLE || '',
    url: raw.url || raw.URL || raw.guid,
    summary: raw.summary || raw.body || raw.BODY || raw.description || '',
    image_url: raw.image_url || raw.image || raw.IMAGE_URL || null,
    source: raw.source || raw.source_name || raw.SOURCE_DATA?.NAME || defaults.source || 'News',
    published_at: raw.published_at || raw.posted_at || (raw.PUBLISHED_ON ? new Date(raw.PUBLISHED_ON * 1000).toISOString() : null),
    tags: raw.tags || raw.KEYWORDS?.split('|').filter(Boolean) || [],
    coins: raw.coins || raw.related_coin_ids || [],
  };
}

async function fetchCryptoCompare({ page, limit }) {
  const base = 'https://min-api.cryptocompare.com/data/v2/news/';
  const url = `${base}?lang=EN&limit=${Math.min(limit * page, 50)}`;
  const headers = { Accept: 'application/json' };
  if (NEWS_API_KEY) headers.Authorization = `Apikey ${NEWS_API_KEY}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`CryptoCompare news HTTP ${res.status}`);
  const json = await res.json();
  const items = (json.Data || []).map((item) =>
    normalizeArticle({
      id: item.ID,
      title: item.TITLE,
      url: item.URL,
      summary: item.BODY,
      image_url: item.IMAGE_URL,
      source: item.SOURCE_DATA?.NAME,
      published_at: item.PUBLISHED_ON ? new Date(item.PUBLISHED_ON * 1000).toISOString() : null,
      tags: item.KEYWORDS?.split('|') || [],
    })
  );
  const start = (page - 1) * limit;
  return {
    articles: items.slice(start, start + limit),
    pagination: { page, limit, total: items.length, hasMore: start + limit < items.length },
  };
}

async function fetchCoinGecko({ page, limit }) {
  const url = new URL('https://api.coingecko.com/api/v3/news');
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(Math.min(limit, 20)));
  const headers = { Accept: 'application/json' };
  if (COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = COINGECKO_API_KEY;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`CoinGecko news HTTP ${res.status} — requires Analyst API plan`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : json.data || [];
  return {
    articles: list.map((item) =>
      normalizeArticle({
        title: item.title,
        url: item.url,
        image_url: item.image,
        source: item.source_name,
        published_at: item.posted_at,
        coins: item.related_coin_ids,
      })
    ),
    pagination: { page, limit, total: list.length, hasMore: list.length >= limit },
  };
}

async function fetchFromProvider({ page, limit }) {
  switch (NEWS_PROVIDER) {
    case 'rss':
      return rssNews.getRssNews({ page, limit });
    case 'cryptocompare':
      return fetchCryptoCompare({ page, limit });
    case 'coingecko':
      return fetchCoinGecko({ page, limit });
    case 'newsapi':
      throw new Error('NewsAPI provider not implemented — use NEWS_PROVIDER=rss');
    default:
      throw new Error(`Unknown news provider: ${NEWS_PROVIDER}`);
  }
}

async function getNews({ page = 1, limit = 20 } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(Math.max(1, Number(limit) || 20), 50);

  if (!isConfigured()) {
    return {
      configured: false,
      articles: [],
      pagination: { page: p, limit: l, total: 0, hasMore: false },
      meta: {
        provider: null,
        message: 'News feed not configured',
        setupHint: 'Set NEWS_PROVIDER=rss (default) or provide NEWS_API_KEY for CryptoCompare.',
      },
    };
  }

  try {
    const result = await fetchFromProvider({ page: p, limit: l });
    return {
      configured: true,
      articles: result.articles || [],
      pagination: result.pagination || { page: p, limit: l, total: 0, hasMore: false },
      meta: {
        provider: NEWS_PROVIDER,
        cachedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    if (NEWS_PROVIDER !== 'rss') {
      const fallback = await rssNews.getRssNews({ page: p, limit: l });
      return {
        configured: true,
        articles: fallback.articles,
        pagination: fallback.pagination,
        meta: {
          provider: 'rss',
          fallbackFrom: NEWS_PROVIDER,
          warning: err.message,
          cachedAt: new Date().toISOString(),
        },
      };
    }
    throw err;
  }
}

module.exports = { getNews, isConfigured };
