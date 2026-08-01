const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir =
  process.env.DATA_DIR ||
  (process.env.RAILWAY_ENVIRONMENT || process.env.RENDER
    ? '/tmp/aurex-data'
    : path.join(__dirname, '..', 'data'));

const dbPath = path.join(dataDir, 'paper-trader.db');

let db = null;
let ready = null;

function persist() {
  if (!db) return;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function prepare(sql) {
  return {
    get(...params) {
      const stmt = db.prepare(sql);
      if (params.length) stmt.bind(params);
      const row = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return row;
    },
    all(...params) {
      const stmt = db.prepare(sql);
      if (params.length) stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    run(...params) {
      db.run(sql, params);
      persist();
      const idRow = db.exec('SELECT last_insert_rowid() AS id');
      const lastInsertRowid = idRow[0]?.values[0]?.[0] ?? 0;
      return { lastInsertRowid, changes: db.getRowsModified() };
    },
  };
}

function transaction(fn) {
  db.run('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.run('COMMIT');
    persist();
    return result;
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      balance_usd REAL NOT NULL DEFAULT 10000,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
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
    )
  `);
  db.run(`
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
    )
  `);
  db.run('PRAGMA foreign_keys = ON');

  const adminExists = prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    prepare(
      "INSERT INTO users (username, password_hash, role, balance_usd) VALUES (?, ?, 'admin', 10000)"
    ).run('admin', hash);
  }
  persist();
}

async function init() {
  if (ready) return ready;
  ready = (async () => {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const SQL = await initSqlJs({
      locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
    });
    if (fs.existsSync(dbPath)) {
      db = new SQL.Database(fs.readFileSync(dbPath));
    } else {
      db = new SQL.Database();
    }
    initSchema();
    console.log('SQLite ready (sql.js — no native build required)');
  })();
  return ready;
}

function createUser(username, password) {
  const hash = bcrypt.hashSync(password, 10);
  const result = prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
  return result.lastInsertRowid;
}

function findUserByUsername(username) {
  return prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findUserById(id) {
  return prepare('SELECT id, username, role, balance_usd, created_at FROM users WHERE id = ?').get(id);
}

function getAllUsers() {
  return prepare(
    `SELECT u.id, u.username, u.role, u.balance_usd, u.created_at,
            COUNT(t.id) AS trade_count
     FROM users u
     LEFT JOIN trades t ON t.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  ).all();
}

function getHoldings(userId) {
  return prepare('SELECT * FROM holdings WHERE user_id = ? AND amount > 0 ORDER BY coin_symbol').all(userId);
}

function getTrades(userId, limit = 50) {
  return prepare('SELECT * FROM trades WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit);
}

function getPlatformStats() {
  return prepare(
    `SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'user') AS user_count,
      (SELECT COUNT(*) FROM trades) AS trade_count,
      (SELECT COUNT(*) FROM trades WHERE date(created_at) = date('now')) AS trades_today`
  ).get();
}

function executeTrade({ userId, coinId, coinSymbol, coinName, side, amountCoin, priceUsd }) {
  const totalUsd = amountCoin * priceUsd;
  return transaction(() => {
    const user = prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found');

    const holding = prepare('SELECT * FROM holdings WHERE user_id = ? AND coin_id = ?').get(userId, coinId);

    if (side === 'buy') {
      if (user.balance_usd < totalUsd) throw new Error('Insufficient USD balance');
      prepare('UPDATE users SET balance_usd = balance_usd - ? WHERE id = ?').run(totalUsd, userId);

      if (holding) {
        const newAmount = holding.amount + amountCoin;
        const newAvg = (holding.amount * holding.avg_buy_price + totalUsd) / newAmount;
        prepare('UPDATE holdings SET amount = ?, avg_buy_price = ? WHERE id = ?').run(newAmount, newAvg, holding.id);
      } else {
        prepare(
          `INSERT INTO holdings (user_id, coin_id, coin_symbol, coin_name, amount, avg_buy_price)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(userId, coinId, coinSymbol, coinName, amountCoin, priceUsd);
      }
    } else {
      if (!holding || holding.amount < amountCoin) throw new Error('Insufficient coin balance');
      const newAmount = holding.amount - amountCoin;
      prepare('UPDATE users SET balance_usd = balance_usd + ? WHERE id = ?').run(totalUsd, userId);
      if (newAmount <= 0.00000001) {
        prepare('DELETE FROM holdings WHERE id = ?').run(holding.id);
      } else {
        prepare('UPDATE holdings SET amount = ? WHERE id = ?').run(newAmount, holding.id);
      }
    }

    prepare(
      `INSERT INTO trades (user_id, coin_id, coin_symbol, coin_name, side, amount_coin, price_usd, total_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, coinId, coinSymbol, coinName, side, amountCoin, priceUsd, totalUsd);

    return findUserById(userId);
  });
}

function resetUserBalance(userId, amount = 10000) {
  transaction(() => {
    prepare('UPDATE users SET balance_usd = ? WHERE id = ?').run(amount, userId);
    prepare('DELETE FROM holdings WHERE user_id = ?').run(userId);
    prepare('DELETE FROM trades WHERE user_id = ?').run(userId);
  });
}

module.exports = {
  init,
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
