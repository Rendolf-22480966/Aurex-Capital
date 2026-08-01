const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dataDir =
  process.env.DATA_DIR ||
  (process.env.RAILWAY_ENVIRONMENT || process.env.RENDER
    ? '/tmp/aurex-data'
    : path.join(__dirname, '..', '..', 'data'));

const dbPath = path.join(dataDir, 'paper-trader.db');

let db = null;
let ready = null;
let inTransaction = false;

function getDb() {
  if (!db) throw new Error('Database not initialized — call init() first');
  return db;
}

function persist() {
  if (!db) return;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function prepare(sql) {
  const database = getDb();
  return {
    get(...params) {
      const stmt = database.prepare(sql);
      if (params.length) stmt.bind(params);
      const row = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return row;
    },
    all(...params) {
      const stmt = database.prepare(sql);
      if (params.length) stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    run(...params) {
      database.run(sql, params);
      if (!inTransaction) persist();
      const idRow = database.exec('SELECT last_insert_rowid() AS id');
      const lastInsertRowid = idRow[0]?.values[0]?.[0] ?? 0;
      return { lastInsertRowid, changes: database.getRowsModified() };
    },
  };
}

function transaction(fn) {
  const database = getDb();
  inTransaction = true;
  database.run('BEGIN');
  try {
    const result = fn();
    database.run('COMMIT');
    inTransaction = false;
    persist();
    return result;
  } catch (err) {
    inTransaction = false;
    try {
      database.run('ROLLBACK');
    } catch {
      /* ignore rollback errors */
    }
    throw err;
  }
}

function tableExists(name) {
  const row = prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(name);
  return !!row;
}

function tableHasColumn(table, column) {
  const rows = prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((r) => r.name === column);
}

async function initConnection() {
  if (ready) return ready;
  ready = (async () => {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const SQL = await initSqlJs({
      locateFile: (file) => path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file),
    });
    db = fs.existsSync(dbPath)
      ? new SQL.Database(fs.readFileSync(dbPath))
      : new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
  })();
  return ready;
}

module.exports = {
  initConnection,
  getDb,
  prepare,
  transaction,
  persist,
  tableExists,
  tableHasColumn,
  dbPath,
  dataDir,
};
