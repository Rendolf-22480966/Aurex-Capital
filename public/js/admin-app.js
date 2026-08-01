import { adminApi } from './admin-api.js';
import { setToken, getToken } from './api.js';
import { formatUsd, formatNumber } from './format.js';

const state = {
  user: null,
  panel: 'overview',
  users: [],
  userFilter: 'all',
  selectedUserId: null,
  auditFilter: 'all',
  auditLogs: [],
  auditIntegrity: null,
};
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const PANEL_META = {
  overview: { title: 'Overview', sub: 'Platform statistics and system health' },
  users: { title: 'Users', sub: 'Manage accounts, balances, and account status' },
  audit: { title: 'Audit Log', sub: 'Tamper-evident record of all admin actions' },
};

function showToast(msg, type = 'success') {
  const el = $('#adminToast');
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add('hidden'), 4000);
}

function displayName(u) {
  if (!u) return '—';
  if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name}`;
  return u.email || u.username || '—';
}

function renderIntegrity(el, integrity) {
  if (!el) return;
  el.innerHTML = integrity.valid
    ? `<div class="audit-ok">✓ Audit chain verified — ${integrity.count} records · ${integrity.message}</div>`
    : `<div class="audit-bad">✗ ${integrity.message}</div>`;
}

function formatPayload(json) {
  try {
    const o = typeof json === 'string' ? JSON.parse(json) : json;
    return Object.entries(o)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  } catch {
    return String(json || '—');
  }
}

function shortHash(hash) {
  if (!hash) return '—';
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function renderAuditFilters(summary = []) {
  const el = $('#adminAuditFilters');
  if (!el) return;
  const total = summary.reduce((n, s) => n + s.count, 0);
  const tabs = [
    `<button class="admin-filter audit-filter ${state.auditFilter === 'all' ? 'active' : ''}" data-filter="all">All (${total})</button>`,
    ...summary.map(
      (s) =>
        `<button class="admin-filter audit-filter ${state.auditFilter === s.action ? 'active' : ''}" data-filter="${s.action}">${s.action} (${s.count})</button>`
    ),
  ];
  el.innerHTML = tabs.join('');
}

function renderChainStrip(records = []) {
  const el = $('#adminChainStrip');
  if (!el) return;
  if (!records.length) {
    el.classList.add('hidden');
    return;
  }
  const recent = records.slice(-12);
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="chain-strip-label">Chain links (latest ${recent.length})</div>
    <div class="chain-strip-track">
      ${recent
        .map(
          (r) =>
            `<button type="button" class="chain-node ${r.valid ? 'chain-ok' : 'chain-bad'}" data-seq="${r.sequence_num}" title="#${r.sequence_num} · ${r.action}">
          <span class="chain-seq">${r.sequence_num}</span>
          <span class="chain-dot"></span>
        </button>`
        )
        .join('<span class="chain-link"></span>')}
    </div>`;
}

function renderVerifyReport(report) {
  const el = $('#adminVerifyReport');
  if (!el) return;
  el.classList.remove('hidden');

  const broken = report.records?.find((r) => !r.valid);
  el.innerHTML = `
    <div class="verify-report-head ${report.valid ? 'verify-ok' : 'verify-bad'}">
      <strong>${report.valid ? '✓ Chain integrity verified' : '✗ Chain verification failed'}</strong>
      <span>${report.message}</span>
    </div>
    <div class="verify-report-meta">
      <span><em>Genesis</em> <code>${report.genesis}</code></span>
      ${report.head_hash ? `<span><em>Head hash</em> <code>${shortHash(report.head_hash)}</code></span>` : ''}
      <span><em>Records</em> ${report.count}</span>
    </div>
    ${
      broken
        ? `<div class="verify-break-detail">
        <strong>Break at sequence #${broken.sequence_num}</strong>
        <ul>
          <li>Previous link: ${broken.prev_ok ? 'OK' : 'MISMATCH'}</li>
          <li>Record hash: ${broken.hash_ok ? 'OK' : 'TAMPERED'}</li>
          <li>Stored hash: <code>${broken.record_hash}</code></li>
          <li>Expected hash: <code>${broken.expected_hash}</code></li>
        </ul>
      </div>`
        : ''
    }`;
}

function renderAuditTable(logs, integrity) {
  const brokenAt = integrity?.brokenAt;
  $('#adminAuditBody').innerHTML = logs.length
    ? logs
        .map((log) => {
          const broken = brokenAt && log.sequence_num >= brokenAt;
          const status = broken
            ? '<span class="chain-badge chain-badge-bad">BROKEN</span>'
            : '<span class="chain-badge chain-badge-ok">LINKED</span>';
          return `<tr class="audit-row ${broken ? 'audit-row-bad' : ''}" data-seq="${log.sequence_num}">
        <td>${log.sequence_num}</td>
        <td>${status}</td>
        <td><code>${log.action}</code></td>
        <td>${log.admin_email || log.admin_id}</td>
        <td>${log.target_email || log.target_user_id || '—'}</td>
        <td>${formatPayload(log.payload_json)}</td>
        <td><code class="audit-hash-link">${shortHash(log.record_hash)}</code></td>
        <td>${new Date(log.created_at).toLocaleString()}</td>
      </tr>`;
        })
        .join('')
    : '<tr><td colspan="8" class="empty-state">No audit records match this filter</td></tr>';
}

async function openAuditDetail(sequenceNum) {
  try {
    const { log, verification } = await adminApi.auditDetail(sequenceNum);
    let payloadPretty = log.payload_json;
    try {
      payloadPretty = JSON.stringify(JSON.parse(log.payload_json), null, 2);
    } catch {
      /* keep raw */
    }

    $('#auditDetailTitle').textContent = `Audit Record #${log.sequence_num}`;
    $('#auditDetailBody').innerHTML = `
      <div class="audit-detail-status ${verification.prev_ok && verification.hash_ok ? 'audit-detail-ok' : 'audit-detail-bad'}">
        ${verification.prev_ok && verification.hash_ok ? '✓ Record verified' : '✗ Verification failed'}
      </div>
      <div class="admin-detail-row"><span class="label">Action</span><span><code>${log.action}</code></span></div>
      <div class="admin-detail-row"><span class="label">Admin</span><span>${log.admin_email || log.admin_id}</span></div>
      <div class="admin-detail-row"><span class="label">Target</span><span>${log.target_email || log.target_user_id || '—'}</span></div>
      <div class="admin-detail-row"><span class="label">Time</span><span>${new Date(log.created_at).toLocaleString()}</span></div>
      <div class="audit-hash-block">
        <div class="audit-hash-row"><span class="label">Previous hash</span><code>${log.prev_hash}</code></div>
        <div class="audit-hash-row"><span class="label">Record hash</span><code>${log.record_hash}</code></div>
        <div class="audit-hash-row"><span class="label">Expected hash</span><code>${verification.expected_hash}</code></div>
      </div>
      <div class="audit-payload-block">
        <strong>Payload</strong>
        <pre>${payloadPretty}</pre>
      </div>
      <div class="audit-verify-flags">
        <span class="${verification.prev_ok ? 'flag-ok' : 'flag-bad'}">prev_hash ${verification.prev_ok ? '✓' : '✗'}</span>
        <span class="${verification.hash_ok ? 'flag-ok' : 'flag-bad'}">record_hash ${verification.hash_ok ? '✓' : '✗'}</span>
      </div>`;
    $('#adminAuditModal')?.classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeAuditDetail() {
  $('#adminAuditModal')?.classList.add('hidden');
}

async function runChainVerify() {
  try {
    const report = await adminApi.auditVerify();
    renderVerifyReport(report);
    renderChainStrip(report.records || []);
    renderIntegrity($('#adminAuditIntegrity'), {
      valid: report.valid,
      count: report.count,
      message: report.message,
    });
    showToast(report.valid ? 'Audit chain verified' : 'Chain verification failed', report.valid ? 'success' : 'error');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function exportAuditJson() {
  const payload = {
    exported_at: new Date().toISOString(),
    integrity: state.auditIntegrity,
    logs: state.auditLogs,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aurex-audit-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Audit log exported');
}
  try {
    const o = typeof json === 'string' ? JSON.parse(json) : json;
    return Object.entries(o)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  } catch {
    return String(json || '—');
  }
}

function filteredUsers() {
  if (state.userFilter === 'all') return state.users;
  return state.users.filter((u) => u.status === state.userFilter);
}

function userActionButtons(u) {
  if (u.role !== 'user') return '—';
  const name = displayName(u);
  const parts = [
    `<button class="btn-outline view-user" data-id="${u.id}">View</button>`,
    `<button class="btn-outline admin-act" data-action="deposit" data-id="${u.id}" data-name="${name}">+$</button>`,
    `<button class="btn-outline admin-act" data-action="withdraw" data-id="${u.id}" data-name="${name}">−$</button>`,
    `<button class="btn-outline admin-act" data-action="crypto" data-id="${u.id}" data-name="${name}">+₿</button>`,
  ];
  if (u.status === 'active') {
    parts.push(`<button class="btn-outline btn-warn suspend-user" data-id="${u.id}">Suspend</button>`);
  } else if (u.status === 'suspended') {
    parts.push(`<button class="btn-outline activate-user" data-id="${u.id}">Activate</button>`);
  }
  if (u.status !== 'deleted') {
    parts.push(`<button class="btn-outline reset-user" data-id="${u.id}">Reset</button>`);
    parts.push(`<button class="btn-outline btn-danger delete-user" data-id="${u.id}">Delete</button>`);
  }
  return parts.join('');
}

function renderUsersTable() {
  const users = filteredUsers();
  $('#adminUsersBody').innerHTML = users.length
    ? users
        .map(
          (u) => `<tr>
      <td>${displayName(u)}${u.role === 'admin' ? ' <span class="badge-role-admin">ADMIN</span>' : ''}</td>
      <td>${u.email || '—'}</td>
      <td><span class="badge-${u.status}">${u.status}</span></td>
      <td>${formatUsd(u.balance_usd)}</td>
      <td>${u.trade_count ?? 0}</td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td class="admin-actions">${userActionButtons(u)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="7" class="empty-state">No users match this filter</td></tr>';
}

function showPanel(name) {
  state.panel = name;
  $$('.admin-panel').forEach((p) => p.classList.remove('active'));
  $$('.admin-nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.panel === name));
  $(`#panel${name.charAt(0).toUpperCase()}${name.slice(1)}`)?.classList.add('active');
  $('#adminPageTitle').textContent = PANEL_META[name]?.title || name;
  $('#adminPageSub').textContent = PANEL_META[name]?.sub || '';
  if (name === 'overview') loadOverview();
  if (name === 'users') loadUsers();
  if (name === 'audit') loadAudit();
}

function showLogin() {
  $('#adminLogin')?.classList.remove('hidden');
  $('#adminApp')?.classList.add('hidden');
}

function showConsole() {
  $('#adminLogin')?.classList.add('hidden');
  $('#adminApp')?.classList.remove('hidden');
  $('#adminUserLabel').textContent = displayName(state.user);
  showPanel(state.panel);
}

async function initAuth() {
  if (!getToken()) {
    showLogin();
    return;
  }
  try {
    const { user } = await adminApi.me();
    if (user.role !== 'admin') {
      setToken(null);
      showLogin();
      $('#adminLoginError').textContent = 'Admin access required';
      return;
    }
    state.user = user;
    showConsole();
  } catch {
    setToken(null);
    showLogin();
  }
}

async function loadOverview() {
  try {
    const [{ stats }, audit] = await Promise.all([adminApi.users(), adminApi.audit(8)]);
    $('#adminOverviewStats').innerHTML = `
      <div class="stat-card highlight"><div class="stat-label">Active Users</div><div class="stat-value">${stats.user_count}</div></div>
      <div class="stat-card"><div class="stat-label">Suspended</div><div class="stat-value">${stats.suspended_count ?? 0}</div></div>
      <div class="stat-card"><div class="stat-label">Deleted</div><div class="stat-value">${stats.deleted_count ?? 0}</div></div>
      <div class="stat-card"><div class="stat-label">Audit Records</div><div class="stat-value">${audit.integrity.count}</div></div>`;
    renderIntegrity($('#adminIntegrity'), audit.integrity);
    $('#adminRecentAudit').innerHTML = audit.logs.length
      ? audit.logs
          .map(
            (log) => `<div class="admin-audit-item">
          <strong>${log.action}</strong>
          <span>${log.target_email || '—'} · ${new Date(log.created_at).toLocaleString()}</span>
        </div>`
          )
          .join('')
      : '<p class="empty-state">No admin actions recorded yet</p>';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadUsers() {
  try {
    const { users } = await adminApi.users();
    state.users = users;
    renderUsersTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openUserDetail(userId) {
  try {
    const detail = await adminApi.userDetail(userId);
    state.selectedUserId = userId;
    const { user, holdings, stats, recent_transactions } = detail;
    $('#userDetailTitle').textContent = displayName(user);
    $('#userDetailBody').innerHTML = `
      <div class="admin-detail-row"><span class="label">Email</span><span>${user.email || '—'}</span></div>
      <div class="admin-detail-row"><span class="label">Status</span><span class="badge-${user.status}">${user.status}</span></div>
      <div class="admin-detail-row"><span class="label">Balance</span><span>${formatUsd(user.balance_usd)}</span></div>
      <div class="admin-detail-row"><span class="label">Trades</span><span>${stats.trade_count ?? 0}</span></div>
      <div class="admin-detail-row"><span class="label">Transactions</span><span>${stats.total_transactions ?? 0}</span></div>
      <div class="admin-detail-row"><span class="label">Member since</span><span>${new Date(user.created_at).toLocaleDateString()}</span></div>
      ${
        holdings.length
          ? `<div class="admin-detail-holdings"><strong>Holdings</strong><ul>${holdings
              .map(
                (h) =>
                  `<li>${h.coin_symbol} — ${formatNumber(h.quantity)} @ ${formatUsd(h.avg_cost_usd)}</li>`
              )
              .join('')}</ul></div>`
          : ''
      }
      ${
        recent_transactions.length
          ? `<div class="admin-detail-holdings"><strong>Recent activity</strong><ul>${recent_transactions
              .map((t) => `<li>${t.type}: ${t.description}</li>`)
              .join('')}</ul></div>`
          : ''
      }`;
    $('#userDetailActions').innerHTML = userActionButtons(user).replaceAll('btn-outline ', 'btn btn-sm ');
    $('#adminUserModal')?.classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeUserDetail() {
  $('#adminUserModal')?.classList.add('hidden');
  state.selectedUserId = null;
}

async function loadAudit() {
  try {
    const action = state.auditFilter === 'all' ? null : state.auditFilter;
    const { integrity, logs, actionSummary } = await adminApi.audit(100, action);
    state.auditLogs = logs;
    state.auditIntegrity = integrity;
    renderIntegrity($('#adminAuditIntegrity'), integrity);
    renderAuditFilters(actionSummary);
    renderAuditTable(logs, integrity);

    const verifyEl = $('#adminVerifyReport');
    if (verifyEl?.classList.contains('hidden')) {
      const report = await adminApi.auditVerify();
      renderChainStrip(report.records || []);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openAdminAction(action, userId, userName) {
  $('#adminActionModal')?.classList.remove('hidden');
  $('#adminActionError').textContent = '';
  $('#adminActionUserId').value = userId;
  $('#adminActionType').value = action;
  $('#adminActionUser').textContent = userName;
  const titles = { deposit: 'Add Funds', withdraw: 'Remove Funds', crypto: 'Credit Crypto' };
  $('#adminActionTitle').textContent = titles[action] || 'Admin Action';
  $('#adminAmountWrap')?.classList.toggle('hidden', action === 'crypto');
  $('#adminCryptoFields')?.classList.toggle('hidden', action !== 'crypto');
}

function closeAdminAction() {
  $('#adminActionModal')?.classList.add('hidden');
  $('#adminActionForm')?.reset();
}

async function refreshAfterUserChange() {
  await loadUsers();
  if (state.selectedUserId) await openUserDetail(state.selectedUserId);
  if (state.panel === 'overview') loadOverview();
  if (state.panel === 'audit') loadAudit();
}

async function handleUserTableClick(e) {
  const view = e.target.closest('.view-user');
  if (view) {
    openUserDetail(view.dataset.id);
    return;
  }

  const act = e.target.closest('.admin-act');
  if (act) {
    openAdminAction(act.dataset.action, act.dataset.id, act.dataset.name);
    return;
  }

  const suspend = e.target.closest('.suspend-user');
  if (suspend) {
    const reason = prompt('Suspension reason (optional):') ?? '';
    try {
      await adminApi.suspend(suspend.dataset.id, reason);
      showToast('User suspended');
      refreshAfterUserChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
    return;
  }

  const activate = e.target.closest('.activate-user');
  if (activate) {
    try {
      await adminApi.activate(activate.dataset.id);
      showToast('User activated');
      refreshAfterUserChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
    return;
  }

  const del = e.target.closest('.delete-user');
  if (del) {
    if (!confirm('Permanently delete this account? The user will not be able to sign in again.')) return;
    const reason = prompt('Deletion reason (optional):') ?? '';
    try {
      await adminApi.deleteUser(del.dataset.id, reason);
      showToast('User deleted');
      closeUserDetail();
      refreshAfterUserChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
    return;
  }

  const reset = e.target.closest('.reset-user');
  if (reset) {
    if (!confirm('Reset this account to $10,000 and clear holdings?')) return;
    try {
      await adminApi.reset(reset.dataset.id);
      showToast('Account reset');
      refreshAfterUserChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

function bindEvents() {
  $$('.admin-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => showPanel(btn.dataset.panel));
  });

  $('#adminAuditFilters')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.audit-filter');
    if (!btn) return;
    state.auditFilter = btn.dataset.filter;
    loadAudit();
  });

  $$('.admin-filter:not(.audit-filter)').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.userFilter = btn.dataset.filter;
      $$('.admin-filter:not(.audit-filter)').forEach((b) => b.classList.toggle('active', b === btn));
      renderUsersTable();
    });
  });

  $('#adminVerifyChainBtn')?.addEventListener('click', runChainVerify);
  $('#adminExportAuditBtn')?.addEventListener('click', exportAuditJson);
  $('#adminAuditBody')?.addEventListener('click', (e) => {
    const row = e.target.closest('.audit-row');
    if (row) openAuditDetail(row.dataset.seq);
  });
  $('#adminChainStrip')?.addEventListener('click', (e) => {
    const node = e.target.closest('.chain-node');
    if (node) openAuditDetail(node.dataset.seq);
  });
  $('#closeAuditModal')?.addEventListener('click', closeAuditDetail);
  $('#adminAuditModal .modal-backdrop')?.addEventListener('click', closeAuditDetail);

  $('#adminLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#adminLoginError').textContent = '';
    try {
      const { token, user } = await adminApi.login(
        $('#adminLoginEmail').value.trim(),
        $('#adminLoginPassword').value
      );
      if (user.role !== 'admin') throw new Error('This account does not have admin access');
      setToken(token);
      state.user = user;
      showConsole();
    } catch (err) {
      $('#adminLoginError').textContent = err.message;
    }
  });

  $('#adminLogoutBtn')?.addEventListener('click', async () => {
    try {
      await adminApi.logout();
    } catch {
      /* ignore */
    }
    setToken(null);
    state.user = null;
    showLogin();
  });

  $('#adminUsersBody')?.addEventListener('click', handleUserTableClick);
  $('#userDetailActions')?.addEventListener('click', handleUserTableClick);

  $('#closeUserModal')?.addEventListener('click', closeUserDetail);
  $('#adminUserModal .modal-backdrop')?.addEventListener('click', closeUserDetail);
  $('#closeAdminModal')?.addEventListener('click', closeAdminAction);
  $('#adminActionModal .modal-backdrop')?.addEventListener('click', closeAdminAction);

  $('#adminActionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = $('#adminActionUserId').value;
    const action = $('#adminActionType').value;
    const note = $('#adminNote').value.trim();
    try {
      if (action === 'deposit') {
        await adminApi.deposit(userId, Number($('#adminAmount').value), note);
      } else if (action === 'withdraw') {
        await adminApi.withdraw(userId, Number($('#adminAmount').value), note);
      } else if (action === 'crypto') {
        await adminApi.creditCrypto(userId, {
          coinId: $('#adminCoinId').value.trim(),
          coinSymbol: $('#adminCoinSymbol').value.trim(),
          coinName: $('#adminCoinSymbol').value.trim(),
          quantity: Number($('#adminCoinQty').value),
          priceUsd: Number($('#adminCoinPrice').value) || 0,
          note,
        });
      }
      closeAdminAction();
      showToast('Action completed');
      refreshAfterUserChange();
    } catch (err) {
      $('#adminActionError').textContent = err.message;
    }
  });
}

bindEvents();
initAuth();
