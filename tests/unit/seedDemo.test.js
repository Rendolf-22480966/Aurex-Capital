const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `aurex-seed-test-${Date.now()}`);

before(async () => {
  process.env.DATA_DIR = tmpDir;
  process.env.JWT_SECRET = 'seed-test';
  const db = require('../../server/db');
  await db.init();
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('seedRendolfDemoUser creates portfolio with holdings and transactions', () => {
  const db = require('../../server/db');
  const { DEMO_EMAIL } = require('../../server/db/seedDemoUser');

  const user = db.findUserByEmail(DEMO_EMAIL);
  assert.ok(user);
  assert.equal(user.first_name, 'Rendolf');

  const holdings = db.getHoldings(user.id);
  assert.equal(holdings.length, 5);

  const stats = db.getUserTransactionStats(user.id);
  assert.equal(stats.total_transactions, 36);

  const auth = db.authenticateUser(DEMO_EMAIL, 'Rendolf488$');
  assert.ok(auth);
});
