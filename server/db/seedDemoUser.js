const bcrypt = require('bcryptjs');
const coingecko = require('../coingecko');
const { prepare, persist, transaction } = require('./connection');
const { insertTransaction } = require('./repository');

const DEMO_EMAIL = 'rendolfagyemang2@gmail.com';
const DEMO_PASSWORD = 'Rendolf488$';

/** Reference prices used to size holdings so total portfolio ≈ TARGET_TOTAL */
const REF_PRICES = {
  ethereum: 4139.64,
  bitcoin: 65766.48,
  solana: 175.2,
  cardano: 2.184,
  chainlink: 18.45,
};

const TARGET_TOTAL = 7054;

const HOLDINGS = [
  { coin_id: 'ethereum', coin_symbol: 'ETH', coin_name: 'Ethereum', quantity: 0.52, avg_cost_usd: 3842.5 },
  { coin_id: 'bitcoin', coin_symbol: 'BTC', coin_name: 'Bitcoin', quantity: 0.009, avg_cost_usd: 61200 },
  { coin_id: 'solana', coin_symbol: 'SOL', coin_name: 'Solana', quantity: 3.8, avg_cost_usd: 164.8 },
  { coin_id: 'cardano', coin_symbol: 'ADA', coin_name: 'Cardano', quantity: 850, avg_cost_usd: 1.92 },
  { coin_id: 'chainlink', coin_symbol: 'LINK', coin_name: 'Chainlink', quantity: 28, avg_cost_usd: 16.4 },
];

function holdingsValueAtRef() {
  return HOLDINGS.reduce((sum, h) => sum + h.quantity * REF_PRICES[h.coin_id], 0);
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10 + (days % 8), 15 + (days % 40), 0, 0);
  return d.toISOString();
}

function buildTransactionHistory(userId, portfolioId) {
  const txns = [
    { days: 88, type: 'deposit', amount: 6500, currency: 'USD', totalUsd: 6500, description: 'Initial account funding' },
    { days: 85, type: 'buy', amount: 0.12, currency: 'ETH', coinId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', priceUsd: 3620, totalUsd: 434.4, description: 'Bought Ethereum' },
    { days: 82, type: 'buy', amount: 0.004, currency: 'BTC', coinId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', priceUsd: 59800, totalUsd: 239.2, description: 'Bought Bitcoin' },
    { days: 79, type: 'buy', amount: 2.5, currency: 'SOL', coinId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', priceUsd: 148, totalUsd: 370, description: 'Bought Solana' },
    { days: 76, type: 'buy', amount: 400, currency: 'ADA', coinId: 'cardano', assetSymbol: 'ADA', assetName: 'Cardano', priceUsd: 1.72, totalUsd: 688, description: 'Bought Cardano' },
    { days: 72, type: 'deposit', amount: 500, currency: 'USD', totalUsd: 500, description: 'Bank transfer deposit' },
    { days: 70, type: 'buy', amount: 0.08, currency: 'ETH', coinId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', priceUsd: 3750, totalUsd: 300, description: 'Bought Ethereum' },
    { days: 67, type: 'buy', amount: 15, currency: 'LINK', coinId: 'chainlink', assetSymbol: 'LINK', assetName: 'Chainlink', priceUsd: 15.2, totalUsd: 228, description: 'Bought Chainlink' },
    { days: 64, type: 'sell', amount: 0.002, currency: 'BTC', coinId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', priceUsd: 62100, totalUsd: 124.2, description: 'Sold Bitcoin (partial take profit)' },
    { days: 61, type: 'buy', amount: 1.2, currency: 'SOL', coinId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', priceUsd: 158, totalUsd: 189.6, description: 'Bought Solana' },
    { days: 58, type: 'received', amount: 120, currency: 'ADA', coinId: 'cardano', assetSymbol: 'ADA', assetName: 'Cardano', totalUsd: 218.4, description: 'Received Cardano (transfer in)' },
    { days: 55, type: 'buy', amount: 0.06, currency: 'ETH', coinId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', priceUsd: 3890, totalUsd: 233.4, description: 'Bought Ethereum' },
    { days: 52, type: 'buy', amount: 200, currency: 'ADA', coinId: 'cardano', assetSymbol: 'ADA', assetName: 'Cardano', priceUsd: 1.85, totalUsd: 370, description: 'Bought Cardano' },
    { days: 49, type: 'buy', amount: 0.003, currency: 'BTC', coinId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', priceUsd: 63500, totalUsd: 190.5, description: 'Bought Bitcoin' },
    { days: 46, type: 'buy', amount: 8, currency: 'LINK', coinId: 'chainlink', assetSymbol: 'LINK', assetName: 'Chainlink', priceUsd: 16.8, totalUsd: 134.4, description: 'Bought Chainlink' },
    { days: 43, type: 'sell', amount: 0.5, currency: 'ETH', coinId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', priceUsd: 4010, totalUsd: 2005, description: 'Sold Ethereum (rebalance)' },
    { days: 40, type: 'buy', amount: 0.22, currency: 'ETH', coinId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', priceUsd: 3950, totalUsd: 869, description: 'Bought Ethereum' },
    { days: 37, type: 'buy', amount: 250, currency: 'ADA', coinId: 'cardano', assetSymbol: 'ADA', assetName: 'Cardano', priceUsd: 1.98, totalUsd: 495, description: 'Bought Cardano' },
    { days: 34, type: 'withdrawal', amount: 200, currency: 'USD', totalUsd: 200, description: 'Withdrawal to bank (demo)' },
    { days: 31, type: 'buy', amount: 0.002, currency: 'BTC', coinId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', priceUsd: 64800, totalUsd: 129.6, description: 'Bought Bitcoin' },
    { days: 28, type: 'buy', amount: 1.0, currency: 'SOL', coinId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', priceUsd: 168, totalUsd: 168, description: 'Bought Solana' },
    { days: 25, type: 'buy', amount: 5, currency: 'LINK', coinId: 'chainlink', assetSymbol: 'LINK', assetName: 'Chainlink', priceUsd: 17.1, totalUsd: 85.5, description: 'Bought Chainlink' },
    { days: 22, type: 'sell', amount: 150, currency: 'ADA', coinId: 'cardano', assetSymbol: 'ADA', assetName: 'Cardano', priceUsd: 2.05, totalUsd: 307.5, description: 'Sold Cardano (partial)' },
    { days: 19, type: 'buy', amount: 0.1, currency: 'ETH', coinId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', priceUsd: 4080, totalUsd: 408, description: 'Bought Ethereum' },
    { days: 16, type: 'deposit', amount: 300, currency: 'USD', totalUsd: 300, description: 'Mobile money deposit' },
    { days: 14, type: 'buy', amount: 0.004, currency: 'BTC', coinId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', priceUsd: 65200, totalUsd: 260.8, description: 'Bought Bitcoin' },
    { days: 12, type: 'buy', amount: 0.08, currency: 'ETH', coinId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', priceUsd: 4110, totalUsd: 328.8, description: 'Bought Ethereum' },
    { days: 10, type: 'buy', amount: 120, currency: 'ADA', coinId: 'cardano', assetSymbol: 'ADA', assetName: 'Cardano', priceUsd: 2.12, totalUsd: 254.4, description: 'Bought Cardano' },
    { days: 8, type: 'sell', amount: 0.8, currency: 'SOL', coinId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', priceUsd: 172, totalUsd: 137.6, description: 'Sold Solana (partial)' },
    { days: 6, type: 'buy', amount: 0.05, currency: 'ETH', coinId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', priceUsd: 4125, totalUsd: 206.25, description: 'Bought Ethereum' },
    { days: 5, type: 'buy', amount: 1.0, currency: 'SOL', coinId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', priceUsd: 173, totalUsd: 173, description: 'Bought Solana' },
    { days: 4, type: 'buy', amount: 0.001, currency: 'BTC', coinId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', priceUsd: 65500, totalUsd: 65.5, description: 'Bought Bitcoin' },
    { days: 3, type: 'buy', amount: 50, currency: 'ADA', coinId: 'cardano', assetSymbol: 'ADA', assetName: 'Cardano', priceUsd: 2.16, totalUsd: 108, description: 'Bought Cardano' },
    { days: 2, type: 'buy', amount: 3, currency: 'LINK', coinId: 'chainlink', assetSymbol: 'LINK', assetName: 'Chainlink', priceUsd: 18.2, totalUsd: 54.6, description: 'Bought Chainlink' },
    { days: 1, type: 'buy', amount: 0.02, currency: 'ETH', coinId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', priceUsd: 4135, totalUsd: 82.7, description: 'Bought Ethereum' },
    { days: 0, type: 'buy', amount: 0.5, currency: 'SOL', coinId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', priceUsd: 175, totalUsd: 87.5, description: 'Bought Solana' },
  ];

  return txns.map((t) => ({
    userId,
    portfolioId,
    type: t.type,
    amount: t.amount,
    currency: t.currency,
    assetSymbol: t.assetSymbol || null,
    assetName: t.assetName || null,
    coinId: t.coinId || null,
    priceUsd: t.priceUsd || null,
    totalUsd: t.totalUsd,
    description: t.description,
    source: t.type === 'deposit' && t.description.includes('Initial') ? 'system' : 'user',
    createdAt: daysAgo(t.days),
  }));
}

async function seedRendolfDemoUser() {
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 12);

  let holdingsValue = holdingsValueAtRef();
  try {
    const prices = await coingecko.getSimplePrices(HOLDINGS.map((h) => h.coin_id));
    holdingsValue = HOLDINGS.reduce(
      (sum, h) => sum + h.quantity * (prices[h.coin_id]?.usd || REF_PRICES[h.coin_id]),
      0
    );
  } catch {
    /* use reference prices offline */
  }

  const cashBalance = Math.max(100, Math.round((TARGET_TOTAL - holdingsValue) * 100) / 100);

  const userId = transaction(() => {
    let user = prepare('SELECT * FROM users WHERE email = ?').get(DEMO_EMAIL);
    let uid;

    if (!user) {
      const result = prepare(
        `INSERT INTO users (username, first_name, last_name, email, password_hash, role, status, email_verified_at)
         VALUES ('rendolfagyemang', 'Rendolf', 'Agyemang', ?, ?, 'user', 'active', datetime('now'))`
      ).run(DEMO_EMAIL, hash);
      uid = result.lastInsertRowid;
    } else {
      uid = user.id;
      prepare(
        `UPDATE users SET password_hash = ?, first_name = 'Rendolf', last_name = 'Agyemang',
         status = 'active', email_verified_at = COALESCE(email_verified_at, datetime('now')),
         updated_at = datetime('now') WHERE id = ?`
      ).run(hash, uid);
    }

    let portfolio = prepare('SELECT * FROM portfolios WHERE user_id = ?').get(uid);
    let portfolioId;
    if (!portfolio) {
      const pf = prepare('INSERT INTO portfolios (user_id, cash_balance_usd) VALUES (?, ?)').run(uid, cashBalance);
      portfolioId = pf.lastInsertRowid;
    } else {
      portfolioId = portfolio.id;
    }

    prepare('UPDATE portfolios SET cash_balance_usd = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      cashBalance,
      portfolioId
    );

    prepare('DELETE FROM transactions WHERE user_id = ?').run(uid);
    prepare('DELETE FROM holdings WHERE portfolio_id = ?').run(portfolioId);
    prepare('DELETE FROM watchlists WHERE user_id = ?').run(uid);

    for (const h of HOLDINGS) {
      prepare(
        `INSERT INTO holdings (portfolio_id, coin_id, coin_symbol, coin_name, quantity, avg_cost_usd)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(portfolioId, h.coin_id, h.coin_symbol, h.coin_name, h.quantity, h.avg_cost_usd);
    }

    for (const coinId of ['bitcoin', 'ethereum', 'solana', 'cardano', 'chainlink']) {
      prepare('INSERT INTO watchlists (user_id, coin_id) VALUES (?, ?)').run(uid, coinId);
    }

    for (const txn of buildTransactionHistory(uid, portfolioId)) {
      insertTransaction(txn);
    }

    const holdingCount = prepare('SELECT COUNT(*) AS c FROM holdings WHERE portfolio_id = ?').get(portfolioId);
    if (!holdingCount?.c) {
      throw new Error('Demo holdings failed to seed');
    }

    return uid;
  });

  persist();
  console.log(
    `Demo user ready: ${DEMO_EMAIL} (portfolio ~$${TARGET_TOTAL}, cash $${cashBalance}, ${HOLDINGS.length} assets, 36 transactions)`
  );
  return userId;
}

module.exports = { seedRendolfDemoUser, DEMO_EMAIL };
