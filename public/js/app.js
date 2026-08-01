import { api, getToken, setToken } from './api.js';
import { formatUsd, formatPct, formatNumber, pctClass } from './format.js';
import { initDashboard, onViewActivated, openCoin, dashboardState } from './dashboard.js';
import { initWatchlist, syncWatchlistOnLogin, clearWatchlistCache } from './watchlist.js';
import {
  initUserDashboard,
  loadUserDashboard,
  loadOverviewWidget,
  onDashboardActivated,
  onDashboardDeactivated,
  ledgerTypeClass,
  formatLedgerAmount,
} from './userDashboard.js';

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
  if (name === 'dashboard') onDashboardActivated();
  else onDashboardDeactivated();
  if (name === 'trades') loadActivity();
  if (name === 'overview') loadOverviewWidget();
}

function capitalize(s) {
  if (s === 'coin') return 'CoinDetail';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderLedgerRow(entry) {
  const total = entry.total_usd != null ? formatUsd(entry.total_usd) : '—';
  return `<tr>
    <td>${new Date(entry.created_at).toLocaleString()}</td>
    <td><span class="ledger-type ${ledgerTypeClass(entry.type)}">${entry.label}</span></td>
    <td>${entry.description}${entry.coin_name ? `<div class="coin-symbol">${entry.coin_name}</div>` : ''}</td>
    <td>${formatLedgerAmount(entry)}</td>
    <td>${total}</td>
    <td>${entry.status}</td>
  </tr>`;
}

function displayName(user) {
  if (!user) return '';
  if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
  return user.email || user.username;
}

function updateAuthUI() {
  const loggedIn = !!state.user;
  $('#userPanel')?.classList.toggle('hidden', !loggedIn);
  $('#loginBtn')?.classList.toggle('hidden', loggedIn);
  $$('.user-only').forEach((el) => {
    el.classList.toggle('hidden', !loggedIn);
  });
  const needsVerify = loggedIn && state.user && !state.user.email_verified;
  $('#verifyBanner')?.classList.toggle('hidden', !needsVerify);
  if (loggedIn) {
    $('#headerBalance').textContent = formatUsd(state.user.balance_usd);
    $('#headerUsername').textContent = displayName(state.user);
  }
}

function showToast(message, type = 'success') {
  const el = $('#authToast');
  if (!el) return;
  el.textContent = message;
  el.className = `auth-toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.add('hidden'), 6000);
}

function showDevPreview(url, label) {
  if (!url) return;
  console.info(`[Aurex dev] ${label}:`, url);
  showToast(`${label} (dev): check browser console for link`);
}

function openAuth(mode = 'login', { resetToken = '' } = {}) {
  $('#authModal')?.classList.remove('hidden');
  $('#authError').textContent = '';
  $('#authSuccess').textContent = '';

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  const titles = {
    login: 'Sign In',
    register: 'Create Account',
    forgot: 'Forgot Password',
    reset: 'Reset Password',
  };
  const subtitles = {
    login: 'Start with $10,000 virtual USD',
    register: 'Start with $10,000 virtual USD',
    forgot: 'Enter your email and we will send a reset link',
    reset: 'Choose a new password for your account',
  };
  const submitLabels = {
    login: 'Sign In',
    register: 'Register',
    forgot: 'Send reset link',
    reset: 'Update password',
  };

  $('#authTitle').textContent = titles[mode] || 'Sign In';
  $('#authSubtitle').textContent = subtitles[mode] || '';
  $('#authSubmit').textContent = submitLabels[mode] || 'Continue';
  $('#authForm').dataset.mode = mode;

  $('#authRegisterFields')?.classList.toggle('hidden', !isRegister);
  $('#authConfirmWrap')?.classList.toggle('hidden', !(isRegister || isReset));
  $('#authForgotWrap')?.classList.toggle('hidden', !isLogin);
  $('#authPasswordWrap')?.classList.toggle('hidden', isForgot);
  $('#authSwitchRow')?.classList.toggle('hidden', isForgot || isReset);

  $('#authFirstName').required = isRegister;
  $('#authLastName').required = isRegister;
  $('#authPassword').required = !isForgot;
  $('#authConfirmPassword').required = isRegister || isReset;
  $('#authResetToken').value = isReset ? resetToken : '';

  if (isLogin) {
    $('#authSwitchText').textContent = "Don't have an account?";
    $('#authSwitchBtn').textContent = 'Register';
  } else if (isRegister) {
    $('#authSwitchText').textContent = 'Already have an account?';
    $('#authSwitchBtn').textContent = 'Sign In';
  } else if (isForgot || isReset) {
    $('#authSwitchRow')?.classList.remove('hidden');
    $('#authSwitchText').textContent = '';
    $('#authSwitchBtn').textContent = 'Back to sign in';
  }
}

function closeAuth() {
  $('#authModal')?.classList.add('hidden');
  $('#authForm')?.reset();
}

async function initAuth() {
  try {
    const { user } = await api.me();
    state.user = user;
    updateAuthUI();
    await initWatchlist();
    loadOverviewWidget();
  } catch {
    setToken(null);
    clearWatchlistCache();
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
    if (state.currentView === 'dashboard') loadUserDashboard();
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

async function loadActivity() {
  if (!state.user) {
    $('#tradesTableBody').innerHTML = '<tr><td colspan="6" class="empty-state">Sign in to view your activity</td></tr>';
    return;
  }
  try {
    const { transactions } = await api.getTransactions(50);
    $('#tradesTableBody').innerHTML = transactions.length
      ? transactions.map(renderLedgerRow).join('')
      : '<tr><td colspan="6" class="empty-state">No activity yet</td></tr>';
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
  $('#logoutBtn')?.addEventListener('click', async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setToken(null);
    clearWatchlistCache();
    state.user = null;
    updateAuthUI();
    $('#overviewUserDash')?.classList.add('hidden');
    onDashboardDeactivated();
  });
  $('#closeAuthModal')?.addEventListener('click', closeAuth);
  $('.modal-backdrop')?.addEventListener('click', closeAuth);
  $('#authSwitchBtn')?.addEventListener('click', () => {
    const mode = $('#authForm').dataset.mode;
    if (mode === 'forgot' || mode === 'reset') openAuth('login');
    else openAuth(mode === 'login' ? 'register' : 'login');
  });
  $('#authForgotBtn')?.addEventListener('click', () => openAuth('forgot'));

  $('#resendVerifyBtn')?.addEventListener('click', async () => {
    const msg = $('#verifyBannerMsg');
    if (msg) msg.textContent = '';
    try {
      const result = await api.resendVerification();
      if (msg) msg.textContent = result.message;
      showDevPreview(result.devPreviewUrl, 'Verification link');
    } catch (err) {
      if (msg) msg.textContent = err.message;
    }
  });

  $('#authForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = $('#authForm').dataset.mode;
    $('#authError').textContent = '';
    $('#authSuccess').textContent = '';
    try {
      if (mode === 'login') {
        const result = await api.login($('#authEmail').value.trim(), $('#authPassword').value);
        setToken(result.token);
        state.user = result.user;
        await syncWatchlistOnLogin();
        updateAuthUI();
        closeAuth();
        showView('dashboard');
      } else if (mode === 'register') {
        const result = await api.register({
          firstName: $('#authFirstName').value.trim(),
          lastName: $('#authLastName').value.trim(),
          email: $('#authEmail').value.trim(),
          password: $('#authPassword').value,
          confirmPassword: $('#authConfirmPassword').value,
        });
        setToken(result.token);
        state.user = result.user;
        await syncWatchlistOnLogin();
        updateAuthUI();
        closeAuth();
        showView('dashboard');
        showToast('Account created — check your email to verify');
        showDevPreview(result.devPreviewUrl, 'Verification link');
      } else if (mode === 'forgot') {
        const result = await api.forgotPassword($('#authEmail').value.trim());
        $('#authSuccess').textContent = result.message;
        showDevPreview(result.devPreviewUrl, 'Password reset link');
      } else if (mode === 'reset') {
        const result = await api.resetPassword({
          token: $('#authResetToken').value.trim(),
          password: $('#authPassword').value,
          confirmPassword: $('#authConfirmPassword').value,
        });
        $('#authSuccess').textContent = result.message;
        setTimeout(() => openAuth('login'), 1500);
      }
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
}

async function handleAuthUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const verifyToken = params.get('verify');
  const resetToken = params.get('reset');

  if (verifyToken) {
    params.delete('verify');
    const next = params.toString() ? `?${params}` : window.location.pathname;
    window.history.replaceState({}, '', next);
    try {
      const result = await api.verifyEmail(verifyToken);
      showToast(result.message || 'Email verified');
      if (state.user) {
        const { user } = await api.me();
        state.user = user;
        updateAuthUI();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (resetToken) {
    params.delete('reset');
    const next = params.toString() ? `?${params}` : window.location.pathname;
    window.history.replaceState({}, '', next);
    openAuth('reset', { resetToken });
  }
}

async function init() {
  dashboardState.tradeSide = 'buy';
  initDashboard({
    onNavigate: (view) => showView(view),
    onWatchlistChange: () => {
      if (state.currentView === 'watchlist') onViewActivated('watchlist');
    },
    onToast: showToast,
  });
  initUserDashboard({
    getUser: () => state.user,
    onNavigate: (view) => showView(view),
    onOpenCoin: (id) => openCoin(id),
    onSignIn: () => openAuth('login'),
    onUserUpdate: (data) => {
      if (state.user && data?.summary) {
        state.user.balance_usd = data.summary.cash_balance;
        updateAuthUI();
      }
    },
  });
  bindEvents();
  updateTradeUI();
  await initAuth();
  await handleAuthUrlParams();

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
