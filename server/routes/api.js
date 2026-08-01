const express = require('express');
const coingecko = require('../coingecko');
const db = require('../db');
const { validateRegistration, validateLogin, validateForgotPassword, validateResetPassword } = require('../auth/validation');
const {
  authMiddleware,
  adminMiddleware,
  publicUser,
  issueAuthResponse,
  clearSessionCookie,
  extractToken,
} = require('../auth/middleware');
const emailService = require('../auth/emailService');
const userDashboardService = require('../services/userDashboard');
const { authLimiter, marketLimiter, apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(apiLimiter);

const ORDER_MAP = {
  market_cap: 'market_cap_desc',
  rank: 'market_cap_desc',
  price: 'price_desc',
  volume: 'volume_desc',
  change: 'price_change_percentage_24h_desc',
  change_desc: 'price_change_percentage_24h_desc',
  change_asc: 'price_change_percentage_24h_asc',
};

router.post('/auth/register', authLimiter, async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;
  const { errors, data } = validateRegistration({ firstName, lastName, email, password, confirmPassword });
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  try {
    const userId = db.registerUser(data);
    const user = db.findUserById(userId);
    const auth = issueAuthResponse(res, user, req);
    const emailResult = await emailService.sendVerificationForUser(userId);
    res.status(201).json({
      ...auth,
      verifyEmailSent: true,
      devPreviewUrl: emailResult?.previewUrl,
    });
  } catch (err) {
    if (err.code === 'EMAIL_TAKEN') return res.status(409).json({ error: err.message });
    res.status(400).json({ error: err.message });
  }
});

router.post('/auth/login', authLimiter, (req, res) => {
  const { email, password, username } = req.body;
  const identifier = email || username || '';
  const { errors, data } = validateLogin({ email: identifier, password });
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const user = db.authenticateUser(data.email, data.password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (user.status === 'suspended') return res.status(403).json({ error: 'Account is suspended' });
  if (user.status === 'deleted') return res.status(403).json({ error: 'Account is no longer available' });

  const profile = db.findUserById(user.id);
  res.json(issueAuthResponse(res, profile, req));
});

router.post('/auth/logout', (req, res) => {
  const token = extractToken(req);
  if (token) db.deleteSessionByToken(token);
  clearSessionCookie(res);
  res.json({ success: true });
});

router.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ user: publicUser(db.findUserById(req.user.id)) });
});

router.post('/auth/verify-email', (req, res) => {
  const token = String(req.body?.token || req.query?.token || '').trim();
  if (!token) return res.status(400).json({ error: 'Verification token is required' });

  const row = db.consumeToken(token, 'verify');
  if (!row) return res.status(400).json({ error: 'Invalid or expired verification link' });
  if (row.email_verified_at) {
    return res.json({ success: true, message: 'Email already verified' });
  }

  db.markEmailVerified(row.user_id);
  res.json({ success: true, message: 'Email verified successfully' });
});

router.post('/auth/verify-email/resend', authMiddleware, async (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.email_verified_at) {
    return res.json({ success: true, message: 'Email already verified' });
  }

  const emailResult = await emailService.sendVerificationForUser(user.id);
  res.json({
    success: true,
    message: 'Verification email sent',
    devPreviewUrl: emailResult?.previewUrl,
  });
});

router.post('/auth/forgot-password', authLimiter, async (req, res) => {
  const { errors, data } = validateForgotPassword(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const emailResult = await emailService.sendPasswordResetForEmail(data.email);
  res.json({
    success: true,
    message: 'If that email is registered, a reset link has been sent',
    devPreviewUrl: emailResult?.previewUrl,
  });
});

router.post('/auth/reset-password', authLimiter, (req, res) => {
  const { errors, data } = validateResetPassword(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const row = db.consumeToken(data.token, 'reset');
  if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' });

  db.updateUserPassword(row.user_id, data.password);
  db.deleteSessionsForUser(row.user_id);
  clearSessionCookie(res);

  res.json({ success: true, message: 'Password updated — sign in with your new password' });
});

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    version: '3.8.0',
    schema: 3,
    features: [
      'global',
      'trending',
      'dashboard',
      'user_dashboard',
      'admin_console',
      'account_management',
      'audit_chain_verify',
      'server_watchlist',
      'rate_limiting',
      'smoke_tests',
      'portfolios',
      'transactions',
      'dual_ledger',
      'audit_logs',
      'email_verification',
      'password_reset',
    ],
  });
});

router.get('/market/dashboard', marketLimiter, async (req, res) => {
  try {
    const bundle = await coingecko.getDashboardBundle();
    res.json(bundle);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/global', marketLimiter, async (req, res) => {
  try {
    const result = await coingecko.getGlobal();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/trending', marketLimiter, async (req, res) => {
  try {
    const result = await coingecko.getTrending();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/gainers', marketLimiter, async (req, res) => {
  try {
    const perPage = Math.min(Number(req.query.per_page) || 20, 50);
    const result = await coingecko.getGainers(perPage);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/losers', marketLimiter, async (req, res) => {
  try {
    const perPage = Math.min(Number(req.query.per_page) || 20, 50);
    const result = await coingecko.getLosers(perPage);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/coins', marketLimiter, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const perPage = Math.min(Number(req.query.per_page) || 50, 250);
    const sort = req.query.sort || 'market_cap';
    const order = ORDER_MAP[sort] || sort;
    const ids = req.query.ids ? String(req.query.ids).split(',').filter(Boolean) : null;
    const result = await coingecko.getMarkets({ page, perPage, order, ids });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/coin/:id', marketLimiter, async (req, res) => {
  try {
    const result = await coingecko.getCoin(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/chart/:id', marketLimiter, async (req, res) => {
  try {
    const days = req.query.days || '1';
    const result = await coingecko.getMarketChart(req.params.id, days);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/search', marketLimiter, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) return res.json({ results: { coins: [] }, meta: {} });
    const result = await coingecko.searchCoins(q);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/dashboard/user', authMiddleware, async (req, res) => {
  try {
    const dashboard = await userDashboardService.buildUserDashboard(req.user.id);
    res.json(dashboard);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/portfolio', authMiddleware, async (req, res) => {
  try {
    const data = await userDashboardService.buildPortfolioResponse(req.user.id);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/transactions', authMiddleware, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  res.json({ transactions: db.getUserLedger(req.user.id, limit) });
});

router.get('/watchlist', authMiddleware, (req, res) => {
  res.json({
    coin_ids: db.getUserWatchlist(req.user.id),
    max: db.MAX_WATCHLIST,
  });
});

router.post('/watchlist/sync', authMiddleware, (req, res) => {
  const coinIds = Array.isArray(req.body?.coinIds) ? req.body.coinIds : [];
  try {
    const result = db.syncWatchlist(req.user.id, coinIds);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/watchlist/toggle', authMiddleware, (req, res) => {
  const coinId = req.body?.coinId;
  if (!coinId) return res.status(400).json({ error: 'coinId is required' });
  try {
    const result = db.toggleWatchlist(req.user.id, coinId);
    res.json(result);
  } catch (err) {
    const code = err.code === 'LIMIT' ? 400 : 400;
    res.status(code).json({ error: err.message });
  }
});

router.delete('/watchlist/:coinId', authMiddleware, (req, res) => {
  const result = db.removeFromWatchlist(req.user.id, req.params.coinId);
  res.json(result);
});

router.post('/trade', authMiddleware, async (req, res) => {
  try {
    const { coinId, coinSymbol, coinName, side, amountCoin } = req.body;
    if (!coinId || !side || !amountCoin || amountCoin <= 0) {
      return res.status(400).json({ error: 'Invalid trade request' });
    }
    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ error: 'Side must be buy or sell' });
    }

    const prices = await coingecko.getSimplePrices(coinId);
    const priceUsd = prices[coinId]?.usd;
    if (!priceUsd) return res.status(400).json({ error: 'Could not fetch live price' });

    const user = db.executeTrade({
      userId: req.user.id,
      coinId,
      coinSymbol: (coinSymbol || coinId).toUpperCase(),
      coinName: coinName || coinId,
      side,
      amountCoin: Number(amountCoin),
      priceUsd,
    });

    res.json({ success: true, user, price_usd: priceUsd });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  res.json({ users: db.getAllUsers(), stats: db.getPlatformStats() });
});

router.get('/admin/audit', authMiddleware, adminMiddleware, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const action = req.query.action || null;
  res.json({
    integrity: db.verifyAuditChain(),
    actionSummary: db.getAuditActionSummary(),
    logs: db.getAuditLogs(limit, action),
  });
});

router.get('/admin/audit/verify', authMiddleware, adminMiddleware, (req, res) => {
  res.json(db.verifyAuditChainDetailed());
});

router.get('/admin/audit/:sequenceNum', authMiddleware, adminMiddleware, (req, res) => {
  const sequenceNum = Number(req.params.sequenceNum);
  if (!Number.isFinite(sequenceNum) || sequenceNum < 1) {
    return res.status(400).json({ error: 'Invalid sequence number' });
  }
  const log = db.getAuditLogBySequence(sequenceNum);
  if (!log) return res.status(404).json({ error: 'Audit record not found' });

  const expectedHash = db.hashAuditRecord(log);
  const prevRecord = sequenceNum > 1 ? db.getAuditLogBySequence(sequenceNum - 1) : null;
  const expectedPrev = sequenceNum === 1 ? db.GENESIS_HASH : prevRecord?.record_hash;

  res.json({
    log,
    verification: {
      prev_ok: log.prev_hash === expectedPrev,
      hash_ok: log.record_hash === expectedHash,
      expected_prev: expectedPrev,
      expected_hash: expectedHash,
      genesis: db.GENESIS_HASH,
    },
  });
});

router.post('/admin/users/:userId/deposit', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.userId);
  const amount = Number(req.body.amount);
  const note = req.body.note;
  if (!db.findUserById(userId)) return res.status(404).json({ error: 'User not found' });
  try {
    db.adminDepositFunds({ adminId: req.user.id, userId, amount, note });
    res.json({ success: true, user: db.findUserById(userId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin/users/:userId/withdraw', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.userId);
  const amount = Number(req.body.amount);
  const note = req.body.note;
  if (!db.findUserById(userId)) return res.status(404).json({ error: 'User not found' });
  try {
    db.adminWithdrawFunds({ adminId: req.user.id, userId, amount, note });
    res.json({ success: true, user: db.findUserById(userId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin/users/:userId/credit-crypto', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.userId);
  const { coinId, coinSymbol, coinName, quantity, priceUsd, note } = req.body;
  if (!db.findUserById(userId)) return res.status(404).json({ error: 'User not found' });
  try {
    db.adminCreditCrypto({
      adminId: req.user.id,
      userId,
      coinId,
      coinSymbol,
      coinName,
      quantity: Number(quantity),
      priceUsd: priceUsd != null ? Number(priceUsd) : 0,
      note,
    });
    res.json({ success: true, user: db.findUserById(userId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/admin/users/:userId', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.userId);
  const detail = db.getUserAdminDetail(userId);
  if (!detail) return res.status(404).json({ error: 'User not found' });
  res.json(detail);
});

router.post('/admin/users/:userId/suspend', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.userId);
  try {
    const user = db.suspendUser({ adminId: req.user.id, userId, reason: req.body.reason });
    res.json({ success: true, user });
  } catch (err) {
    const code = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
    res.status(code).json({ error: err.message });
  }
});

router.post('/admin/users/:userId/activate', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.userId);
  try {
    const user = db.activateUser({ adminId: req.user.id, userId });
    res.json({ success: true, user });
  } catch (err) {
    const code = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
    res.status(code).json({ error: err.message });
  }
});

router.delete('/admin/users/:userId', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.userId);
  try {
    const user = db.deleteUser({ adminId: req.user.id, userId, reason: req.body?.reason });
    res.json({ success: true, user });
  } catch (err) {
    const code = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
    res.status(code).json({ error: err.message });
  }
});

router.post('/admin/reset/:userId', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.userId);
  if (!db.findUserById(userId)) return res.status(404).json({ error: 'User not found' });
  try {
    db.adminResetAccount({ adminId: req.user.id, userId });
    res.json({ success: true, user: db.findUserById(userId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.use((req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

module.exports = { router, authMiddleware };
