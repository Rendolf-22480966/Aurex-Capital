import { api } from './api.js';
import { formatUsd, formatPct, formatNumber, formatSupply, pctClass, formatTime, stripHtml } from './format.js';
import { getWatchlist, isWatchlisted, toggleWatchlist } from './watchlist.js';
import { renderSparkline, get7dChange, getSparklinePrices } from './sparkline.js';
import { setLiveStatus } from './components/LiveStatus.js';
import { loadGlobalMarketChart } from './components/GlobalMarketChart.js';

const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  marketsPage: 1,
  marketsPerPage: 50,
  marketsSort: 'market_cap',
  selectedCoinId: null,
  chartDays: '1',
  chart: null,
  priceSeries: null,
  volumeSeries: null,
  refreshTimers: {},
  lastMeta: {},
  callbacks: {},
};

const REFRESH = {
  overview: 60_000,
  markets: 60_000,
  trending: 120_000,
  gainers: 90_000,
  losers: 90_000,
  watchlist: 60_000,
  coin: 60_000,
};

export function initDashboard(callbacks = {}) {
  state.callbacks = callbacks;
  bindDashboardEvents();
}

function renderWatchlistEmpty(isLoggedIn) {
  const tbody = $('#watchlistTableBody');
  const panel = $('#watchlistEmpty');
  const content = $('#watchlistContent');
  content?.classList.add('hidden');
  if (panel) {
    panel.classList.remove('hidden');
    panel.innerHTML = `
      <div class="watchlist-empty-card panel">
        <h2>Your watchlist is empty</h2>
        <p>${
          isLoggedIn
            ? 'Star coins on the Markets page or any coin detail page to track them here.'
            : 'Tap the ☆ icon on any coin to build a watchlist. Sign in to sync across devices.'
        }</p>
        <button type="button" class="btn btn-primary" id="watchlistBrowseBtn">Browse Markets</button>
        ${isLoggedIn ? '' : '<button type="button" class="btn btn-ghost" id="watchlistSignInBtn">Sign In to Sync</button>'}
      </div>`;
    $('#watchlistBrowseBtn')?.addEventListener('click', () => state.callbacks.onNavigate?.('markets'));
    $('#watchlistSignInBtn')?.addEventListener('click', () => state.callbacks.onSignIn?.());
  }
  if (tbody) tbody.innerHTML = '';
  const countEl = $('#watchlistCount');
  if (countEl) countEl.textContent = '0 coins';
}

export function onViewActivated(view) {
  clearRefreshTimers();
  if (view === 'overview') {
    loadOverview();
    loadGlobalMarketChart(7);
  }
  if (view === 'markets') loadMarkets();
  if (view === 'trending') loadTrending();
  if (view === 'gainers') loadGainers();
  if (view === 'losers') loadLosers();
  if (view === 'watchlist') loadWatchlist();
  if (view === 'coin' && state.selectedCoinId) loadCoinDetail(state.selectedCoinId);
}

export function openCoin(coinId) {
  state.selectedCoinId = coinId;
  state.callbacks.onNavigate?.('coin', { coinId });
}

function clearRefreshTimers() {
  Object.values(state.refreshTimers).forEach(clearInterval);
  state.refreshTimers = {};
}

function scheduleRefresh(key, fn, ms) {
  if (state.refreshTimers[key]) clearInterval(state.refreshTimers[key]);
  state.refreshTimers[key] = setInterval(fn, ms);
}

function setMeta(elId, meta, error) {
  const el = $(elId);
  if (!el) return;
  if (error) {
    el.innerHTML = `<span class="meta-error">${error}</span>`;
    return;
  }
  const parts = [];
  if (meta?.cachedAt) parts.push(`Updated ${formatTime(meta.cachedAt)}`);
  if (meta?.stale) parts.push('<span class="meta-stale">Showing cached data</span>');
  el.innerHTML = parts.join(' · ') || '';
}

function skeletonRows(cols, rows = 8) {
  return Array.from({ length: rows }, () =>
    `<tr class="skeleton-row">${Array.from({ length: cols }, () => '<td><div class="skeleton"></div></td>').join('')}</tr>`
  ).join('');
}

function get1hChange(c) {
  return c.price_change_percentage_1h_in_currency?.usd ?? c.price_change_percentage_1h ?? null;
}

function coinRow(c, opts = {}) {
  const starred = isWatchlisted(c.id) ? '★' : '☆';
  const change7d = get7dChange(c);
  const change1h = get1hChange(c);
  const sparkPrices = getSparklinePrices(c);
  const rank = opts.rank ?? c.market_cap_rank ?? '—';
  return `
    <tr data-coin-id="${c.id}" class="coin-row">
      <td class="col-star"><button type="button" class="btn-icon watch-btn" data-watch="${c.id}" title="Watchlist" aria-label="Toggle watchlist">${starred}</button></td>
      <td class="rank-cell">${rank}</td>
      <td>
        <div class="coin-cell">
          <img src="${c.image}" alt="" loading="lazy" width="28" height="28" />
          <div>
            <div class="coin-name">${c.name}</div>
            <div class="coin-symbol">${String(c.symbol).toUpperCase()}</div>
          </div>
        </div>
      </td>
      <td class="col-num">${formatUsd(c.current_price)}</td>
      <td class="col-num ${pctClass(change1h)}">${formatPct(change1h)}</td>
      <td class="col-num ${pctClass(c.price_change_percentage_24h)}">${formatPct(c.price_change_percentage_24h)}</td>
      <td class="col-num ${pctClass(change7d)}">${formatPct(change7d)}</td>
      <td class="sparkline-cell">${renderSparkline(sparkPrices, change7d)}</td>
      <td class="col-num">${formatUsd(c.market_cap, true)}</td>
      <td class="col-num">${formatUsd(c.total_volume, true)}</td>
      ${opts.full ? `
        <td class="col-num">${formatUsd(c.high_24h)}</td>
        <td class="col-num">${formatUsd(c.low_24h)}</td>
        <td class="col-num">${formatSupply(c.circulating_supply)}</td>` : ''}
      <td class="row-actions col-actions">
        ${opts.trade ? `<button class="trade-btn" data-open="${c.id}">Trade</button>` : ''}
      </td>
    </tr>`;
}

function moversCoinRow(c, rank) {
  const starred = isWatchlisted(c.id) ? '★' : '☆';
  const change7d = get7dChange(c);
  const sparkPrices = getSparklinePrices(c);
  return `
    <tr data-coin-id="${c.id}" class="coin-row">
      <td class="rank-cell">${rank ?? c.market_cap_rank ?? '—'}</td>
      <td>
        <div class="coin-cell">
          <img src="${c.image}" alt="" loading="lazy" width="28" height="28" />
          <div>
            <div class="coin-name">${c.name}</div>
            <div class="coin-symbol">${String(c.symbol).toUpperCase()}</div>
          </div>
        </div>
      </td>
      <td class="col-num">${formatUsd(c.current_price)}</td>
      <td class="col-num ${pctClass(c.price_change_percentage_24h)}">${formatPct(c.price_change_percentage_24h)}</td>
      <td class="col-num ${pctClass(change7d)}">${formatPct(change7d)}</td>
      <td class="sparkline-cell">${renderSparkline(sparkPrices, change7d)}</td>
      <td class="col-num">${formatUsd(c.market_cap, true)}</td>
      <td class="col-num">${formatUsd(c.total_volume, true)}</td>
      <td class="row-actions col-actions">
        <button class="btn-icon watch-btn" data-watch="${c.id}" title="Watchlist">${starred}</button>
        <button class="trade-btn" data-open="${c.id}">Trade</button>
      </td>
    </tr>`;
}

function compactCoinRow(c, extraActions = '') {
  const change7d = get7dChange(c);
  const sparkPrices = getSparklinePrices(c);
  return `
    <tr data-coin-id="${c.id}" class="coin-row">
      <td><div class="coin-cell"><img src="${c.image}" alt="" width="28" height="28" /><div><div class="coin-name">${c.name}</div><div class="coin-symbol">${String(c.symbol).toUpperCase()}</div></div></div></td>
      <td>${formatUsd(c.current_price)}</td>
      <td class="${pctClass(c.price_change_percentage_24h)}">${formatPct(c.price_change_percentage_24h)}</td>
      <td class="${pctClass(change7d)}">${formatPct(change7d)}</td>
      <td class="sparkline-cell">${renderSparkline(sparkPrices, change7d)}</td>
      <td>${formatUsd(c.market_cap, true)}</td>
      <td>${formatUsd(c.total_volume, true)}</td>
      ${extraActions}
    </tr>`;
}

async function loadOverviewNews() {
  const el = $('#overviewNews');
  if (!el) return;
  try {
    const data = await api.getNews(1, 4);
    if (!data.configured || !data.articles?.length) {
      el.innerHTML = `<div class="empty-state panel">News feed needs a server restart. In terminal run: <code>npm start</code> then hard refresh (Ctrl+Shift+R).</div>`;
      return;
    }
    el.innerHTML = data.articles.slice(0, 4).map((a) => `
      <article class="news-card">
        ${a.image_url ? `<img class="news-card-image" src="${a.image_url}" alt="" loading="lazy" />` : '<div class="news-card-image news-card-image-fallback"></div>'}
        <div class="news-card-body">
          <p class="news-card-source">${a.source || 'News'}</p>
          <h3 class="news-card-title">${a.url ? `<a href="${a.url}" target="_blank" rel="noopener">${a.title}</a>` : a.title}</h3>
        </div>
      </article>`).join('');
  } catch {
    el.innerHTML = '<div class="empty-state">News unavailable</div>';
  }
}

async function loadOverview() {
  const statsEl = $('#globalStats');
  const trendEl = $('#overviewTrending');
  if (statsEl) statsEl.innerHTML = '<div class="skeleton card-skeleton"></div>'.repeat(6);
  if (trendEl) trendEl.innerHTML = '<div class="skeleton card-skeleton"></div>'.repeat(5);

  try {
    let data;
    try {
      data = await api.getMarketDashboard();
    } catch (dashErr) {
      if (String(dashErr.message).includes('404') || String(dashErr.message).includes('Not found')) {
        throw new Error('Server out of date — stop the old server and run: npm start');
      }
      const [globalRes, trendingRes, gainersRes, losersRes] = await Promise.all([
        api.getGlobal(),
        api.getTrending(),
        api.getGainers(10),
        api.getLosers(10),
      ]);
      data = {
        global: globalRes.global,
        trending: trendingRes.trending,
        gainers: gainersRes.coins,
        losers: losersRes.coins,
        meta: { global: globalRes.meta, trending: trendingRes.meta },
      };
    }

    if (!data?.global) {
      throw new Error('Global market data unavailable from CoinGecko');
    }

    state.lastMeta.overview = data.meta?.global;
    setMeta('#overviewMeta', data.meta?.global);
    setLiveStatus(data.meta?.global);

    const g = data.global;
    const mcap = g.total_market_cap?.usd;
    const vol = g.total_volume?.usd;
    const btcDom = g.market_cap_percentage?.btc;
    const ethDom = g.market_cap_percentage?.eth;
    const mcapChg = g.market_cap_change_percentage_24h_usd;

    const metaEl = $('#overviewMeta');
    if (metaEl && mcap != null) {
      metaEl.textContent = `The global crypto market cap is ${formatUsd(mcap, true)}${mcapChg != null ? `, a ${mcapChg >= 0 ? '' : ''}${Math.abs(mcapChg).toFixed(2)}% ${mcapChg >= 0 ? 'increase' : 'decrease'} over the last day` : ''}.`;
    }

    let sparkHtml = '';
    try {
      const { points } = await api.getGlobalChart(7);
      const values = (points || []).map((p) => p[1]).filter(Number.isFinite);
      if (values.length > 1) {
        sparkHtml = renderSparkline(values, mcapChg);
      }
    } catch {
      /* optional */
    }

    $('#globalStats').innerHTML = `
      <div class="cg-stat-block">
        <div class="cg-stat-label">Market Cap</div>
        <div class="cg-stat-row">
          <div class="cg-stat-copy">
            <div class="cg-stat-value">${formatUsd(mcap, true)}</div>
            <div class="cg-stat-change ${pctClass(mcapChg)}">${formatPct(mcapChg)} <span>24h</span></div>
          </div>
          ${sparkHtml ? `<div class="cg-stat-spark">${sparkHtml}</div>` : ''}
        </div>
      </div>
      <div class="cg-stat-block">
        <div class="cg-stat-label">24h Trading Volume</div>
        <div class="cg-stat-row">
          <div class="cg-stat-copy">
            <div class="cg-stat-value">${formatUsd(vol, true)}</div>
          </div>
        </div>
      </div>
      <div class="cg-stat-mini-grid">
        <div class="cg-stat-mini"><span>BTC Dominance</span><strong>${btcDom != null ? `${btcDom.toFixed(1)}%` : '—'}</strong></div>
        <div class="cg-stat-mini"><span>ETH Dominance</span><strong>${ethDom != null ? `${ethDom.toFixed(1)}%` : '—'}</strong></div>
        <div class="cg-stat-mini"><span>Coins</span><strong>${formatNumber(g.active_cryptocurrencies, 0)}</strong></div>
        <div class="cg-stat-mini"><span>Exchanges</span><strong>${formatNumber(g.markets, 0)}</strong></div>
      </div>`;

    renderCgCoinList('#overviewTrending', data.trending?.coins || [], { type: 'trending' });
    renderMiniMovers('#overviewGainers', data.gainers || []);
    renderMiniMovers('#overviewLosers', data.losers || []);
    loadOverviewNews();
    scheduleRefresh('overview', loadOverview, REFRESH.overview);
  } catch (err) {
    setMeta('#overviewMeta', null, err.message);
    setLiveStatus({}, err.message);
    if (statsEl) statsEl.innerHTML = `<div class="error-state">${err.message}</div>`;
  }
}

function renderTrendingCards(selector, coins, marketMap = {}, limit) {
  const el = $(selector);
  if (!el) return;
  const list = limit ? coins.slice(0, limit) : coins;
  if (!list.length) {
    el.innerHTML = '<div class="empty-state">No trending data</div>';
    return;
  }
  el.innerHTML = list.map((item, index) => {
    const c = item.item || item;
    const market = marketMap[c.id];
    const price = market?.current_price ?? c.data?.price;
    const chg =
      market?.price_change_percentage_24h ??
      c.data?.price_change_percentage_24h?.usd ??
      c.data?.price_change_percentage_24h?.['24h'];
    const change7d = market ? get7dChange(market) : null;
    const sparkPrices = market ? getSparklinePrices(market) : null;
    const score = c.score != null ? Number(c.score).toFixed(1) : null;
    return `
      <button class="trend-card" data-coin-id="${c.id}">
        <span class="trend-rank">${index + 1}</span>
        <img src="${c.thumb || c.small || c.image || market?.image}" alt="" width="36" height="36" loading="lazy" />
        <div class="trend-info">
          <div class="trend-name-row">
            <span class="coin-name">${c.name}</span>
            ${score ? `<span class="trend-score" title="Trending score">${score}</span>` : ''}
          </div>
          <div class="coin-symbol">${String(c.symbol).toUpperCase()} · #${c.market_cap_rank ?? market?.market_cap_rank ?? '—'}</div>
          <div class="trend-price-row">
            <span class="trend-price">${price != null ? formatUsd(price) : '—'}</span>
            <span class="${pctClass(chg)}">${formatPct(chg)}</span>
          </div>
        </div>
        ${sparkPrices?.length ? `<div class="trend-spark">${renderSparkline(sparkPrices, change7d ?? chg)}</div>` : ''}
      </button>`;
  }).join('');
}

function renderCgCoinList(selector, items, { type = 'trending' } = {}) {
  const el = $(selector);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="empty-state">No data</div>';
    return;
  }
  el.innerHTML = items.slice(0, 5).map((item, index) => {
    const c = item.item || item;
    const price = c.current_price ?? c.data?.price;
    const chg =
      c.price_change_percentage_24h ??
      c.data?.price_change_percentage_24h?.usd ??
      c.data?.price_change_percentage_24h?.['24h'];
    const img = c.thumb || c.small || c.image;
    return `
      <button type="button" class="cg-coin-list-item" data-coin-id="${c.id}">
        <span class="cg-list-rank">${type === 'trending' ? index + 1 : ''}</span>
        <img src="${img}" alt="" width="24" height="24" loading="lazy" />
        <span class="cg-list-name">${c.name}</span>
        <span class="cg-list-price">${price != null ? formatUsd(price) : '—'}</span>
        <span class="cg-list-change ${pctClass(chg)}">${formatPct(chg)}</span>
      </button>`;
  }).join('');
}

function renderMiniMovers(selector, coins) {
  renderCgCoinList(selector, coins, { type: 'movers' });
}

async function loadMarkets() {
  const tbody = $('#marketsTableBody');
  if (tbody) tbody.innerHTML = skeletonRows(14);

  try {
    const { coins, meta } = await api.getMarkets(state.marketsPage, state.marketsPerPage, state.marketsSort);
    state.lastMeta.markets = meta;
    setMeta('#marketsMeta', meta);
    if (tbody) {
      if (!coins.length) tbody.innerHTML = '<tr><td colspan="14" class="empty-state">No coins found</td></tr>';
      else tbody.innerHTML = coins.map((c) => coinRow(c, { full: true, trade: true })).join('');
    }
    const pageInfo = $('#marketsPageInfo');
    if (pageInfo) {
      pageInfo.textContent = `Page ${state.marketsPage} · ${coins.length} of ${state.marketsPerPage} per page`;
    }
    const nextBtn = $('#marketsNext');
    if (nextBtn) nextBtn.disabled = coins.length < state.marketsPerPage;
    const prevBtn = $('#marketsPrev');
    if (prevBtn) prevBtn.disabled = state.marketsPage <= 1;
    scheduleRefresh('markets', loadMarkets, REFRESH.markets);
  } catch (err) {
    setMeta('#marketsMeta', null, err.message);
    if (tbody) tbody.innerHTML = `<tr><td colspan="14" class="error-state">${err.message}</td></tr>`;
  }
}

async function loadTrending() {
  const el = $('#trendingGrid');
  if (el) el.innerHTML = '<div class="skeleton card-skeleton"></div>'.repeat(8);
  try {
    const { trending, meta } = await api.getTrending();
    setMeta('#trendingMeta', meta);
    const items = trending?.coins || [];
    let marketMap = {};
    if (items.length) {
      const ids = items.map((item) => (item.item || item).id).filter(Boolean);
      try {
        const { coins } = await api.getMarketsByIds(ids);
        marketMap = Object.fromEntries(coins.map((c) => [c.id, c]));
      } catch (_) {
        /* sparklines optional */
      }
    }
    renderTrendingCards('#trendingGrid', items, marketMap);
    const countEl = $('#trendingCount');
    if (countEl) countEl.textContent = `${items.length} trending`;
    scheduleRefresh('trending', loadTrending, REFRESH.trending);
  } catch (err) {
    setMeta('#trendingMeta', null, err.message);
    if (el) el.innerHTML = `<div class="error-state">${err.message}</div>`;
  }
}

async function loadGainers() {
  await loadMoversTable('gainers', '#gainersTableBody', '#gainersMeta', () => api.getGainers(30), '#gainersCount');
}

async function loadLosers() {
  await loadMoversTable('losers', '#losersTableBody', '#losersMeta', () => api.getLosers(30), '#losersCount');
}

async function loadMoversTable(key, tbodySel, metaSel, fetcher, countSel) {
  const tbody = $(tbodySel);
  if (tbody) tbody.innerHTML = skeletonRows(9);
  try {
    const { coins, meta } = await fetcher();
    setMeta(metaSel, meta);
    if (tbody) {
      tbody.innerHTML = coins.length
        ? coins.map((c, i) => moversCoinRow(c, i + 1)).join('')
        : '<tr><td colspan="9" class="empty-state">No data available</td></tr>';
    }
    const countEl = $(countSel);
    if (countEl) countEl.textContent = `${coins.length} coins`;
    scheduleRefresh(key, key === 'gainers' ? loadGainers : loadLosers, REFRESH[key]);
  } catch (err) {
    setMeta(metaSel, null, err.message);
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="error-state">${err.message}</td></tr>`;
  }
}

async function loadWatchlist() {
  const ids = getWatchlist();
  const tbody = $('#watchlistTableBody');
  const metaEl = '#watchlistMeta';
  const isLoggedIn = Boolean(state.callbacks.getUser?.());
  const emptyPanel = $('#watchlistEmpty');

  if (!ids.length) {
    renderWatchlistEmpty(isLoggedIn);
    setMeta(metaEl, {});
    return;
  }

  emptyPanel?.classList.add('hidden');
  $('#watchlistContent')?.classList.remove('hidden');
  if (tbody) tbody.innerHTML = skeletonRows(9);
  const countEl = $('#watchlistCount');
  if (countEl) countEl.textContent = `${ids.length} coin${ids.length === 1 ? '' : 's'}`;

  try {
    const { coins, meta } = await api.getMarketsByIds(ids);
    setMeta(metaEl, meta);
    const ordered = ids.map((id) => coins.find((c) => c.id === id)).filter(Boolean);
    if (tbody) {
      tbody.innerHTML = ordered.length
        ? ordered.map((c) => moversCoinRow(c, c.market_cap_rank)).join('')
        : '<tr><td colspan="9" class="empty-state">Could not load watchlist coins</td></tr>';
    }
    scheduleRefresh('watchlist', loadWatchlist, REFRESH.watchlist);
  } catch (err) {
    setMeta(metaEl, null, err.message);
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="error-state">${err.message}</td></tr>`;
  }
}

async function loadCoinDetail(coinId) {
  state.selectedCoinId = coinId;
  const header = $('#coinDetailHeader');
  const stats = $('#coinDetailStats');
  const about = $('#coinDetailAbout');
  const links = $('#coinDetailLinks');
  if (header) header.innerHTML = '<div class="skeleton card-skeleton"></div>';
  if (stats) stats.innerHTML = '<div class="skeleton card-skeleton"></div>'.repeat(6);

  try {
    const [{ coin, meta }, chartRes] = await Promise.all([
      api.getCoin(coinId),
      api.getChart(coinId, state.chartDays),
    ]);
    setMeta('#coinDetailMeta', meta);
    const md = coin.market_data;
    const starred = isWatchlisted(coin.id);

    if (header) {
      header.innerHTML = `
        <div class="coin-detail-top">
          <img src="${coin.image?.large || coin.image?.small}" alt="" width="48" height="48" />
          <div>
            <h1>${coin.name} <span class="coin-symbol">${String(coin.symbol).toUpperCase()}</span></h1>
            <div class="coin-detail-price">${formatUsd(md.current_price?.usd)}</div>
            <div class="${pctClass(md.price_change_percentage_24h)}">${formatPct(md.price_change_percentage_24h)} (24h)</div>
          </div>
          <button class="btn btn-outline watch-toggle" data-watch="${coin.id}">${starred ? '★ Watchlisted' : '☆ Add to Watchlist'}</button>
        </div>`;
    }

    if (stats) {
      stats.innerHTML = `
        <div class="stat-card"><div class="stat-label">Market Cap</div><div class="stat-value">${formatUsd(md.market_cap?.usd, true)}</div></div>
        <div class="stat-card"><div class="stat-label">Volume (24h)</div><div class="stat-value">${formatUsd(md.total_volume?.usd, true)}</div></div>
        <div class="stat-card"><div class="stat-label">Circulating Supply</div><div class="stat-value">${formatSupply(md.circulating_supply)}</div></div>
        <div class="stat-card"><div class="stat-label">Total Supply</div><div class="stat-value">${md.total_supply ? formatSupply(md.total_supply) : '—'}</div></div>
        <div class="stat-card"><div class="stat-label">Max Supply</div><div class="stat-value">${md.max_supply ? formatSupply(md.max_supply) : '∞'}</div></div>
        <div class="stat-card"><div class="stat-label">24h High / Low</div><div class="stat-value">${formatUsd(md.high_24h?.usd)} / ${formatUsd(md.low_24h?.usd)}</div></div>
        <div class="stat-card"><div class="stat-label">All-Time High</div><div class="stat-value">${formatUsd(md.ath?.usd)}</div><div class="stat-sub">${formatPct(md.ath_change_percentage?.usd)} from ATH</div></div>
        <div class="stat-card"><div class="stat-label">All-Time Low</div><div class="stat-value">${formatUsd(md.atl?.usd)}</div><div class="stat-sub">${formatPct(md.atl_change_percentage?.usd)} from ATL</div></div>`;
    }

    if (about) {
      const desc = stripHtml(coin.description?.en || '').slice(0, 600);
      about.innerHTML = desc ? `<p>${desc}${desc.length >= 600 ? '…' : ''}</p>` : '<p class="empty-state">No description available</p>';
    }

    if (links) {
      const ln = coin.links || {};
      const items = [];
      (ln.homepage || []).filter(Boolean).slice(0, 2).forEach((u) => items.push(`<a href="${u}" target="_blank" rel="noopener">Website</a>`));
      if (ln.twitter_screen_name) items.push(`<a href="https://twitter.com/${ln.twitter_screen_name}" target="_blank" rel="noopener">Twitter</a>`);
      if (ln.subreddit_url) items.push(`<a href="${ln.subreddit_url}" target="_blank" rel="noopener">Reddit</a>`);
      links.innerHTML = items.length ? items.join(' · ') : '—';
    }

    renderChart(chartRes.chart);
    updateTradePanel(coin);
    scheduleRefresh('coin', () => loadCoinDetail(coinId), REFRESH.coin);
  } catch (err) {
    setMeta('#coinDetailMeta', null, err.message);
    if (header) header.innerHTML = `<div class="error-state">${err.message}</div>`;
  }
}

function updateTradePanel(coin) {
  const md = coin.market_data;
  $('#tradeCoinName').textContent = coin.name;
  $('#tradeLivePrice').textContent = formatUsd(md.current_price?.usd);
  $('#tradeBox').dataset.coinId = coin.id;
  $('#tradeBox').dataset.coinSymbol = coin.symbol;
  $('#tradeBox').dataset.coinName = coin.name;
}

function renderChart(chartData) {
  const container = $('#coinDetailChart');
  if (!container || !chartData) return;
  container.innerHTML = '';

  state.chart = LightweightCharts.createChart(container, {
    layout: { background: { color: 'transparent' }, textColor: '#64748b' },
    grid: { vertLines: { color: '#e2e8f0' }, horzLines: { color: '#e2e8f0' } },
    width: container.clientWidth,
    height: 320,
    timeScale: { borderColor: '#e2e8f0' },
    rightPriceScale: { borderColor: '#e2e8f0' },
  });

  state.priceSeries = state.chart.addAreaSeries({
    lineColor: '#16c784',
    topColor: 'rgba(22, 199, 132, 0.35)',
    bottomColor: 'rgba(22, 199, 132, 0.02)',
    lineWidth: 2,
  });

  const prices = (chartData.prices || []).map(([ts, p]) => ({
    time: Math.floor(ts / 1000),
    value: p,
  }));
  state.priceSeries.setData(prices);
  state.chart.timeScale().fitContent();

  window.addEventListener('resize', () => {
    if (state.chart && container) state.chart.applyOptions({ width: container.clientWidth });
  }, { once: true });
}

async function loadChartOnly() {
  if (!state.selectedCoinId) return;
  try {
    const { chart } = await api.getChart(state.selectedCoinId, state.chartDays);
    renderChart(chart);
  } catch (err) {
    console.error(err);
  }
}

async function runSearch(q) {
  const dropdown = $('#searchDropdown');
  if (!q.trim()) {
    dropdown?.classList.add('hidden');
    return;
  }
  try {
    const { results } = await api.search(q);
    const coins = results.coins || [];
    if (!coins.length) {
      dropdown.innerHTML = '<div class="search-empty">No results</div>';
    } else {
      dropdown.innerHTML = coins.slice(0, 8).map((c) => `
        <button class="search-item" data-coin-id="${c.id}">
          <img src="${c.thumb}" alt="" width="24" height="24" />
          <span>${c.name}</span>
          <span class="coin-symbol">${String(c.symbol).toUpperCase()}</span>
          ${c.market_cap_rank ? `<span class="rank">#${c.market_cap_rank}</span>` : ''}
        </button>`).join('');
    }
    dropdown.classList.remove('hidden');
  } catch {
    dropdown.innerHTML = '<div class="search-empty">Search unavailable</div>';
    dropdown.classList.remove('hidden');
  }
}

function bindDashboardEvents() {
  document.addEventListener('click', (e) => {
    const coinId = e.target.closest('[data-coin-id]')?.dataset.coinId;
    const openId = e.target.closest('[data-open]')?.dataset.open;
    const watchId = e.target.closest('[data-watch]')?.dataset.watch;

    if (watchId) {
      e.stopPropagation();
      toggleWatchlist(watchId)
        .then((on) => {
          const btn = e.target.closest('[data-watch]');
          if (btn) {
            btn.textContent = btn.classList.contains('watch-toggle')
              ? on
                ? '★ Watchlisted'
                : '☆ Add to Watchlist'
              : on
                ? '★'
                : '☆';
            btn.classList.toggle('active', on);
          }
          if (state.callbacks.onWatchlistChange) state.callbacks.onWatchlistChange();
        })
        .catch((err) => {
          if (state.callbacks.onToast) state.callbacks.onToast(err.message, 'error');
        });
      return;
    }

    if (openId) {
      e.stopPropagation();
      openCoin(openId);
      return;
    }

    if (coinId && !e.target.closest('.watch-btn') && !e.target.closest('.trade-btn')) {
      openCoin(coinId);
    }
  });

  $('#marketsSort')?.addEventListener('change', (e) => {
    state.marketsSort = e.target.value;
    state.marketsPage = 1;
    loadMarkets();
  });

  $('#marketsPerPage')?.addEventListener('change', (e) => {
    state.marketsPerPage = Number(e.target.value) || 50;
    state.marketsPage = 1;
    loadMarkets();
  });

  $('#marketsPrev')?.addEventListener('click', () => {
    if (state.marketsPage > 1) {
      state.marketsPage--;
      loadMarkets();
    }
  });

  $('#marketsNext')?.addEventListener('click', () => {
    state.marketsPage++;
    loadMarkets();
  });

  $$('.chart-range').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.chart-range').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.chartDays = btn.dataset.days;
      loadChartOnly();
    });
  });

  let searchTimer;
  $('#globalSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(e.target.value), 300);
  });

  $('#globalSearch')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = $('#searchDropdown .search-item');
      if (first) {
        openCoin(first.dataset.coinId);
        $('#searchDropdown').classList.add('hidden');
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) $('#searchDropdown')?.classList.add('hidden');
  });

  $('#searchDropdown')?.addEventListener('click', (e) => {
    const item = e.target.closest('.search-item');
    if (item) {
      openCoin(item.dataset.coinId);
      $('#searchDropdown').classList.add('hidden');
      $('#globalSearch').value = '';
    }
  });
}

function $$(sel) {
  return document.querySelectorAll(sel);
}

export { loadCoinDetail, state as dashboardState };
