const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `aurex-wl-test-${Date.now()}`);
let userId;
let limitUserId;

before(async () => {
  process.env.DATA_DIR = tmpDir;
  process.env.JWT_SECRET = 'watchlist-test-secret';
  const db = require('../../server/db');
  await db.init();
  userId = db.registerUser({
    firstName: 'Test',
    lastName: 'User',
    email: `watchlist-${Date.now()}@test.local`,
    password: 'password123',
  });
  limitUserId = db.registerUser({
    firstName: 'Limit',
    lastName: 'User',
    email: `limit-${Date.now()}@test.local`,
    password: 'password123',
  });
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('add, toggle, remove watchlist coins', () => {
  const wl = require('../../server/db/watchlists');

  let result = wl.addToWatchlist(userId, 'bitcoin');
  assert.deepEqual(result.coin_ids, ['bitcoin']);
  assert.equal(result.watchlisted, true);

  result = wl.addToWatchlist(userId, 'ethereum');
  assert.deepEqual(result.coin_ids, ['bitcoin', 'ethereum']);

  result = wl.toggleWatchlist(userId, 'bitcoin');
  assert.equal(result.watchlisted, false);
  assert.deepEqual(result.coin_ids, ['ethereum']);

  result = wl.toggleWatchlist(userId, 'solana');
  assert.deepEqual(result.coin_ids, ['ethereum', 'solana']);

  result = wl.removeFromWatchlist(userId, 'ethereum');
  assert.deepEqual(result.coin_ids, ['solana']);
});

test('syncWatchlist merges without duplicates', () => {
  const wl = require('../../server/db/watchlists');

  wl.addToWatchlist(userId, 'bitcoin');
  const synced = wl.syncWatchlist(userId, ['ethereum', 'bitcoin', 'cardano']);
  assert.ok(synced.coin_ids.includes('bitcoin'));
  assert.ok(synced.coin_ids.includes('ethereum'));
  assert.ok(synced.coin_ids.includes('cardano'));
  assert.equal(new Set(synced.coin_ids).size, synced.coin_ids.length);
});

test('watchlist enforces max limit', () => {
  const wl = require('../../server/db/watchlists');

  for (let i = 0; i < wl.MAX_WATCHLIST; i++) {
    wl.addToWatchlist(limitUserId, `coin-${i}`);
  }

  assert.throws(
    () => wl.addToWatchlist(limitUserId, 'overflow-coin'),
    (err) => err.code === 'LIMIT'
  );
});
