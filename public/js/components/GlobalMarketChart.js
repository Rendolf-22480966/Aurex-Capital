import { api } from '../api.js';
import { formatTime } from '../format.js';
import { setLiveStatus } from './LiveStatus.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let chart = null;
let areaSeries = null;
let chartDays = 7;
let loading = false;

function destroyChart() {
  if (chart) {
    chart.remove();
    chart = null;
    areaSeries = null;
  }
}

function renderChart(points) {
  const container = $('#globalMarketChart');
  if (!container || !window.LightweightCharts) return;

  destroyChart();

  chart = window.LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 280,
    layout: {
      background: { color: 'transparent' },
      textColor: '#64748b',
    },
    grid: {
      vertLines: { color: 'rgba(226, 232, 240, 0.9)' },
      horzLines: { color: 'rgba(226, 232, 240, 0.9)' },
    },
    rightPriceScale: { borderColor: '#e2e8f0' },
    timeScale: { borderColor: '#e2e8f0', timeVisible: true, secondsVisible: false },
  });

  areaSeries = chart.addAreaSeries({
    lineColor: '#16c784',
    topColor: 'rgba(22, 199, 132, 0.22)',
    bottomColor: 'rgba(22, 199, 132, 0.02)',
    lineWidth: 2,
  });

  const data = (points || [])
    .map(([ts, value]) => ({
      time: Math.floor(ts / 1000),
      value,
    }))
    .filter((p) => Number.isFinite(p.value));

  if (data.length) {
    areaSeries.setData(data);
    chart.timeScale().fitContent();
  }

  const onResize = () => {
    if (chart && container) chart.applyOptions({ width: container.clientWidth });
  };
  window.addEventListener('resize', onResize, { once: true });
}

function setMeta(meta, error) {
  const el = $('#globalChartMeta');
  if (!el) return;
  if (error) {
    el.innerHTML = `<span class="meta-error">${error}</span>`;
    return;
  }
  const parts = [];
  if (meta?.source === 'aggregated') {
    parts.push('<span class="meta-note">Indexed from BTC · scaled to global total</span>');
  }
  if (meta?.cachedAt) parts.push(`Updated ${formatTime(meta.cachedAt)}`);
  if (meta?.stale) parts.push('<span class="meta-stale">Showing cached data</span>');
  el.innerHTML = parts.join(' · ') || '';
}

export async function loadGlobalMarketChart(days = chartDays) {
  if (loading) return;
  loading = true;
  chartDays = days;

  const container = $('#globalMarketChart');
  if (container && !container.querySelector('.skeleton')) {
    container.innerHTML = '<div class="skeleton chart-skeleton"></div>';
  }

  $$('.global-chart-range').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.days) === days);
  });

  try {
    const { points, meta } = await api.getGlobalChart(days);
    if (container) container.innerHTML = '';
    renderChart(points);
    setMeta(meta);
    setLiveStatus(meta);
  } catch (err) {
    if (container) {
      container.innerHTML = `<div class="error-state">${err.message}</div>`;
    }
    setMeta(null, err.message);
    setLiveStatus({}, err.message);
  } finally {
    loading = false;
  }
}

export function initGlobalMarketChart() {
  $$('.global-chart-range').forEach((btn) => {
    btn.addEventListener('click', () => {
      const days = Number(btn.dataset.days) || 7;
      loadGlobalMarketChart(days);
    });
  });
}

export function resetGlobalMarketChart() {
  destroyChart();
  chartDays = 7;
}
