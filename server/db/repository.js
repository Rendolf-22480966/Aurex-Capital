const bcrypt = require('bcryptjs');
const { prepare, transaction } = require('./connection');

function generatePublicId() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TXN-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

function getPortfolioByUserId(userId) {
  return prepare('SELECT * FROM portfolios WHERE user_id = ?').get(userId);
}

function ensurePortfolio(userId, startingBalance = 10000) {
  let portfolio = getPortfolioByUserId(userId);
  if (!portfolio) {
    prepare('INSERT INTO portfolios (user_id, cash_balance_usd) VALUES (?, ?)').run(userId, startingBalance);
    portfolio = getPortfolioByUserId(userId);
  }
  return portfolio;
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    role: row.role,
    status: row.status,
    email_verified_at: row.email_verified_at,
    balance_usd: row.cash_balance_usd ?? row.balance_usd ?? 0,
    created_at: row.created_at,
  };
}

function findUserByEmail(email) {
  return prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
}

function uniqueUsername(base) {
  let candidate = base.slice(0, 24) || 'user';
  let n = 1;
  while (findUserByUsername(candidate)) {
    candidate = `${base.slice(0, 20)}${n}`;
    n += 1;
  }
  return candidate;
}

function registerUser({ firstName, lastName, email, password }) {
  if (findUserByEmail(email)) {
    const err = new Error('Email already registered');
    err.code = 'EMAIL_TAKEN';
    throw err;
  }

  const hash = bcrypt.hashSync(password, 12);
  const username = uniqueUsername(email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user');

  return transaction(() => {
    const result = prepare(
      `INSERT INTO users (username, first_name, last_name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, 'user', 'active')`
    ).run(username, firstName, lastName, email, hash);

    const userId = result.lastInsertRowid;
    const portfolio = ensurePortfolio(userId);

    prepare(
      `INSERT INTO transactions (public_id, user_id, portfolio_id, type, amount, currency, status, description, source)
       VALUES (?, ?, ?, 'deposit', 10000, 'USD', 'completed', 'Welcome deposit', 'system')`
    ).run(generatePublicId(), userId, portfolio.id);

    return userId;
  });
}

/** @deprecated Use registerUser — kept for internal compatibility */
function createUser(username, password) {
  const hash = bcrypt.hashSync(password, 10);
  const email = username.includes('@') ? username.toLowerCase() : `${username.toLowerCase()}@legacy.aurex.local`;

  return transaction(() => {
    const result = prepare(
      `INSERT INTO users (username, email, password_hash, role, status)
       VALUES (?, ?, ?, 'user', 'active')`
    ).run(username, email, hash);

    const userId = result.lastInsertRowid;
    ensurePortfolio(userId);
    return userId;
  });
}

function authenticateUser(identifier, password) {
  const user =
    findUserByEmail(identifier) ||
    findUserByUsername(identifier) ||
    prepare('SELECT * FROM users WHERE username = ?').get(identifier);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return null;
  }
  if (user.status === 'deleted') return null;
  return user;
}

function findUserByUsername(username) {
  return prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username.toLowerCase());
}

function findUserById(id) {
  const row = prepare(
    `SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.role, u.status,
            u.email_verified_at, u.created_at, p.cash_balance_usd
     FROM users u
     LEFT JOIN portfolios p ON p.user_id = u.id
     WHERE u.id = ?`
  ).get(id);
  return mapUserRow(row);
}

function getAllUsers() {
  const rows = prepare(
    `SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.role, u.status,
            u.created_at, p.cash_balance_usd,
            (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id) AS trade_count
     FROM users u
     LEFT JOIN portfolios p ON p.user_id = u.id
     ORDER BY u.created_at DESC`
  ).all();
  return rows.map((row) => ({
    ...mapUserRow(row),
    trade_count: row.trade_count ?? 0,
  }));
}

function getHoldings(userId) {
  const portfolio = getPortfolioByUserId(userId);
  if (!portfolio) return [];

  return prepare(
    `SELECT coin_id, coin_symbol, coin_name,
            quantity AS amount, avg_cost_usd AS avg_buy_price, portfolio_id, id
     FROM holdings
     WHERE portfolio_id = ? AND quantity > 0
     ORDER BY coin_symbol`
  ).all(portfolio.id);
}

function getTrades(userId, limit = 50) {
  const rows = prepare(
    `SELECT id, coin_id, coin_symbol, coin_name, type AS side,
            amount AS amount_coin, price_usd, total_usd, created_at, description, public_id, status
     FROM transactions
     WHERE user_id = ? AND type IN ('buy', 'sell')
     ORDER BY created_at DESC
     LIMIT ?`
  ).all(userId, limit);

  return rows.map((r) => ({
    ...r,
    side: r.side,
  }));
}

function getTransactions(userId, limit = 50) {
  return prepare(
    `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
  ).all(userId, limit);
}

function getUserTransactionsAsc(userId) {
  return prepare(
    `SELECT type, amount, currency, coin_id, price_usd, total_usd, created_at
     FROM transactions
     WHERE user_id = ? AND status = 'completed'
     ORDER BY created_at ASC`
  ).all(userId);
}

function getPlatformStats() {
  return prepare(
    `SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'user' AND status = 'active') AS user_count,
      (SELECT COUNT(*) FROM users WHERE role = 'user' AND status = 'suspended') AS suspended_count,
      (SELECT COUNT(*) FROM users WHERE role = 'user' AND status = 'deleted') AS deleted_count,
      (SELECT COUNT(*) FROM transactions) AS trade_count,
      (SELECT COUNT(*) FROM transactions WHERE date(created_at) = date('now')) AS trades_today`
  ).get();
}

function getUserStartingBalance(userId) {
  const row = prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE user_id = ? AND type = 'deposit' AND currency = 'USD' AND status = 'completed'`
  ).get(userId);
  return row?.total > 0 ? row.total : 10000;
}

function getUserTransactionStats(userId) {
  return prepare(
    `SELECT
      COUNT(CASE WHEN type IN ('buy', 'sell') THEN 1 END) AS trade_count,
      COUNT(CASE WHEN type = 'deposit' THEN 1 END) AS deposit_count,
      COUNT(CASE WHEN type = 'withdrawal' THEN 1 END) AS withdrawal_count,
      COUNT(CASE WHEN type = 'received' THEN 1 END) AS received_count,
      COUNT(*) AS total_transactions
     FROM transactions WHERE user_id = ?`
  ).get(userId);
}

function insertTransaction({
  userId,
  portfolioId,
  type,
  amount,
  currency = 'USD',
  assetSymbol = null,
  assetName = null,
  coinId = null,
  priceUsd = null,
  totalUsd = null,
  description,
  source = 'user',
  adminId = null,
  createdAt = null,
}) {
  const publicId = generatePublicId();
  const params = [
    publicId,
    userId,
    portfolioId,
    type,
    amount,
    currency,
    assetSymbol,
    assetName,
    coinId,
    priceUsd,
    totalUsd,
    description,
    source,
    adminId,
  ];

  if (createdAt) {
    const result = prepare(
      `INSERT INTO transactions
       (public_id, user_id, portfolio_id, type, amount, currency, asset_symbol, asset_name, coin_id, price_usd, total_usd, status, description, source, admin_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)`
    ).run(...params, createdAt);
    return { id: result.lastInsertRowid, public_id: publicId };
  }

  const result = prepare(
    `INSERT INTO transactions
     (public_id, user_id, portfolio_id, type, amount, currency, asset_symbol, asset_name, coin_id, price_usd, total_usd, status, description, source, admin_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`
  ).run(...params);
  return { id: result.lastInsertRowid, public_id: publicId };
}

function executeTrade({ userId, coinId, coinSymbol, coinName, side, amountCoin, priceUsd }) {
  const totalUsd = amountCoin * priceUsd;

  return transaction(() => {
    const user = findUserById(userId);
    if (!user) throw new Error('User not found');
    if (user.status === 'suspended') throw new Error('Account is suspended');
    if (user.status === 'deleted') throw new Error('Account is no longer available');

    const portfolio = ensurePortfolio(userId);
    const holding = prepare(
      'SELECT * FROM holdings WHERE portfolio_id = ? AND coin_id = ?'
    ).get(portfolio.id, coinId);

    if (side === 'buy') {
      if (portfolio.cash_balance_usd < totalUsd) throw new Error('Insufficient USD balance');
      prepare(
        'UPDATE portfolios SET cash_balance_usd = cash_balance_usd - ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).run(totalUsd, portfolio.id);

      if (holding) {
        const newQty = holding.quantity + amountCoin;
        const newAvg = (holding.quantity * holding.avg_cost_usd + totalUsd) / newQty;
        prepare(
          'UPDATE holdings SET quantity = ?, avg_cost_usd = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).run(newQty, newAvg, holding.id);
      } else {
        prepare(
          `INSERT INTO holdings (portfolio_id, coin_id, coin_symbol, coin_name, quantity, avg_cost_usd)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(portfolio.id, coinId, coinSymbol, coinName, amountCoin, priceUsd);
      }

      insertTransaction({
        userId,
        portfolioId: portfolio.id,
        type: 'buy',
        amount: amountCoin,
        currency: coinSymbol,
        assetSymbol: coinSymbol,
        assetName: coinName,
        coinId,
        priceUsd,
        totalUsd,
        description: `Bought ${coinName}`,
        source: 'user',
      });
    } else {
      if (!holding || holding.quantity < amountCoin) throw new Error('Insufficient coin balance');
      const newQty = holding.quantity - amountCoin;
      prepare(
        'UPDATE portfolios SET cash_balance_usd = cash_balance_usd + ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).run(totalUsd, portfolio.id);

      if (newQty <= 0.00000001) {
        prepare('DELETE FROM holdings WHERE id = ?').run(holding.id);
      } else {
        prepare('UPDATE holdings SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newQty, holding.id);
      }

      insertTransaction({
        userId,
        portfolioId: portfolio.id,
        type: 'sell',
        amount: amountCoin,
        currency: coinSymbol,
        assetSymbol: coinSymbol,
        assetName: coinName,
        coinId,
        priceUsd,
        totalUsd,
        description: `Sold ${coinName}`,
        source: 'user',
      });
    }

    return findUserById(userId);
  });
}

function resetUserBalance(userId, amount = 10000) {
  transaction(() => {
    const portfolio = ensurePortfolio(userId);
    prepare(
      'UPDATE portfolios SET cash_balance_usd = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(amount, portfolio.id);
    prepare('DELETE FROM holdings WHERE portfolio_id = ?').run(portfolio.id);
    prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
  });
}

function markEmailVerified(userId) {
  prepare(
    `UPDATE users SET email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(userId);
}

function updateUserPassword(userId, password) {
  const hash = bcrypt.hashSync(password, 12);
  prepare(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(hash, userId);
}

module.exports = {
  generatePublicId,
  getPortfolioByUserId,
  ensurePortfolio,
  registerUser,
  createUser,
  authenticateUser,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  getAllUsers,
  getHoldings,
  getTrades,
  getTransactions,
  getUserTransactionsAsc,
  getPlatformStats,
  getUserStartingBalance,
  getUserTransactionStats,
  insertTransaction,
  executeTrade,
  resetUserBalance,
  markEmailVerified,
  updateUserPassword,
};
