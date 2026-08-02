const coingecko = require('../coingecko');
const db = require('../db');
const { publicUser } = require('../auth/middleware');

const ALLOCATION_COLORS = ['#8bc53f', '#3861fb', '#16c784', '#ea3943', '#f7931a', '#627eea', '#e84142', '#26a17b'];

async function enrichHoldings(holdings) {
  let holdingsValue = 0;
  let change24hUsd = 0;
  const enriched = [];

  if (!holdings.length) {
    return { enriched, holdingsValue, change24hUsd: 0, change24hPct: 0 };
  }

  let prices = {};
  let imageMap = {};
  try {
    const ids = holdings.map((h) => h.coin_id).join(',');
    const pricePromise = Promise.all([
      coingecko.getSimplePrices(ids),
      coingecko.getMarkets({ ids: holdings.map((h) => h.coin_id), perPage: holdings.length, page: 1 }),
    ]);
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('price timeout')), 8000)
    );
    const [priceData, marketsRes] = await Promise.race([pricePromise, timeout]);
    prices = priceData || {};
    imageMap = Object.fromEntries((marketsRes.coins || []).map((c) => [c.id, c.image]));
  } catch {
    /* fall back to cost basis when live prices are slow/unavailable */
  }

  for (const h of holdings) {
    const livePrice = prices[h.coin_id]?.usd;
    const price = livePrice || h.avg_buy_price || 0;
    const change24h = prices[h.coin_id]?.usd_24h_change || 0;
    const value = h.amount * price;
    const cost = h.amount * h.avg_buy_price;
    holdingsValue += value;
    change24hUsd += value * (change24h / 100);
    enriched.push({
      ...h,
      image: imageMap[h.coin_id] || null,
      current_price: price,
      change_24h_pct: change24h,
      current_value: value,
      cost_basis: cost,
      profit_loss: value - cost,
      profit_loss_pct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
    });
  }

  enriched.sort((a, b) => b.current_value - a.current_value);
  const change24hPct = holdingsValue > 0 ? (change24hUsd / holdingsValue) * 100 : 0;
  return { enriched, holdingsValue, change24hUsd, change24hPct };
}

function buildAllocation(cashBalance, holdings, totalValue) {
  if (totalValue <= 0) {
    return [{ id: 'cash', label: 'Cash (USD)', value: 0, pct: 100, color: ALLOCATION_COLORS[0] }];
  }

  const slices = [
    {
      id: 'cash',
      label: 'Cash (USD)',
      value: cashBalance,
      pct: (cashBalance / totalValue) * 100,
      color: ALLOCATION_COLORS[0],
    },
  ];

  holdings.forEach((h, i) => {
    slices.push({
      id: h.coin_id,
      label: h.coin_symbol,
      value: h.current_value,
      pct: (h.current_value / totalValue) * 100,
      color: ALLOCATION_COLORS[(i + 1) % ALLOCATION_COLORS.length],
    });
  });

  return slices.filter((s) => s.pct > 0.01).sort((a, b) => b.pct - a.pct);
}

function getUserActivityStats(userId) {
  return db.getUserTransactionStats(userId);
}

function replayPortfolioHistory(txns) {
  let cash = 0;
  const holdings = {};

  const holdingsValue = () =>
    Object.values(holdings).reduce(
      (sum, h) => sum + Math.max(0, h.amount) * (h.lastPrice || 0),
      0
    );

  const ensureHolding = (coinId, price = 0) => {
    if (!holdings[coinId]) holdings[coinId] = { amount: 0, lastPrice: price };
    return holdings[coinId];
  };

  const points = [];

  for (const tx of txns) {
    const coinId = tx.coin_id;
    switch (tx.type) {
      case 'deposit':
        cash += tx.amount;
        break;
      case 'withdrawal':
        cash -= tx.amount;
        break;
      case 'received':
        if (tx.currency === 'USD') {
          cash += tx.amount;
        } else if (coinId) {
          const h = ensureHolding(coinId);
          h.amount += tx.amount;
          const px =
            tx.price_usd || (tx.total_usd && tx.amount ? tx.total_usd / tx.amount : h.lastPrice);
          if (px > 0) h.lastPrice = px;
        }
        break;
      case 'sent':
        if (tx.currency === 'USD') {
          cash -= tx.amount;
        } else if (coinId && holdings[coinId]) {
          holdings[coinId].amount -= tx.amount;
        }
        break;
      case 'buy':
        cash -= tx.total_usd || 0;
        if (coinId) {
          const h = ensureHolding(coinId, tx.price_usd || 0);
          h.amount += tx.amount;
          if (tx.price_usd) h.lastPrice = tx.price_usd;
        }
        break;
      case 'sell':
        cash += tx.total_usd || 0;
        if (coinId && holdings[coinId]) {
          holdings[coinId].amount -= tx.amount;
          if (tx.price_usd) holdings[coinId].lastPrice = tx.price_usd;
        }
        break;
      default:
        break;
    }

    const ts = Math.floor(new Date(tx.created_at).getTime() / 1000);
    if (Number.isFinite(ts) && ts > 0) {
      points.push({ time: ts, value: Math.max(0, cash + holdingsValue()) });
    }
  }

  return points;
}

function buildPortfolioHistory(userId, currentTotalValue) {
  const txns = db.getUserTransactionsAsc(userId);
  const points = replayPortfolioHistory(txns);
  const now = Math.floor(Date.now() / 1000);

  if (points.length === 0) {
    return [
      { time: now - 86400, value: currentTotalValue },
      { time: now, value: currentTotalValue },
    ];
  }

  const last = points[points.length - 1];
  if (last.time !== now) {
    points.push({ time: now, value: currentTotalValue });
  } else {
    last.value = currentTotalValue;
  }

  const deduped = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.time === p.time) {
      prev.value = p.value;
    } else {
      deduped.push(p);
    }
  }

  return deduped;
}

async function buildUserDashboard(userId) {
  const user = db.findUserById(userId);
  if (!user) throw new Error('User not found');

  const holdings = db.getHoldings(userId);
  const { enriched, holdingsValue, change24hUsd, change24hPct } = await enrichHoldings(holdings);
  const totalValue = user.balance_usd + holdingsValue;
  const startingBalance = db.getUserStartingBalance(userId);
  const profitLoss = totalValue - startingBalance;
  const profitLossPct = startingBalance > 0 ? (profitLoss / startingBalance) * 100 : 0;

  const summary = {
    total_value: totalValue,
    cash_balance: user.balance_usd,
    holdings_value: holdingsValue,
    starting_balance: startingBalance,
    profit_loss: profitLoss,
    profit_loss_pct: profitLossPct,
    change_24h_usd: change24hUsd,
    change_24h_pct: change24hPct,
  };

  return {
    account: {
      ...publicUser(user),
      display_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || user.username,
      member_since: user.created_at,
    },
    summary,
    allocation: buildAllocation(user.balance_usd, enriched, totalValue),
    holdings: enriched,
    portfolio_history: buildPortfolioHistory(userId, totalValue),
    recent_activity: db.getUserLedger(userId, 20),
    stats: getUserActivityStats(userId),
  };
}

async function buildPortfolioResponse(userId) {
  const dashboard = await buildUserDashboard(userId);
  const user = db.findUserById(userId);

  return {
    user,
    holdings: dashboard.holdings,
    trades: db.getTrades(userId),
    ledger: db.getUserLedger(userId),
    summary: dashboard.summary,
  };
}

module.exports = {
  buildUserDashboard,
  buildPortfolioResponse,
  buildPortfolioHistory,
  enrichHoldings,
  ALLOCATION_COLORS,
};
