/** Client-side news feed configuration (mirrors server provider setup). */
export const NEWS_PROVIDERS = [
  { id: 'rss', label: 'Live RSS (Decrypt, Cointelegraph, Bitcoin Magazine)', env: 'NEWS_PROVIDER=rss' },
  { id: 'cryptocompare', label: 'CryptoCompare', env: 'NEWS_PROVIDER=cryptocompare + NEWS_API_KEY' },
  { id: 'coingecko', label: 'CoinGecko Analyst', env: 'NEWS_PROVIDER=coingecko + COINGECKO_API_KEY' },
];

export const NEWS_EMPTY_MESSAGE = 'News temporarily unavailable';
