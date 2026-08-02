const { parseFeed } = require('./rssParser');

const FEEDS = [
  { source: 'Decrypt', url: 'https://decrypt.co/feed' },
  { source: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { source: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/feed' },
];

const cache = { articles: [], time: 0 };
const TTL = 5 * 60_000;

async function fetchFeed({ source, url }) {
  const res = await fetch(url, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*', 'User-Agent': 'AurexCapital/1.0' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`${source} feed HTTP ${res.status}`);
  const xml = await res.text();
  const items = parseFeed(xml);
  return items
    .filter((a) => a.title && a.url)
    .map((a) => ({
      ...a,
      source,
      published_at: a.published_at ? new Date(a.published_at).toISOString() : new Date().toISOString(),
    }));
}

async function getRssNews({ page = 1, limit = 20 } = {}) {
  const now = Date.now();
  if (!cache.articles.length || now - cache.time > TTL) {
    const batches = await Promise.allSettled(FEEDS.map(fetchFeed));
    const merged = batches
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

    const seen = new Set();
    cache.articles = merged.filter((a) => {
      const key = a.url || a.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    cache.time = now;
  }

  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(Math.max(1, Number(limit) || 20), 50);
  const start = (p - 1) * l;
  const slice = cache.articles.slice(start, start + l);

  return {
    articles: slice,
    pagination: {
      page: p,
      limit: l,
      total: cache.articles.length,
      hasMore: start + l < cache.articles.length,
    },
  };
}

module.exports = { getRssNews, FEEDS };
