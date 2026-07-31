const KEY = 'aurex_watchlist';

export function getWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function isWatchlisted(coinId) {
  return getWatchlist().includes(coinId);
}

export function toggleWatchlist(coinId) {
  const list = getWatchlist();
  const idx = list.indexOf(coinId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(coinId);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list.includes(coinId);
}

export function removeFromWatchlist(coinId) {
  const list = getWatchlist().filter((id) => id !== coinId);
  localStorage.setItem(KEY, JSON.stringify(list));
}
