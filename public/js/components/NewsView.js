import { api } from '../api.js';
import { formatTime } from '../format.js';
import { NEWS_PROVIDERS, NEWS_EMPTY_MESSAGE } from '../config/news.js';

const $ = (sel) => document.querySelector(sel);

let state = { page: 1, configured: false, articles: [] };

function renderArticleCard(article) {
  const tags = (article.tags || [])
    .slice(0, 3)
    .map((t) => `<span class="news-tag">${t}</span>`)
    .join('');
  const coins = (article.coins || [])
    .slice(0, 3)
    .map((c) => `<span class="news-coin">${c}</span>`)
    .join('');
  return `
    <article class="news-card panel">
      ${article.image_url ? `<img class="news-card-image" src="${article.image_url}" alt="" loading="lazy" />` : ''}
      <div class="news-card-body">
        <div class="news-card-meta">
          ${article.source ? `<span class="news-source">${article.source}</span>` : ''}
          ${article.published_at ? `<time class="news-date">${formatTime(article.published_at)}</time>` : ''}
        </div>
        <h2 class="news-card-title">
          ${article.url ? `<a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a>` : article.title}
        </h2>
        ${article.summary ? `<p class="news-card-summary">${article.summary}</p>` : ''}
        ${tags || coins ? `<div class="news-card-tags">${tags}${coins}</div>` : ''}
      </div>
    </article>`;
}

function renderEmptyState(meta = {}) {
  const root = $('#newsContent');
  if (!root) return;
  root.innerHTML = `
    <div class="news-empty panel">
      <div class="news-empty-icon" aria-hidden="true">📰</div>
      <h2>${NEWS_EMPTY_MESSAGE}</h2>
      <p class="news-empty-lead">
        Aurex Capital is ready to display live crypto news once a provider is connected on the server.
        Market data continues to flow from CoinGecko in the meantime.
      </p>
      <div class="news-empty-details">
        <h3>How to enable</h3>
        <ol class="news-setup-steps">
          <li>Add <code>NEWS_PROVIDER</code> and <code>NEWS_API_KEY</code> to your server <code>.env</code> file</li>
          <li>Restart the Aurex Capital server</li>
          <li>Refresh this page — articles will appear automatically</li>
        </ol>
        <h3>Supported providers (planned)</h3>
        <ul class="news-provider-list">
          ${NEWS_PROVIDERS.map((p) => `<li><strong>${p.label}</strong> — <code>${p.env}</code></li>`).join('')}
        </ul>
        ${meta.setupHint ? `<p class="news-empty-hint">${meta.setupHint}</p>` : ''}
      </div>
      <div class="news-empty-actions">
        <a href="/markets" class="btn btn-primary btn-sm" data-route="/markets">Browse Markets</a>
        <a href="/" class="btn btn-ghost btn-sm" data-route="/">Back to Overview</a>
      </div>
    </div>`;
}

function renderNoArticles() {
  const root = $('#newsContent');
  if (!root) return;
  root.innerHTML = `
    <div class="news-empty panel">
      <div class="news-empty-icon" aria-hidden="true">📭</div>
      <h2>No articles yet</h2>
      <p class="news-empty-lead">The news provider is connected but returned no stories for this page.</p>
      <button type="button" class="btn btn-ghost btn-sm" id="newsRetryBtn">Refresh</button>
    </div>`;
  $('#newsRetryBtn')?.addEventListener('click', () => loadNews());
}

function renderArticleGrid(articles, pagination, meta) {
  const root = $('#newsContent');
  if (!root) return;
  root.innerHTML = `
    <div class="news-toolbar page-toolbar">
      <span class="toolbar-count">${pagination.total || articles.length} articles</span>
      ${meta.provider ? `<span class="news-provider-badge">via ${meta.provider}</span>` : ''}
    </div>
    <div class="news-grid">${articles.map(renderArticleCard).join('')}</div>
    ${
      pagination.hasMore
        ? `<div class="news-pagination"><button type="button" class="btn btn-ghost btn-sm" id="newsLoadMore">Load more</button></div>`
        : ''
    }`;
  $('#newsLoadMore')?.addEventListener('click', () => {
    state.page += 1;
    loadNews({ append: true });
  });
}

function setLoading() {
  const root = $('#newsContent');
  if (root) {
    root.innerHTML = '<div class="news-loading"><div class="skeleton card-skeleton"></div>'.repeat(3) + '</div>';
  }
}

function setError(message) {
  const root = $('#newsContent');
  if (root) {
    root.innerHTML = `<div class="error-state panel">${message}</div>`;
  }
}

export async function loadNews({ append = false } = {}) {
  if (!append) {
    state.page = 1;
    setLoading();
  }

  try {
    const data = await api.getNews(state.page, 20);
    state.configured = data.configured;
    state.articles = append ? [...state.articles, ...(data.articles || [])] : data.articles || [];

    const statusEl = $('#newsStatusBadge');
    if (statusEl) {
      statusEl.classList.toggle('is-live', data.configured);
      statusEl.textContent = data.configured ? 'Live feed' : 'Not configured';
    }

    if (!data.configured) {
      renderEmptyState(data.meta);
      return;
    }

    if (!state.articles.length) {
      renderNoArticles();
      return;
    }

    renderArticleGrid(state.articles, data.pagination || {}, data.meta || {});
  } catch (err) {
    setError(err.message);
  }
}

export function initNewsView() {
  /* reserved for filter tabs / subscriptions in future phases */
}
