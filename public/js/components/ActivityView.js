import { api } from '../api.js';
import { formatUsd } from '../format.js';
import { ledgerTypeClass, formatLedgerAmount } from '../userDashboard.js';

const $ = (sel) => document.querySelector(sel);

let callbacks = {};
let activeFilter = 'all';
let cachedEntries = [];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'trades', label: 'Trades' },
  { id: 'deposits', label: 'Deposits & Received' },
  { id: 'withdrawals', label: 'Withdrawals & Sent' },
];

function formatRelativeTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function statusClass(status) {
  if (status === 'completed') return 'status-completed';
  if (status === 'pending') return 'status-pending';
  if (status === 'failed') return 'status-failed';
  return '';
}

function matchesFilter(entry, filter) {
  if (filter === 'all') return true;
  if (filter === 'trades') return entry.type === 'buy' || entry.type === 'sell';
  if (filter === 'deposits') return entry.type === 'deposit' || entry.type === 'received';
  if (filter === 'withdrawals') return entry.type === 'withdrawal' || entry.type === 'sent';
  return true;
}

function computeStats(entries) {
  return {
    total: entries.length,
    trades: entries.filter((e) => e.type === 'buy' || e.type === 'sell').length,
    deposits: entries.filter((e) => e.type === 'deposit' || e.type === 'received').length,
    withdrawals: entries.filter((e) => e.type === 'withdrawal' || e.type === 'sent').length,
  };
}

function renderActivityRow(entry) {
  const total = entry.total_usd != null ? formatUsd(entry.total_usd) : '—';
  const coinLine = entry.coin_name
    ? `<button type="button" class="activity-coin-link" data-coin-id="${entry.coin_id}">${entry.coin_name}</button>`
    : '';
  return `<tr class="activity-row" data-type="${entry.type}">
    <td class="activity-date-cell">
      <span class="activity-date-main">${formatRelativeTime(entry.created_at)}</span>
      <span class="activity-date-sub">${new Date(entry.created_at).toLocaleString()}</span>
    </td>
    <td><span class="ledger-type ${ledgerTypeClass(entry.type)}">${entry.label}</span></td>
    <td class="activity-desc-cell">
      <span class="activity-desc">${entry.description}</span>
      ${coinLine}
    </td>
    <td class="col-num">${formatLedgerAmount(entry)}</td>
    <td class="col-num activity-total">${total}</td>
    <td><span class="status-badge ${statusClass(entry.status)}">${entry.status}</span></td>
  </tr>`;
}

function renderGuest() {
  $('#activityGuest')?.classList.remove('hidden');
  $('#activityContent')?.classList.add('hidden');
}

function renderSignedInShell() {
  $('#activityGuest')?.classList.add('hidden');
  $('#activityContent')?.classList.remove('hidden');
}

function renderStats(entries) {
  const stats = computeStats(entries);
  const el = $('#activityStats');
  if (!el) return;
  el.innerHTML = `
    <div class="activity-stat"><span class="activity-stat-val">${stats.total}</span><span class="activity-stat-label">Total</span></div>
    <div class="activity-stat"><span class="activity-stat-val">${stats.trades}</span><span class="activity-stat-label">Trades</span></div>
    <div class="activity-stat"><span class="activity-stat-val">${stats.deposits}</span><span class="activity-stat-label">Deposits</span></div>
    <div class="activity-stat"><span class="activity-stat-val">${stats.withdrawals}</span><span class="activity-stat-label">Withdrawals</span></div>`;
}

function renderFilterTabs() {
  const el = $('#activityFilters');
  if (!el) return;
  el.innerHTML = FILTERS.map(
    (f) =>
      `<button type="button" class="activity-filter${activeFilter === f.id ? ' active' : ''}" data-filter="${f.id}">${f.label}</button>`
  ).join('');
}

function renderTable(entries) {
  const tbody = $('#activityTableBody');
  const filtered = entries.filter((e) => matchesFilter(e, activeFilter));
  const countEl = $('#activityCount');
  if (countEl) {
    countEl.textContent =
      activeFilter === 'all'
        ? `${entries.length} entries`
        : `${filtered.length} of ${entries.length} entries`;
  }
  if (!tbody) return;
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No activity in this category yet</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(renderActivityRow).join('');
}

function skeletonRows() {
  return Array.from(
    { length: 6 },
    () =>
      `<tr class="skeleton-row">${Array.from({ length: 6 }, () => '<td><div class="skeleton"></div></td>').join('')}</tr>`
  ).join('');
}

export function initActivityView(cbs = {}) {
  callbacks = cbs;

  $('#activitySignInBtn')?.addEventListener('click', () => callbacks.onSignIn?.());

  $('#activityFilters')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    renderFilterTabs();
    renderTable(cachedEntries);
  });

  $('#activityTableBody')?.addEventListener('click', (e) => {
    const link = e.target.closest('[data-coin-id]');
    if (link?.dataset.coinId) callbacks.onOpenCoin?.(link.dataset.coinId);
  });
}

export async function loadActivity() {
  if (!callbacks.getUser?.()) {
    renderGuest();
    return;
  }

  renderSignedInShell();
  renderFilterTabs();
  const tbody = $('#activityTableBody');
  if (tbody) tbody.innerHTML = skeletonRows();

  try {
    const { transactions } = await api.getTransactions(100);
    cachedEntries = transactions;
    renderStats(transactions);
    renderTable(transactions);
  } catch (err) {
    cachedEntries = [];
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="error-state">${err.message}</td></tr>`;
    }
  }
}

export function resetActivityFilter() {
  activeFilter = 'all';
  cachedEntries = [];
}
