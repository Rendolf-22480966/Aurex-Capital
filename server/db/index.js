const { initConnection } = require('./connection');
const { runMigrations } = require('./migrate');
const repository = require('./repository');
const audit = require('./audit');
const sessions = require('./sessions');
const emailTokens = require('./emailTokens');
const ledger = require('./ledger');
const adminUsers = require('./adminUsers');
const watchlists = require('./watchlists');

async function init() {
  await initConnection();
  runMigrations();
  const { seedRendolfDemoUser } = require('./seedDemoUser');
  await seedRendolfDemoUser();
  console.log('SQLite ready (schema v3 — dual ledger)');
}

module.exports = {
  init,
  ...repository,
  ...audit,
  ...sessions,
  ...emailTokens,
  ...ledger,
  ...adminUsers,
  ...watchlists,
};
