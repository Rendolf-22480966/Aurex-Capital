import { api, getToken, setToken, invalidateMarketCache } from './api.js';
import { formatUsd } from './format.js';
import { initDashboard, onViewActivated, openCoin, dashboardState } from './dashboard.js';
import { initWatchlist, syncWatchlistOnLogin, clearWatchlistCache } from './watchlist.js';
import { showWelcomeBanner, hideWelcomeBanner, dismissWelcomeIfVisible } from './welcome.js';
import {
  initUserDashboard,
  loadUserDashboard,
  loadOverviewWidget,
  onDashboardActivated,
  onDashboardDeactivated,
} from './userDashboard.js';
import { initRouter, navigateView, suppressPopOnce } from './router.js';
import { MARKET_ROUTES, VIEW_ALIASES } from './config/routes.js';
import { appState, setUser, setRoute } from './state/appState.js';
import { renderPlaceholderPage } from './views/PlaceholderView.js';
import { initGlobalNav } from './components/GlobalNav.js';
import { initMegaMenu, closeMegaMenu } from './components/MegaMenu.js';
import { initMobileNav, closeMobileNav } from './components/MobileNav.js';
import { initLiveStatus } from './components/LiveStatus.js';
import { initGlobalMarketChart } from './components/GlobalMarketChart.js';
import { initActivityView, loadActivity, resetActivityFilter } from './components/ActivityView.js';
import { initNewsView, loadNews } from './components/NewsView.js';
import { initAdvertisingSlots, refreshAdvertisingSlots, mountVisibleAdSlots } from './components/AdvertisingSlot.js';
import { initSiteFooter } from './components/SiteFooter.js';
import { initMarketTicker } from './components/MarketTicker.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function normalizeView(name) {
  return VIEW_ALIASES[name] || name;
}

function viewElementId(view) {
  const v = normalizeView(view);
  if (v === 'coin') return 'viewCoinDetail';
  return `view${v.charAt(0).toUpperCase()}${v.slice(1)}`;
}

function updateNavActive(view) {
  const v = normalizeView(view);
  $$('.market-nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === v);
  });
  $$('.global-nav-link').forEach((link) => link.classList.remove('active'));
  $$('.global-nav-trigger').forEach((btn) => btn.classList.remove('is-open'));
}

function updateGlobalNavActive(pathname) {
  $$('.global-nav-link').forEach((link) => {
    const href = link.getAttribute('href');
    link.classList.toggle('active', href === pathname);
  });
}

function applyMarketsQuery(query = {}) {
  if (query.page) dashboardState.marketsPage = Math.max(1, Number(query.page) || 1);
  if (query.sort) {
    dashboardState.marketsSort = query.sort;
    const sel = $('#marketsSort');
    if (sel) sel.value = query.sort;
  }
}

function activateMarketView(view, params = {}, query = {}) {
  const v = normalizeView(view);
  setRoute({ type: 'market', view: v, params, query });

  $$('.view').forEach((el) => el.classList.remove('active'));
  $(`#${viewElementId(v)}`)?.classList.add('active');
  updateNavActive(v);

  if (v === 'markets') applyMarketsQuery(query);

  const marketViews = ['overview', 'markets', 'trending', 'gainers', 'losers', 'watchlist', 'coin'];
  if (marketViews.includes(v)) {
    if (v === 'coin' && params.id) {
      dashboardState.selectedCoinId = params.id;
      onViewActivated('coin');
    } else {
      onViewActivated(v);
    }
  }

  if (v === 'dashboard') {
    onDashboardActivated();
    refreshAdvertisingSlots();
  } else onDashboardDeactivated();

  if (v === 'activity') loadActivity();
  if (v === 'overview') {
    loadOverviewWidget();
    refreshAdvertisingSlots();
  }
  if (v === 'markets') refreshAdvertisingSlots();
  if (v === 'news') {
    loadNews();
    refreshAdvertisingSlots();
  }

  const routeMeta = Object.values(MARKET_ROUTES).find((r) => r.view === v);
  if (routeMeta?.title) {
    document.title = `${routeMeta.title} — Aurex Capital`;
  }
}

function handleRoute(route) {
  closeMegaMenu();
  closeMobileNav();

  if (route.type === 'placeholder') {
    $$('.view').forEach((el) => el.classList.remove('active'));
    $('#viewPlaceholder')?.classList.add('active');
    $$('.market-nav-link').forEach((link) => link.classList.remove('active'));
    updateGlobalNavActive(window.location.pathname.replace(/\/+$/, '') || '/');
    setRoute(route);
    renderPlaceholderPage(route.pageId);
    return;
  }

  activateMarketView(route.view, route.params, route.query);
}

export function showView(name, options = {}) {
  const view = normalizeView(name);
  navigateView(view, {
    params: options.params || (view === 'coin' && options.coinId ? { id: options.coinId } : {}),
    query: options.query || {},
    replace: options.replace,
  });
}


function enterAppAfterAuth() {
  showView('dashboard');
  showWelcomeBanner(appState.user);
}

function displayName(user) {
  if (!user) return '';
  if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
  return user.email || user.username;
}

function updateAuthUI() {
  const loggedIn = !!appState.user;
  $('#userPanel')?.classList.toggle('hidden', !loggedIn);
  $('#loginBtn')?.classList.toggle('hidden', loggedIn);
  $$('.user-only').forEach((el) => {
    el.classList.toggle('hidden', !loggedIn);
  });
  $$('#mobileNavOverlay .user-only').forEach((el) => {
    el.classList.toggle('hidden', !loggedIn);
  });
  const needsVerify = loggedIn && appState.user && !appState.user.email_verified;
  $('#verifyBanner')?.classList.toggle('hidden', !needsVerify);
  if (loggedIn) {
    $('#headerBalance').textContent = formatUsd(appState.user.balance_usd);
    $('#headerUsername').textContent = displayName(appState.user);
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
    login: 'Access your portfolio and live market workspace',
    register: 'Create your Aurex Capital account',
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
    setUser(user);
    appState.user = user;
    updateAuthUI();
    await initWatchlist();
    loadOverviewWidget();
  } catch {
    setToken(null);
    clearWatchlistCache();
    setUser(null);
    appState.user = null;
  }
}

async function executeTrade() {
  const box = $('#tradeBox');
  const msg = $('#tradeMessage');
  msg.textContent = '';
  msg.className = 'trade-message';

  if (!appState.user) {
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
    appState.user = result.user;
    setUser(result.user);
    updateAuthUI();
    msg.textContent = `${side === 'buy' ? 'Bought' : 'Sold'} at ${formatUsd(result.price_usd)}`;
    msg.classList.add('success');
    $('#tradeAmount').value = '';
    updateTradeEstimate();
    if (appState.currentView === 'dashboard') loadUserDashboard();
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


function bindEvents() {
  $('#backToMarkets')?.addEventListener('click', (e) => {
    e.preventDefault();
    showView('markets');
  });
  $('#loginBtn')?.addEventListener('click', () => openAuth('login'));
  $('#logoutBtn')?.addEventListener('click', async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    hideWelcomeBanner();
    setToken(null);
    clearWatchlistCache();
    invalidateMarketCache();
    resetActivityFilter();
    setUser(null);
    appState.user = null;
    updateAuthUI();
    $('#overviewUserDash')?.classList.add('hidden');
    onDashboardDeactivated();
    if (appState.currentView === 'activity') loadActivity();
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
        appState.user = result.user;
        setUser(result.user);
        await syncWatchlistOnLogin();
        updateAuthUI();
        closeAuth();
        showView('dashboard');
        await loadUserDashboard({ force: true });
        showWelcomeBanner(appState.user);
      } else if (mode === 'register') {
        const result = await api.register({
          firstName: $('#authFirstName').value.trim(),
          lastName: $('#authLastName').value.trim(),
          email: $('#authEmail').value.trim(),
          password: $('#authPassword').value,
          confirmPassword: $('#authConfirmPassword').value,
        });
        setToken(result.token);
        appState.user = result.user;
        setUser(result.user);
        await syncWatchlistOnLogin();
        updateAuthUI();
        closeAuth();
        showToast('Account created — check your email to verify');
        showDevPreview(result.devPreviewUrl, 'Verification link');
        enterAppAfterAuth();
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
    suppressPopOnce();
    window.history.replaceState({}, '', next);
    try {
      const result = await api.verifyEmail(verifyToken);
      showToast(result.message || 'Email verified');
      if (appState.user) {
        const { user } = await api.me();
        appState.user = user;
        setUser(user);
        updateAuthUI();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (resetToken) {
    params.delete('reset');
    const next = params.toString() ? `?${params}` : window.location.pathname;
    suppressPopOnce();
    window.history.replaceState({}, '', next);
    openAuth('reset', { resetToken });
  }
}

function initScrollChrome() {
  let ticking = false;

  const update = () => {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.classList.toggle('is-scrolled', y > 1);
    document.body.classList.toggle('is-scrolled-tight', y > 12);
    document.body.classList.toggle('is-scrolled-compact', y > 40);
    if (y > 16) dismissWelcomeIfVisible();
    ticking = false;
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  update();
}

export async function bootstrap() {
  dashboardState.tradeSide = 'buy';
  initDashboard({
    getUser: () => appState.user,
    onNavigate: (view, opts = {}) =>
      showView(view, { params: opts.coinId ? { id: opts.coinId } : opts.params }),
    onSignIn: () => openAuth('login'),
    onWatchlistChange: () => {
      if (appState.currentView === 'watchlist') onViewActivated('watchlist');
    },
    onToast: showToast,
  });
  initActivityView({
    getUser: () => appState.user,
    onSignIn: () => openAuth('login'),
    onOpenCoin: (id) => openCoin(id),
  });
  initNewsView();
  initAdvertisingSlots();
  initUserDashboard({
    getUser: () => appState.user,
    onNavigate: (view) => showView(view),
    onOpenCoin: (id) => openCoin(id),
    onSignIn: () => openAuth('login'),
    onUserUpdate: (data) => {
      if (appState.user && data?.summary) {
        appState.user.balance_usd = data.summary.cash_balance;
        setUser(appState.user);
        updateAuthUI();
      }
    },
  });
  bindEvents();
  updateTradeUI();
  initScrollChrome();
  initGlobalNav();
  initMegaMenu();
  initMobileNav();
  initLiveStatus();
  initGlobalMarketChart();
  initMarketTicker();
  initSiteFooter();

  // Router first so tabs work even while auth/API calls are in flight
  initRouter(handleRoute);

  await initAuth();
  await handleAuthUrlParams();

  try {
    await api.getHealth();
  } catch {
    const main = document.querySelector('.main');
    if (main) {
      main.insertAdjacentHTML(
        'afterbegin',
        '<div class="server-warning">⚠ Old server detected. In terminal run: <code>npm start</code> then hard refresh (Ctrl+Shift+R)</div>'
      );
    }
  }
}
