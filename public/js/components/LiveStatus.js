import { formatTime } from '../format.js';

let lastSuccessAt = null;

function renderBadge({ ok, stale, cachedAt, error }) {
  const el = document.getElementById('liveStatusBadge');
  if (!el) return;

  el.classList.remove('is-error', 'is-stale');

  if (error || ok === false) {
    el.classList.add('is-error');
    el.innerHTML = `
      <span class="live-dot live-dot-off"></span>
      <span class="live-status-copy">
        <span class="live-status-title">Market Data Unavailable</span>
        <span class="live-status-sub">${lastSuccessAt ? `Last successful update: ${formatTime(lastSuccessAt)}` : 'Waiting for connection'}</span>
      </span>`;
    return;
  }

  if (stale) el.classList.add('is-stale');
  if (cachedAt) lastSuccessAt = cachedAt;

  el.innerHTML = `
    <span class="live-dot"></span>
    <span class="live-status-copy">
      <span class="live-status-title">Live Market Data</span>
      <span class="live-status-sub">Powered by CoinGecko${cachedAt ? ` · ${formatTime(cachedAt)}` : ''}${stale ? ' · cached' : ''}</span>
    </span>`;
}

export function setLiveStatus(meta = {}, error = null) {
  if (error) {
    renderBadge({ ok: false, error });
    return;
  }
  renderBadge({
    ok: true,
    stale: meta.stale,
    cachedAt: meta.cachedAt,
  });
}

export function initLiveStatus() {
  renderBadge({ ok: true, cachedAt: null });
}
