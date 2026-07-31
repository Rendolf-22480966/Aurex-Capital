const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const coingecko = require('../coingecko');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const ORDER_MAP = {
  market_cap: 'market_cap_desc',
  rank: 'market_cap_desc',
  price: 'price_desc',
  volume: 'volume_desc',
  change: 'price_change_percentage_24h_desc',
  change_desc: 'price_change_percentage_24h_desc',
  change_asc: 'price_change_percentage_24h_asc',
};

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

router.post('/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ error: 'Username and password (6+ chars) required' });
  }
  if (db.findUserByUsername(username)) {
    return res.status(409).json({ error: 'Username already taken' });
  }
  const userId = db.createUser(username, password);
  const user = db.findUserById(userId);
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.findUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: db.findUserById(user.id) });
});

router.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ user: db.findUserById(req.user.id) });
});

router.get('/health', (req, res) => {
  res.json({ ok: true, version: '2.0.0', features: ['global', 'trending', 'dashboard'] });
});

router.get('/market/dashboard', async (req, res) => {
  try {
    const bundle = await coingecko.getDashboardBundle();
    res.json(bundle);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/global', async (req, res) => {
  try {
    const result = await coingecko.getGlobal();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/trending', async (req, res) => {
  try {
    const result = await coingecko.getTrending();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/gainers', async (req, res) => {
  try {
    const perPage = Math.min(Number(req.query.per_page) || 20, 50);
    const result = await coingecko.getGainers(perPage);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/losers', async (req, res) => {
  try {
    const perPage = Math.min(Number(req.query.per_page) || 20, 50);
    const result = await coingecko.getLosers(perPage);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/coins', async (req, res) => {
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

router.get('/market/coin/:id', async (req, res) => {
  try {
    const result = await coingecko.getCoin(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/chart/:id', async (req, res) => {
  try {
    const days = req.query.days || '1';
    const result = await coingecko.getMarketChart(req.params.id, days);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/market/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) return res.json({ results: { coins: [] }, meta: {} });
    const result = await coingecko.searchCoins(q);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/portfolio', authMiddleware, async (req, res) => {
  try {
    const user = db.findUserById(req.user.id);
    const holdings = db.getHoldings(req.user.id);
    const trades = db.getTrades(req.user.id);
    let holdingsValue = 0;
    const enriched = [];

    if (holdings.length) {
      const ids = holdings.map((h) => h.coin_id).join(',');
      const prices = await coingecko.getSimplePrices(ids);
      for (const h of holdings) {
        const price = prices[h.coin_id]?.usd || 0;
        const value = h.amount * price;
        const cost = h.amount * h.avg_buy_price;
        holdingsValue += value;
        enriched.push({
          ...h,
          current_price: price,
          current_value: value,
          profit_loss: value - cost,
          profit_loss_pct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
        });
      }
    }

    const totalValue = user.balance_usd + holdingsValue;
    res.json({
      user,
      holdings: enriched,
      trades,
      summary: {
        cash_balance: user.balance_usd,
        holdings_value: holdingsValue,
        total_value: totalValue,
        profit_loss: totalValue - 10000,
        profit_loss_pct: ((totalValue - 10000) / 10000) * 100,
      },
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
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

router.post('/admin/reset/:userId', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.userId);
  if (!db.findUserById(userId)) return res.status(404).json({ error: 'User not found' });
  db.resetUserBalance(userId);
  res.json({ success: true, user: db.findUserById(userId) });
});

router.use((req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

module.exports = { router, authMiddleware };
