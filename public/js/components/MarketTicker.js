import { api } from '../api.js';
import { formatUsd, formatPct, formatNumber, pctClass } from '../format.js';

const $ = (sel) => document.querySelector(sel);

let refreshTimer = null;

function renderTicker(global) {
  const el = $('#marketTicker');
  if (!el || !global) return;

  const mcap = global.total_market_cap?.usd;
  const vol = global.total_volume?.usd;
  const mcapChg = global.market_cap_change_percentage_24h_usd;
  const btcDom = global.market_cap_percentage?.btc;
  const ethDom = global.market_cap_percentage?.eth;

  el.innerHTML = `
    <div class="market-ticker-inner">
      <span class="ticker-item"><strong>${formatNumber(global.active_cryptocurrencies, 0)}</strong> Coins</span>
      <span class="ticker-sep">·</span>
      <span class="ticker-item"><strong>${formatNumber(global.markets, 0)}</strong> Exchanges</span>
      <span class="ticker-sep">·</span>
      <span class="ticker-item">Market Cap <strong>${formatUsd(mcap, true)}</strong> <span class="${pctClass(mcapChg)}">${formatPct(mcapChg)}</span></span>
      <span class="ticker-sep">·</span>
      <span class="ticker-item">24h Vol <strong>${formatUsd(vol, true)}</strong></span>
      <span class="ticker-sep">·</span>
      <span class="ticker-item">Dominance <strong>BTC ${btcDom?.toFixed(1) ?? '—'}%</strong> · <strong>ETH ${ethDom?.toFixed(1) ?? '—'}%</strong></span>
    </div>`;
}

export async function loadMarketTicker() {
  try {
    const { global } = await api.getGlobal();
    renderTicker(global);
  } catch {
    const el = $('#marketTicker');
    if (el) el.innerHTML = '<div class="market-ticker-inner"><span class="ticker-item">Market data loading…</span></div>';
  }
}

export function initMarketTicker() {
  loadMarketTicker();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadMarketTicker, 90_000);
}
