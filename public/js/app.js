import { api, getToken, setToken } from './api.js';
import { formatUsd, formatPct, formatNumber, pctClass } from './format.js';
import { initDashboard, onViewActivated, openCoin, dashboardState } from './dashboard.js';

const state = { user: null, currentView: 'overview' };
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showView(name) {
  state.currentView = name;
  $$('.view').forEach((v) => v.classList.remove('active'));
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $(`#view${capitalize(name)}`)?.classList.add('active');
  if (['overview', 'markets', 'trending', 'gainers', 'losers', 'watchlist', 'coin'].includes(name)) {
    onViewActivated(name);
  }
  if (name === 'portfolio') loadPortfolio();
  if (name === 'trades') loadPortfolio(true);
  if (name === 'admin') loadAdmin();
}

function capitalize(s) {
  if (s === 'coin') return 'CoinDetail';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function updateAuthUI() {
  const loggedIn = !!state.user;
  $('#userPanel')?.classList.toggle('hidden', !loggedIn);
  $('#loginBtn')?.classList.toggle('hidden', loggedIn);
  $$('.admin-only').forEach((el) => {
    el.classList.toggle('hidden', !(loggedIn && state.user?.role === 'admin'));
  });
  if (loggedIn) {
    $('#headerBalance').textContent = formatUsd(state.user.balance_usd);
    $('#headerUsername').textContent = state.user.username;
  }
}

function openAuth(mode = 'login') {
  $('#authModal')?.classList.remove('hidden');
  $('#authError').textContent = '';
  const isLogin = mode === 'login';
  $('#authTitle').textContent = isLogin ? 'Sign In' : 'Create Account';
  $('#authSubmit').textContent = isLogin ? 'Sign In' : 'Register';
  $('#authSwitchText').textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
  $('#authSwitchBtn').textContent = isLogin ? 'Register' : 'Sign In';
  $('#authForm').dataset.mode = mode;
}

function closeAuth() {
  $('#authModal')?.classList.add('hidden');
  $('#authForm')?.reset();
}

async function initAuth() {
  if (!getToken()) return;
  try {
    const { user } = await api.me();
    state.user = user;
    updateAuthUI();
  } catch {
    setToken(null);
  }
}

async function executeTrade() {
  const box = $('#tradeBox');
  const msg = $('#tradeMessage');
  msg.textContent = '';
  msg.className = 'trade-message';

  if (!state.user) {
    openAuth('login');
    return;
  }

  const coinId = box?.dataset.coinId;
  const amountCoin = Number($('#tradeAmount')?.value);
  if (!coinId || !amountCoin || amountCoin <= 0) {
    msg.textContent = 'Enter a valid amount';
    msg.classList.add('error');
    return;
  }

  const side = dashboardState.tradeSide || 'buy';
  try {
    const result = await api.trade({
      coinId,
      coinSymbol: box.dataset.coinSymbol,
      coinName: box.dataset.coinName,
      side,
      amountCoin,
    });
    state.user = result.user;
    updateAuthUI();
    msg.textContent = `${side === 'buy' ? 'Bought' : 'Sold'} at ${formatUsd(result.price_usd)}`;
    msg.classList.add('success');
    $('#tradeAmount').value = '';
    updateTradeEstimate();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('error');
  }
}

function updateTradeUI() {
  const side = dashboardState.tradeSide || 'buy';
  const btn = $('#executeTradeBtn');
  if (!btn) return;
  btn.textContent = side === 'buy' ? 'Buy' : 'Sell';
  btn.className = `btn btn-trade ${side === 'buy' ? 'btn-buy' : 'btn-sell'}`;
  $$('.trade-tab').forEach((t) => t.classList.toggle('active', t.dataset.side === side));
}

function updateTradeEstimate() {
  const amount = Number($('#tradeAmount')?.value) || 0;
  const priceText = $('#tradeLivePrice')?.textContent || '0';
  const price = parseFloat(priceText.replace(/[^0-9.-]/g, '')) || 0;
  const el = $('#tradeTotal');
  if (el) el.textContent = formatUsd(amount * price);
}

async function loadPortfolio(tradesOnly = false) {
  if (!state.user) {
    const msg = '<tr><td colspan="6" class="empty-state">Sign in to view your portfolio</td></tr>';
    $('#holdingsTableBody').innerHTML = msg;
    $('#tradesTableBody').innerHTML = msg;
    return;
  }
  try {
    const data = await api.getPortfolio();
    state.user = data.user;
    updateAuthUI();
    if (!tradesOnly) {
      $('#portfolioSummary').innerHTML = `
        <div class="stat-card"><div class="stat-label">Total Value</div><div class="stat-value">${formatUsd(data.summary.total_value)}</div></div>
        <div class="stat-card"><div class="stat-label">Cash</div><div class="stat-value">${formatUsd(data.summary.cash_balance)}</div></div>
        <div class="stat-card"><div class="stat-label">Holdings</div><div class="stat-value">${formatUsd(data.summary.holdings_value)}</div></div>
        <div class="stat-card"><div class="stat-label">P/L</div><div class="stat-value ${pctClass(data.summary.profit_loss)}">${formatUsd(data.summary.profit_loss)} (${formatPct(data.summary.profit_loss_pct)})</div></div>`;
      $('#holdingsTableBody').innerHTML = data.holdings.length
        ? data.holdings.map((h) => `
          <tr><td><div class="coin-name">${h.coin_name}</div><div class="coin-symbol">${h.coin_symbol}</div></td>
          <td>${formatNumber(h.amount)}</td><td>${formatUsd(h.avg_buy_price)}</td><td>${formatUsd(h.current_price)}</td>
          <td>${formatUsd(h.current_value)}</td><td class="${pctClass(h.profit_loss)}">${formatUsd(h.profit_loss)} (${formatPct(h.profit_loss_pct)})</td></tr>`).join('')
        : '<tr><td colspan="6" class="empty-state">No holdings yet</td></tr>';
    }
    $('#tradesTableBody').innerHTML = data.trades.length
      ? data.trades.map((t) => `
        <tr><td>${new Date(t.created_at).toLocaleString()}</td><td>${t.coin_name} (${t.coin_symbol})</td>
        <td class="side-${t.side}">${t.side.toUpperCase()}</td><td>${formatNumber(t.amount_coin)}</td>
        <td>${formatUsd(t.price_usd)}</td><td>${formatUsd(t.total_usd)}</td></tr>`).join('')
      : '<tr><td colspan="6" class="empty-state">No trades yet</td></tr>';
  } catch (err) {
    console.error(err);
  }
}

async function loadAdmin() {
  if (!state.user || state.user.role !== 'admin') return;
  try {
    const { users, stats } = await api.adminUsers();
    $('#adminStats').innerHTML = `
      <div class="stat-card"><div class="stat-label">Users</div><div class="stat-value">${stats.user_count}</div></div>
      <div class="stat-card"><div class="stat-label">Total Trades</div><div class="stat-value">${stats.trade_count}</div></div>
      <div class="stat-card"><div class="stat-label">Trades Today</div><div class="stat-value">${stats.trades_today}</div></div>`;
    $('#adminTableBody').innerHTML = users.map((u) => `
      <tr><td>${u.username}</td><td>${u.role}</td><td>${formatUsd(u.balance_usd)}</td><td>${u.trade_count}</td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td>${u.role === 'user' ? `<button class="btn-outline reset-user" data-id="${u.id}">Reset</button>` : '—'}</td></tr>`).join('');
  } catch (err) {
    console.error(err);
  }
}

function bindEvents() {
  $$('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  document.querySelectorAll('[data-view-link]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showView(el.dataset.viewLink);
    });
  });

  $('#backToMarkets')?.addEventListener('click', () => showView('markets'));
  $('#loginBtn')?.addEventListener('click', () => openAuth('login'));
  $('#logoutBtn')?.addEventListener('click', () => { setToken(null); state.user = null; updateAuthUI(); });
  $('#closeAuthModal')?.addEventListener('click', closeAuth);
  $('.modal-backdrop')?.addEventListener('click', closeAuth);
  $('#authSwitchBtn')?.addEventListener('click', () => {
    openAuth($('#authForm').dataset.mode === 'login' ? 'register' : 'login');
  });

  $('#authForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = $('#authForm').dataset.mode;
    try {
      const fn = mode === 'login' ? api.login : api.register;
      const { token, user } = await fn($('#authUsername').value.trim(), $('#authPassword').value);
      setToken(token);
      state.user = user;
      updateAuthUI();
      closeAuth();
    } catch (err) {
      $('#authError').textContent = err.message;
    }
  });

  $$('.trade-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      dashboardState.tradeSide = tab.dataset.side;
      updateTradeUI();
    });
  });

  $('#tradeAmount')?.addEventListener('input', updateTradeEstimate);
  $('#executeTradeBtn')?.addEventListener('click', executeTrade);

  $('#adminTableBody')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.reset-user');
    if (!btn || !confirm('Reset user?')) return;
    await api.adminReset(btn.dataset.id);
    loadAdmin();
  });
}

async function init() {
  dashboardState.tradeSide = 'buy';
  initDashboard({ onNavigate: (view) => showView(view) });
  bindEvents();
  updateTradeUI();
  await initAuth();

  try {
    await api.getHealth();
  } catch {
    const main = document.querySelector('.main');
    if (main) {
      main.insertAdjacentHTML('afterbegin',
        '<div class="server-warning">⚠ Old server detected. In terminal run: <code>npm start</code> then hard refresh (Ctrl+Shift+R)</div>');
    }
  }

  showView('overview');
}

init();

export { showView, openCoin };
