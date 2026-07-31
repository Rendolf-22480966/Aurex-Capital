const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir =
  process.env.DATA_DIR ||
  (process.env.RAILWAY_ENVIRONMENT || process.env.RENDER
    ? '/tmp/aurex-data'
    : path.join(__dirname, '..', 'data'));
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  console.error(`Cannot create data directory at ${dataDir}:`, err.message);
  throw err;
}

const db = new Database(path.join(dataDir, 'paper-trader.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    balance_usd REAL NOT NULL DEFAULT 10000,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    coin_id TEXT NOT NULL,
    coin_symbol TEXT NOT NULL,
    coin_name TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    avg_buy_price REAL NOT NULL DEFAULT 0,
    UNIQUE(user_id, coin_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    coin_id TEXT NOT NULL,
    coin_symbol TEXT NOT NULL,
    coin_name TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    amount_coin REAL NOT NULL,
    price_usd REAL NOT NULL,
    total_usd REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    "INSERT INTO users (username, password_hash, role, balance_usd) VALUES (?, ?, 'admin', 10000)"
  ).run('admin', hash);
}

function createUser(username, password) {
  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, hash);
  return result.lastInsertRowid;
}

function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findUserById(id) {
  return db.prepare('SELECT id, username, role, balance_usd, created_at FROM users WHERE id = ?').get(id);
}

function getAllUsers() {
  return db
    .prepare(
      `SELECT u.id, u.username, u.role, u.balance_usd, u.created_at,
              COUNT(t.id) AS trade_count
       FROM users u
       LEFT JOIN trades t ON t.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    )
    .all();
}

function getHoldings(userId) {
  return db
    .prepare('SELECT * FROM holdings WHERE user_id = ? AND amount > 0 ORDER BY coin_symbol')
    .all(userId);
}

function getTrades(userId, limit = 50) {
  return db
    .prepare('SELECT * FROM trades WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit);
}

function getPlatformStats() {
  return db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'user') AS user_count,
        (SELECT COUNT(*) FROM trades) AS trade_count,
        (SELECT COUNT(*) FROM trades WHERE date(created_at) = date('now')) AS trades_today`
    )
    .get();
}

function executeTrade({ userId, coinId, coinSymbol, coinName, side, amountCoin, priceUsd }) {
  const totalUsd = amountCoin * priceUsd;
  const run = db.transaction(() => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found');

    const holding = db
      .prepare('SELECT * FROM holdings WHERE user_id = ? AND coin_id = ?')
      .get(userId, coinId);

    if (side === 'buy') {
      if (user.balance_usd < totalUsd) {
        throw new Error('Insufficient USD balance');
      }
      db.prepare('UPDATE users SET balance_usd = balance_usd - ? WHERE id = ?').run(totalUsd, userId);

      if (holding) {
        const newAmount = holding.amount + amountCoin;
        const newAvg =
          (holding.amount * holding.avg_buy_price + totalUsd) / newAmount;
        db.prepare(
          'UPDATE holdings SET amount = ?, avg_buy_price = ? WHERE id = ?'
        ).run(newAmount, newAvg, holding.id);
      } else {
        db.prepare(
          `INSERT INTO holdings (user_id, coin_id, coin_symbol, coin_name, amount, avg_buy_price)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(userId, coinId, coinSymbol, coinName, amountCoin, priceUsd);
      }
    } else {
      if (!holding || holding.amount < amountCoin) {
        throw new Error('Insufficient coin balance');
      }
      const newAmount = holding.amount - amountCoin;
      db.prepare('UPDATE users SET balance_usd = balance_usd + ? WHERE id = ?').run(totalUsd, userId);
      if (newAmount <= 0.00000001) {
        db.prepare('DELETE FROM holdings WHERE id = ?').run(holding.id);
      } else {
        db.prepare('UPDATE holdings SET amount = ? WHERE id = ?').run(newAmount, holding.id);
      }
    }

    db.prepare(
      `INSERT INTO trades (user_id, coin_id, coin_symbol, coin_name, side, amount_coin, price_usd, total_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, coinId, coinSymbol, coinName, side, amountCoin, priceUsd, totalUsd);

    return findUserById(userId);
  });

  return run();
}

function resetUserBalance(userId, amount = 10000) {
  db.transaction(() => {
    db.prepare('UPDATE users SET balance_usd = ? WHERE id = ?').run(amount, userId);
    db.prepare('DELETE FROM holdings WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM trades WHERE user_id = ?').run(userId);
  })();
}

module.exports = {
  db,
  createUser,
  findUserByUsername,
  findUserById,
  getAllUsers,
  getHoldings,
  getTrades,
  getPlatformStats,
  executeTrade,
  resetUserBalance,
};
