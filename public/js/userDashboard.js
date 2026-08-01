import { api } from './api.js';
import { formatUsd, formatPct, formatNumber, pctClass } from './format.js';

const $ = (sel) => document.querySelector(sel);
let callbacks = {};
let refreshTimer = null;

function ledgerTypeClass(type) {
  if (type === 'buy' || type === 'deposit' || type === 'received') return 'ledger-in';
  if (type === 'sell' || type === 'withdrawal' || type === 'sent') return 'ledger-out';
  return '';
}

function formatLedgerAmount(entry) {
  if (entry.side === 'buy' || entry.side === 'sell') {
    return `${formatNumber(entry.amount_coin)} ${entry.coin_symbol || entry.currency}`;
  }
  if (entry.currency === 'USD') return formatUsd(entry.amount);
  return `${formatNumber(entry.amount)} ${entry.currency}`;
}

function renderActivityRow(entry) {
  const total = entry.total_usd != null ? formatUsd(entry.total_usd) : formatLedgerAmount(entry);
  return `<div class="dash-activity-item">
    <div class="dash-activity-top">
      <span class="ledger-type ${ledgerTypeClass(entry.type)}">${entry.label}</span>
      <span class="dash-activity-date">${new Date(entry.created_at).toLocaleDateString()}</span>
    </div>
    <div class="dash-activity-desc">${entry.description}</div>
    <div class="dash-activity-amt">${total}</div>
  </div>`;
}

function renderAllocationBar(slices) {
  if (!slices.length) return '<div class="alloc-bar empty"></div>';
  const segments = slices
    .map(
      (s) =>
        `<div class="alloc-segment" style="width:${Math.max(s.pct, 0.5)}%;background:${s.color}" title="${s.label}: ${s.pct.toFixed(1)}%"></div>`
    )
    .join('');
  const legend = slices
    .map(
      (s) =>
        `<div class="alloc-legend-item"><span class="alloc-dot" style="background:${s.color}"></span>${s.label}<span class="alloc-pct">${s.pct.toFixed(1)}%</span></div>`
    )
    .join('');
  return `<div class="alloc-bar">${segments}</div><div class="alloc-legend">${legend}</div>`;
}

function renderGuest() {
  $('#dashGuest')?.classList.remove('hidden');
  $('#dashContent')?.classList.add('hidden');
}

function renderDashboard(data) {
  $('#dashGuest')?.classList.add('hidden');
  $('#dashContent')?.classList.remove('hidden');

  const { account, summary, allocation, holdings, recent_activity, stats } = data;
  const plClass = pctClass(summary.profit_loss);

  $('#dashGreeting').textContent = `Welcome back, ${account.display_name}`;
  $('#dashTotalValue').textContent = formatUsd(summary.total_value);
  $('#dashTotalValue').className = 'dash-hero-value';
  $('#dashPlBadge').innerHTML = `<span class="${plClass}">${formatUsd(summary.profit_loss)} (${formatPct(summary.profit_loss_pct)})</span> all-time`;

  $('#dashStats').innerHTML = `
    <div class="stat-card highlight"><div class="stat-label">Total Portfolio</div><div class="stat-value">${formatUsd(summary.total_value)}</div></div>
    <div class="stat-card"><div class="stat-label">Available Cash</div><div class="stat-value">${formatUsd(summary.cash_balance)}</div></div>
    <div class="stat-card"><div class="stat-label">Holdings Value</div><div class="stat-value">${formatUsd(summary.holdings_value)}</div></div>
    <div class="stat-card"><div class="stat-label">Net Deposited</div><div class="stat-value">${formatUsd(summary.starting_balance)}</div></div>`;

  $('#dashAllocation').innerHTML = renderAllocationBar(allocation);

  $('#dashHoldingsBody').innerHTML = holdings.length
    ? holdings
        .map(
          (h) => `<tr class="dash-holding-row" data-coin-id="${h.coin_id}">
        <td><div class="coin-name">${h.coin_name}</div><div class="coin-symbol">${h.coin_symbol}</div></td>
        <td>${formatNumber(h.amount)}</td><td>${formatUsd(h.avg_buy_price)}</td>
        <td>${formatUsd(h.current_price)}</td><td>${formatUsd(h.current_value)}</td>
        <td class="${pctClass(h.profit_loss)}">${formatUsd(h.profit_loss)} (${formatPct(h.profit_loss_pct)})</td>
        <td><button class="btn btn-ghost btn-sm dash-trade-btn" data-coin-id="${h.coin_id}">Trade</button></td></tr>`
        )
        .join('')
    : '<tr><td colspan="7" class="empty-state">No holdings yet — <button type="button" class="link-btn" id="dashBrowseMarkets">browse markets</button> to start trading</td></tr>';

  $('#dashAccount').innerHTML = `
    <div class="dash-account-row"><span class="label">Name</span><span>${account.display_name}</span></div>
    <div class="dash-account-row"><span class="label">Email</span><span>${account.email || '—'}</span></div>
    <div class="dash-account-row"><span class="label">Status</span><span class="badge-${account.status}">${account.status}</span></div>
    <div class="dash-account-row"><span class="label">Email verified</span><span>${account.email_verified ? 'Yes' : 'Pending'}</span></div>
    <div class="dash-account-row"><span class="label">Member since</span><span>${new Date(account.member_since).toLocaleDateString()}</span></div>`;

  $('#dashStatsMini').innerHTML = `
    <div class="dash-stat-pill"><span>${stats.trade_count ?? 0}</span> trades</div>
    <div class="dash-stat-pill"><span>${stats.deposit_count ?? 0}</span> deposits</div>
    <div class="dash-stat-pill"><span>${stats.total_transactions ?? 0}</span> transactions</div>`;

  $('#dashActivity').innerHTML = recent_activity.length
    ? recent_activity.map(renderActivityRow).join('')
    : '<p class="empty-state">No activity yet</p>';
}

export function initUserDashboard(cbs = {}) {
  callbacks = cbs;

  $('#dashSignInBtn')?.addEventListener('click', () => callbacks.onSignIn?.());
  $('#dashBrowseMarkets')?.addEventListener('click', () => callbacks.onNavigate?.('markets'));
  $('#dashViewActivity')?.addEventListener('click', () => callbacks.onNavigate?.('trades'));
  $('#dashExploreBtn')?.addEventListener('click', () => callbacks.onNavigate?.('markets'));

  $('#dashHoldingsBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.dash-trade-btn');
    const row = e.target.closest('.dash-holding-row');
    const coinId = btn?.dataset.coinId || row?.dataset.coinId;
    if (coinId) callbacks.onOpenCoin?.(coinId);
  });

  $('#dashContent')?.addEventListener('click', (e) => {
    if (e.target.id === 'dashBrowseMarkets') callbacks.onNavigate?.('markets');
  });
}

export async function loadUserDashboard() {
  if (!callbacks.getUser?.()) {
    renderGuest();
    return null;
  }

  try {
    const data = await api.getUserDashboard();
    renderDashboard(data);
    callbacks.onUserUpdate?.(data);
    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function loadOverviewWidget() {
  const el = $('#overviewUserDash');
  if (!el || !callbacks.getUser?.()) {
    el?.classList.add('hidden');
    return;
  }

  try {
    const data = await api.getUserDashboard();
    el.classList.remove('hidden');
    const plClass = pctClass(data.summary.profit_loss);
    el.innerHTML = `
      <div class="overview-dash-header">
        <h2>Your Portfolio</h2>
        <button type="button" class="link-btn" id="overviewDashLink">Open Dashboard →</button>
      </div>
      <div class="overview-dash-stats">
        <div><span class="label">Total Value</span><strong>${formatUsd(data.summary.total_value)}</strong></div>
        <div><span class="label">Cash</span><strong>${formatUsd(data.summary.cash_balance)}</strong></div>
        <div><span class="label">P/L</span><strong class="${plClass}">${formatUsd(data.summary.profit_loss)} (${formatPct(data.summary.profit_loss_pct)})</strong></div>
        <div><span class="label">Holdings</span><strong>${data.holdings.length} assets</strong></div>
      </div>`;
    $('#overviewDashLink')?.addEventListener('click', () => callbacks.onNavigate?.('dashboard'));
  } catch {
    el.classList.add('hidden');
  }
}

export function onDashboardActivated() {
  loadUserDashboard();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadUserDashboard, 60_000);
}

export function onDashboardDeactivated() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

export { renderActivityRow, ledgerTypeClass, formatLedgerAmount };
