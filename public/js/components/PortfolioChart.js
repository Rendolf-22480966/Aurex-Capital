import { formatUsd, formatPct, formatNumber, pctClass } from '../format.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let lineChart = null;
let areaSeries = null;
let chartTab = 'line';
let chartDays = 60;
let dashboardData = null;
let resizeObserver = null;

const DAY_SECONDS = 86400;

function destroyLineChart() {
  if (lineChart) {
    lineChart.remove();
    lineChart = null;
    areaSeries = null;
  }
}

function filterHistoryByDays(points, days) {
  if (!points?.length) return [];
  if (days === 'all' || days <= 0) return points;
  const cutoff = Math.floor(Date.now() / 1000) - Number(days) * DAY_SECONDS;
  const filtered = points.filter((p) => p.time >= cutoff);
  if (filtered.length >= 2) return filtered;
  const last = points[points.length - 1];
  const first = points.find((p) => p.time <= cutoff) || points[0];
  return [
    { time: cutoff, value: first.value },
    { time: last.time, value: last.value },
  ];
}

function renderLineChart(container, history, summary) {
  if (!container || !window.LightweightCharts) {
    container.innerHTML = '<div class="dash-chart-empty">Chart library unavailable</div>';
    return;
  }

  destroyLineChart();
  container.innerHTML = '<div class="dash-line-mount"></div>';
  const mount = container.querySelector('.dash-line-mount');
  if (!mount) return;

  const filtered = filterHistoryByDays(history, chartDays);
  const startVal = filtered[0]?.value ?? summary?.total_value ?? 0;
  const endVal = filtered[filtered.length - 1]?.value ?? summary?.total_value ?? 0;
  const change = endVal - startVal;
  const changePct = startVal > 0 ? (change / startVal) * 100 : 0;
  const isUp = change >= 0;
  const lineColor = isUp ? '#16c784' : '#ea3943';

  lineChart = window.LightweightCharts.createChart(mount, {
    width: container.clientWidth,
    height: container.clientHeight || 220,
    layout: {
      background: { color: 'transparent' },
      textColor: '#64748b',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    grid: {
      vertLines: { color: 'rgba(226, 232, 240, 0.85)' },
      horzLines: { color: 'rgba(226, 232, 240, 0.85)' },
    },
    rightPriceScale: {
      borderColor: '#e2e8f0',
      scaleMargins: { top: 0.12, bottom: 0.08 },
    },
    timeScale: {
      borderColor: '#e2e8f0',
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: window.LightweightCharts?.CrosshairMode?.Normal ?? 0,
    },
  });

  areaSeries = lineChart.addAreaSeries({
    lineColor,
    topColor: isUp ? 'rgba(22, 199, 132, 0.28)' : 'rgba(234, 57, 67, 0.22)',
    bottomColor: isUp ? 'rgba(22, 199, 132, 0.02)' : 'rgba(234, 57, 67, 0.02)',
    lineWidth: 2,
    priceFormat: {
      type: 'custom',
      formatter: (v) => formatUsd(v),
    },
  });

  const data = filtered.filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value));
  if (data.length) {
    areaSeries.setData(data);
    lineChart.timeScale().fitContent();
  }

  const meta = document.createElement('div');
  meta.className = `dash-chart-live-meta ${isUp ? 'pos' : 'neg'}`;
  meta.innerHTML = `<span class="dash-chart-live-label">Live portfolio</span>
    <strong>${formatUsd(endVal)}</strong>
    <span>${change >= 0 ? '+' : ''}${formatUsd(change)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%) in range</span>`;
  container.appendChild(meta);

  const onResize = () => {
    if (lineChart && mount && container) {
      lineChart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight || 220,
      });
    }
  };

  if (resizeObserver) resizeObserver.disconnect();
  resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);
}

function describeDonutSlice(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const x1 = cx + rOuter * Math.cos(startAngle);
  const y1 = cy + rOuter * Math.sin(startAngle);
  const x2 = cx + rOuter * Math.cos(endAngle);
  const y2 = cy + rOuter * Math.sin(endAngle);
  const x3 = cx + rInner * Math.cos(endAngle);
  const y3 = cy + rInner * Math.sin(endAngle);
  const x4 = cx + rInner * Math.cos(startAngle);
  const y4 = cy + rInner * Math.sin(startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

function renderPieChart(container, allocation, summary) {
  destroyLineChart();
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  const slices = (allocation || []).filter((s) => s.pct > 0.01);
  if (!slices.length) {
    container.innerHTML = '<div class="dash-chart-empty">No allocation data yet — start trading to see your pie chart.</div>';
    return;
  }

  const cx = 110;
  const cy = 110;
  const outerR = 88;
  const innerR = 52;
  let angle = -Math.PI / 2;
  const paths = [];

  for (const slice of slices) {
    const sweep = (slice.pct / 100) * Math.PI * 2;
    const endAngle = angle + sweep;
    const d = describeDonutSlice(cx, cy, outerR, innerR, angle, endAngle);
    paths.push({ d, slice });
    angle = endAngle;
  }

  const legend = slices
    .map(
      (s) =>
        `<div class="dash-pie-legend-item">
          <span class="alloc-dot" style="background:${s.color}"></span>
          <span class="dash-pie-legend-label">${s.label}</span>
          <span class="dash-pie-legend-val">${formatUsd(s.value)}</span>
          <span class="dash-pie-legend-pct">${s.pct.toFixed(1)}%</span>
        </div>`
    )
    .join('');

  container.innerHTML = `
    <div class="dash-pie-wrap">
      <svg viewBox="0 0 220 220" class="dash-pie-svg" role="img" aria-label="Portfolio allocation pie chart">
        ${paths
          .map(
            ({ d, slice }) =>
              `<path d="${d}" fill="${slice.color}" stroke="#fff" stroke-width="1.5">
                <title>${slice.label}: ${slice.pct.toFixed(1)}% (${formatUsd(slice.value)})</title>
              </path>`
          )
          .join('')}
        <circle cx="${cx}" cy="${cy}" r="${innerR - 4}" fill="#fff"/>
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" class="dash-pie-center-label">Total</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="dash-pie-center-value">${formatUsd(summary?.total_value ?? 0)}</text>
      </svg>
      <div class="dash-pie-legend">${legend}</div>
    </div>
    <div class="dash-chart-live-meta">
      <span class="dash-chart-live-label">Live allocation</span>
      <span>${slices.length} assets · updated now</span>
    </div>`;
}

function renderStatistics(container, data) {
  destroyLineChart();
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  const { summary, holdings, stats, allocation } = data;
  const best = holdings.length
    ? [...holdings].sort((a, b) => b.profit_loss_pct - a.profit_loss_pct)[0]
    : null;
  const worst = holdings.length
    ? [...holdings].sort((a, b) => a.profit_loss_pct - b.profit_loss_pct)[0]
    : null;
  const cryptoPct =
    summary.total_value > 0 ? (summary.holdings_value / summary.total_value) * 100 : 0;
  const cashPct =
    summary.total_value > 0 ? (summary.cash_balance / summary.total_value) * 100 : 0;
  const avgHolding =
    holdings.length > 0 ? summary.holdings_value / holdings.length : 0;
  const winners = holdings.filter((h) => h.profit_loss >= 0).length;
  const winRate = holdings.length ? (winners / holdings.length) * 100 : 0;

  const holdingRows = holdings
    .map(
      (h) => `<tr>
        <td><span class="alloc-dot" style="background:${allocation.find((a) => a.id === h.coin_id)?.color || '#64748b'}"></span> ${h.coin_symbol}</td>
        <td>${formatUsd(h.current_value)}</td>
        <td class="${pctClass(h.change_24h_pct)}">${formatPct(h.change_24h_pct)}</td>
        <td class="${pctClass(h.profit_loss)}">${formatUsd(h.profit_loss)}</td>
        <td class="${pctClass(h.profit_loss_pct)}">${formatPct(h.profit_loss_pct)}</td>
      </tr>`
    )
    .join('');

  container.innerHTML = `
    <div class="dash-stats-panel">
      <div class="dash-stats-grid">
        <div class="dash-stat-box"><span class="label">Total portfolio</span><strong>${formatUsd(summary.total_value)}</strong></div>
        <div class="dash-stat-box"><span class="label">Available cash</span><strong>${formatUsd(summary.cash_balance)}</strong></div>
        <div class="dash-stat-box"><span class="label">Holdings value</span><strong>${formatUsd(summary.holdings_value)}</strong></div>
        <div class="dash-stat-box"><span class="label">All-time P/L</span><strong class="${pctClass(summary.profit_loss)}">${formatUsd(summary.profit_loss)} (${formatPct(summary.profit_loss_pct)})</strong></div>
        <div class="dash-stat-box"><span class="label">24h change</span><strong class="${pctClass(summary.change_24h_usd)}">${formatUsd(summary.change_24h_usd)} (${formatPct(summary.change_24h_pct)})</strong></div>
        <div class="dash-stat-box"><span class="label">Net deposited</span><strong>${formatUsd(summary.starting_balance)}</strong></div>
        <div class="dash-stat-box"><span class="label">Crypto exposure</span><strong>${cryptoPct.toFixed(1)}%</strong></div>
        <div class="dash-stat-box"><span class="label">Cash allocation</span><strong>${cashPct.toFixed(1)}%</strong></div>
        <div class="dash-stat-box"><span class="label">Assets held</span><strong>${holdings.length}</strong></div>
        <div class="dash-stat-box"><span class="label">Avg. holding size</span><strong>${formatUsd(avgHolding)}</strong></div>
        <div class="dash-stat-box"><span class="label">Win rate (P/L)</span><strong>${winRate.toFixed(0)}%</strong></div>
        <div class="dash-stat-box"><span class="label">Total trades</span><strong>${stats.trade_count ?? 0}</strong></div>
      </div>
      <div class="dash-stats-highlights">
        ${best ? `<div class="dash-stat-highlight pos"><span>Best performer</span><strong>${best.coin_symbol}</strong><em>${formatPct(best.profit_loss_pct)}</em></div>` : ''}
        ${worst ? `<div class="dash-stat-highlight neg"><span>Weakest performer</span><strong>${worst.coin_symbol}</strong><em>${formatPct(worst.profit_loss_pct)}</em></div>` : ''}
      </div>
      ${
        holdings.length
          ? `<div class="dash-stats-table-wrap">
        <table class="dash-stats-table">
          <thead><tr><th>Asset</th><th>Value</th><th>24h</th><th>P/L $</th><th>P/L %</th></tr></thead>
          <tbody>${holdingRows}</tbody>
        </table>
      </div>`
          : '<p class="dash-chart-empty">No holdings yet.</p>'
      }
    </div>`;
}

function updateTabUi() {
  $$('.dash-tab[data-dash-chart]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.dashChart === chartTab);
  });

  const tfBar = $('.dash-timeframes');
  if (tfBar) {
    tfBar.classList.toggle('hidden', chartTab !== 'line');
  }

  $$('.dash-tf[data-dash-days]').forEach((el) => {
    const val = el.dataset.dashDays;
    const active =
      val === 'all' ? chartDays === 'all' : Number(val) === Number(chartDays);
    el.classList.toggle('active', active);
  });
}

function renderActiveView() {
  const container = $('#dashPortfolioChart');
  if (!container || !dashboardData) return;

  container.classList.remove('dash-portfolio-chart-line', 'dash-portfolio-chart-pie', 'dash-portfolio-chart-stats');
  container.classList.add(`dash-portfolio-chart-${chartTab}`);

  if (chartTab === 'line') {
    renderLineChart(container, dashboardData.portfolio_history, dashboardData.summary);
  } else if (chartTab === 'pie') {
    renderPieChart(container, dashboardData.allocation, dashboardData.summary);
  } else {
    renderStatistics(container, dashboardData);
  }

  updateTabUi();
}

export function initPortfolioChart() {
  $$('.dash-tab[data-dash-chart]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      chartTab = btn.dataset.dashChart || 'line';
      renderActiveView();
    });
  });

  $$('.dash-tf[data-dash-days]').forEach((el) => {
    el.addEventListener('click', () => {
      const val = el.dataset.dashDays;
      chartDays = val === 'all' ? 'all' : Number(val) || 60;
      if (chartTab === 'line') renderActiveView();
      else updateTabUi();
    });
  });
}

export function updatePortfolioChart(data) {
  dashboardData = data;
  renderActiveView();
}

export function refreshPortfolioChartLive(summary) {
  if (!dashboardData || !summary) return;
  dashboardData.summary = { ...dashboardData.summary, ...summary };
  const history = dashboardData.portfolio_history;
  if (history?.length) {
    const last = history[history.length - 1];
    last.time = Math.floor(Date.now() / 1000);
    last.value = summary.total_value;
  }
  if (chartTab === 'line') renderActiveView();
}

export function destroyPortfolioChart() {
  destroyLineChart();
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  dashboardData = null;
}
