const bcrypt = require('bcryptjs');
const { prepare, transaction, tableExists, tableHasColumn, persist, getDb } = require('./connection');
const { createSchemaMigrations, getSchemaVersion, setSchemaVersion, createV2Tables, SCHEMA_VERSION } = require('./schema');

function isLegacyV1Database() {
  if (!tableExists('users')) return false;
  return tableHasColumn('users', 'balance_usd');
}

function isV2WithoutVersionStamp() {
  return tableExists('users') && tableHasColumn('users', 'email') && getSchemaVersion() < SCHEMA_VERSION;
}

function snapshotLegacyData() {
  const users = prepare('SELECT * FROM users').all();
  let holdings = [];
  let trades = [];

  if (tableExists('holdings') && tableHasColumn('holdings', 'user_id')) {
    holdings = prepare('SELECT * FROM holdings').all();
  }
  if (tableExists('trades')) {
    trades = prepare('SELECT * FROM trades').all();
  }

  return { users, holdings, trades };
}

function dropLegacyTables() {
  getDb().run('PRAGMA foreign_keys = OFF');
  if (tableExists('trades')) getDb().run('DROP TABLE trades');
  if (tableExists('holdings')) getDb().run('DROP TABLE holdings');
  if (tableExists('users')) getDb().run('DROP TABLE users');
  getDb().run('PRAGMA foreign_keys = ON');
}

function legacyEmailFromUsername(username) {
  if (!username) return null;
  if (username.includes('@')) return username.toLowerCase();
  return `${username.toLowerCase()}@legacy.aurex.local`;
}

function migrateLegacyToV2() {
  const { users, holdings, trades } = snapshotLegacyData();
  dropLegacyTables();
  createV2Tables();

  const userIdMap = new Map();

  for (const u of users) {
    const email = legacyEmailFromUsername(u.username);
    const verifiedAt = u.role === 'admin' ? new Date().toISOString() : null;

    const result = prepare(
      `INSERT INTO users (username, first_name, last_name, email, password_hash, role, status, email_verified_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
    ).run(
      u.username,
      u.role === 'admin' ? 'System' : null,
      u.role === 'admin' ? 'Administrator' : null,
      email,
      u.password_hash,
      u.role,
      verifiedAt,
      u.created_at,
      u.created_at
    );

    const newUserId = result.lastInsertRowid;
    userIdMap.set(u.id, newUserId);

    prepare(
      'INSERT INTO portfolios (user_id, cash_balance_usd, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(newUserId, u.balance_usd ?? 10000, u.created_at, u.created_at);
  }

  const portfolioByUser = new Map();
  for (const [oldId, newId] of userIdMap) {
    const p = prepare('SELECT id FROM portfolios WHERE user_id = ?').get(newId);
    portfolioByUser.set(oldId, p.id);
  }

  for (const h of holdings) {
    const portfolioId = portfolioByUser.get(h.user_id);
    if (!portfolioId) continue;
    prepare(
      `INSERT INTO holdings (portfolio_id, coin_id, coin_symbol, coin_name, quantity, avg_cost_usd, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(portfolioId, h.coin_id, h.coin_symbol, h.coin_name, h.amount, h.avg_buy_price);
  }

  for (const t of trades) {
    const newUserId = userIdMap.get(t.user_id);
    const portfolioId = portfolioByUser.get(t.user_id);
    if (!newUserId || !portfolioId) continue;

    const description = t.side === 'buy' ? `Bought ${t.coin_symbol}` : `Sold ${t.coin_symbol}`;

    prepare(
      `INSERT INTO transactions
       (public_id, user_id, portfolio_id, type, amount, currency, asset_symbol, asset_name, coin_id, price_usd, total_usd, status, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`
    ).run(
      `TXN-LEGACY-${t.id}`,
      newUserId,
      portfolioId,
      t.side,
      t.amount_coin,
      t.coin_symbol,
      t.coin_symbol,
      t.coin_name,
      t.coin_id,
      t.price_usd,
      t.total_usd,
      description,
      t.created_at
    );
  }

  persist();
  console.log(`Migrated ${users.length} users, ${holdings.length} holdings, ${trades.length} trades to schema v2`);
}

function seedDefaultAdmin() {
  const admin = prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (admin) {
    const portfolio = prepare('SELECT id FROM portfolios WHERE user_id = ?').get(admin.id);
    if (!portfolio) {
      prepare('INSERT INTO portfolios (user_id, cash_balance_usd) VALUES (?, 10000)').run(admin.id);
      persist();
    }
    return;
  }

  const hash = bcrypt.hashSync('admin123', 10);
  const now = new Date().toISOString();

  const result = prepare(
    `INSERT INTO users (username, first_name, last_name, email, password_hash, role, status, email_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'admin', 'active', ?, datetime('now'), datetime('now'))`
  ).run('admin', 'System', 'Administrator', 'admin@aurex.capital', hash, now);

  prepare('INSERT INTO portfolios (user_id, cash_balance_usd) VALUES (?, 10000)').run(result.lastInsertRowid);
  persist();
  console.log('Seeded default admin account (admin / admin123)');
}

function migrateV2ToV3() {
  if (!tableHasColumn('transactions', 'source')) {
    prepare(
      `ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user','admin','system'))`
    ).run();
  }
  if (!tableHasColumn('transactions', 'admin_id')) {
    prepare('ALTER TABLE transactions ADD COLUMN admin_id INTEGER REFERENCES users(id)').run();
  }
  prepare(
    `UPDATE transactions SET source = 'system' WHERE description = 'Welcome deposit' AND source = 'user'`
  ).run();
  persist();
  console.log('Migrated schema v2 → v3 (dual ledger)');
}

function runMigrations() {
  createSchemaMigrations();
  let current = getSchemaVersion();

  if (current >= SCHEMA_VERSION) return;

  if (isLegacyV1Database()) {
    console.log('Detected legacy schema v1 — migrating to v2...');
    migrateLegacyToV2();
    current = 2;
    setSchemaVersion(2);
  }

  if (current === 0 && isV2WithoutVersionStamp()) {
    if (!prepare('SELECT id FROM users LIMIT 1').get()) seedDefaultAdmin();
    current = 2;
    setSchemaVersion(2);
    console.log('Schema v2 detected — stamped migration version');
  }

  if (current < 2) {
    createV2Tables();
    seedDefaultAdmin();
    setSchemaVersion(2);
    current = 2;
    console.log('Database schema v2 ready');
  }

  if (current < 3) {
    migrateV2ToV3();
    setSchemaVersion(3);
    console.log('Database schema v3 ready');
  }
}

module.exports = { runMigrations, seedDefaultAdmin, isLegacyV1Database };
