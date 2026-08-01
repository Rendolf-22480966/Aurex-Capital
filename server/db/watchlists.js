const { prepare } = require('./connection');

const MAX_WATCHLIST = 50;

function normalizeCoinId(coinId) {
  return String(coinId || '').trim().toLowerCase();
}

function getUserWatchlist(userId) {
  return prepare(
    'SELECT coin_id FROM watchlists WHERE user_id = ? ORDER BY created_at ASC'
  )
    .all(userId)
    .map((row) => row.coin_id);
}

function addToWatchlist(userId, coinId) {
  const coin = normalizeCoinId(coinId);
  if (!coin) throw Object.assign(new Error('Invalid coin id'), { code: 'INVALID' });

  const current = getUserWatchlist(userId);
  if (current.includes(coin)) {
    return { watchlisted: true, coin_ids: current };
  }
  if (current.length >= MAX_WATCHLIST) {
    throw Object.assign(new Error(`Watchlist limit reached (${MAX_WATCHLIST} coins)`), {
      code: 'LIMIT',
    });
  }

  prepare('INSERT INTO watchlists (user_id, coin_id) VALUES (?, ?)').run(userId, coin);
  return { watchlisted: true, coin_ids: getUserWatchlist(userId) };
}

function removeFromWatchlist(userId, coinId) {
  const coin = normalizeCoinId(coinId);
  prepare('DELETE FROM watchlists WHERE user_id = ? AND coin_id = ?').run(userId, coin);
  return { watchlisted: false, coin_ids: getUserWatchlist(userId) };
}

function toggleWatchlist(userId, coinId) {
  const coin = normalizeCoinId(coinId);
  const current = getUserWatchlist(userId);
  if (current.includes(coin)) return removeFromWatchlist(userId, coin);
  return addToWatchlist(userId, coin);
}

function syncWatchlist(userId, coinIds = []) {
  const existing = new Set(getUserWatchlist(userId));
  const incoming = [...new Set(coinIds.map(normalizeCoinId).filter(Boolean))];

  for (const coin of incoming) {
    if (existing.size >= MAX_WATCHLIST) break;
    if (existing.has(coin)) continue;
    prepare('INSERT INTO watchlists (user_id, coin_id) VALUES (?, ?)').run(userId, coin);
    existing.add(coin);
  }

  return { coin_ids: getUserWatchlist(userId), max: MAX_WATCHLIST };
}

module.exports = {
  MAX_WATCHLIST,
  getUserWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  toggleWatchlist,
  syncWatchlist,
};
