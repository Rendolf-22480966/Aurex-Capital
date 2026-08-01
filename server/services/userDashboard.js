const coingecko = require('../coingecko');
const db = require('../db');
const { publicUser } = require('../auth/middleware');

const ALLOCATION_COLORS = ['#8bc53f', '#3861fb', '#16c784', '#ea3943', '#f7931a', '#627eea', '#e84142', '#26a17b'];

async function enrichHoldings(holdings) {
  let holdingsValue = 0;
  const enriched = [];

  if (!holdings.length) {
    return { enriched, holdingsValue };
  }

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
      cost_basis: cost,
      profit_loss: value - cost,
      profit_loss_pct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
    });
  }

  enriched.sort((a, b) => b.current_value - a.current_value);
  return { enriched, holdingsValue };
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

async function buildUserDashboard(userId) {
  const user = db.findUserById(userId);
  if (!user) throw new Error('User not found');

  const holdings = db.getHoldings(userId);
  const { enriched, holdingsValue } = await enrichHoldings(holdings);
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
    recent_activity: db.getUserLedger(userId, 8),
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
  enrichHoldings,
  ALLOCATION_COLORS,
};
