const { prepare } = require('./connection');

const SCHEMA_VERSION = 3;

function createSchemaMigrations() {
  prepare(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
}

function getSchemaVersion() {
  if (!prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get()) {
    return 0;
  }
  const row = prepare('SELECT MAX(version) AS v FROM schema_migrations').get();
  return row?.v ?? 0;
}

function setSchemaVersion(version) {
  prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
}

function createV2Tables() {
  prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      email_verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  prepare(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      cash_balance_usd REAL NOT NULL DEFAULT 10000,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  prepare(`
    CREATE TABLE IF NOT EXISTS holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portfolio_id INTEGER NOT NULL,
      coin_id TEXT NOT NULL,
      coin_symbol TEXT NOT NULL,
      coin_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      avg_cost_usd REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(portfolio_id, coin_id),
      FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
    )
  `).run();

  prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      portfolio_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('deposit','withdrawal','received','sent','buy','sell')),
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      asset_symbol TEXT,
      asset_name TEXT,
      coin_id TEXT,
      price_usd REAL,
      total_usd REAL,
      status TEXT NOT NULL DEFAULT 'completed',
      description TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user','admin','system')),
      admin_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES users(id)
    )
  `).run();

  prepare(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sequence_num INTEGER NOT NULL UNIQUE,
      action TEXT NOT NULL,
      admin_id INTEGER NOT NULL,
      target_user_id INTEGER,
      transaction_id INTEGER,
      payload_json TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      record_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (admin_id) REFERENCES users(id),
      FOREIGN KEY (target_user_id) REFERENCES users(id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    )
  `).run();

  prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  prepare(`
    CREATE TABLE IF NOT EXISTS email_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('verify','reset')),
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  prepare(`
    CREATE TABLE IF NOT EXISTS watchlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coin_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, coin_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  prepare('CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC)').run();
  prepare('CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON holdings(portfolio_id)').run();
  prepare('CREATE INDEX IF NOT EXISTS idx_audit_sequence ON admin_audit_logs(sequence_num)').run();
}

module.exports = {
  SCHEMA_VERSION,
  createSchemaMigrations,
  getSchemaVersion,
  setSchemaVersion,
  createV2Tables,
};
