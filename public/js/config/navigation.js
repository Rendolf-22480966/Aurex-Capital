/**
 * Global navigation + mega menu configuration (Phase 3 will render mega menus from this).
 */
export const GLOBAL_NAV = [
  { id: 'cryptocurrencies', label: 'Cryptocurrencies', href: '/cryptocurrencies', megaKey: 'cryptocurrencies' },
  { id: 'exchanges', label: 'Exchanges', href: '/exchanges', megaKey: 'exchanges' },
  { id: 'rwa', label: 'RWA', href: '/rwa', megaKey: 'rwa' },
  { id: 'learn', label: 'Learn', href: '/learn', megaKey: 'learn' },
  { id: 'products', label: 'Products', href: '/products', megaKey: 'products' },
  { id: 'api', label: 'API', href: '/api', megaKey: null },
];

export const MARKET_NAV = [
  { id: 'overview', label: 'Overview', href: '/', view: 'overview' },
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', view: 'dashboard', authHighlight: true },
  { id: 'markets', label: 'Markets', href: '/markets', view: 'markets' },
  { id: 'trending', label: 'Trending', href: '/trending', view: 'trending' },
  { id: 'gainers', label: 'Gainers', href: '/gainers', view: 'gainers' },
  { id: 'losers', label: 'Losers', href: '/losers', view: 'losers' },
  { id: 'watchlist', label: 'Watchlist', href: '/watchlist', view: 'watchlist' },
  { id: 'activity', label: 'Activity', href: '/activity', view: 'activity' },
];

/** Mega menu structure — consumed in Phase 3 */
export const MEGA_MENUS = {
  cryptocurrencies: {
    columns: [
      {
        title: 'Browse',
        items: [
          { label: 'By Market Cap', href: '/markets', live: true },
          { label: 'Categories', href: '/cryptocurrencies', placeholder: true },
          { label: 'Chains', href: '/cryptocurrencies', placeholder: true },
        ],
      },
      {
        title: 'Discover',
        items: [
          { label: 'Trending', href: '/trending', live: true },
          { label: 'Gainers', href: '/gainers', live: true },
          { label: 'Losers', href: '/losers', live: true },
          { label: 'Highlights', href: '/cryptocurrencies', placeholder: true },
          { label: 'New Cryptocurrencies', href: '/cryptocurrencies', placeholder: true },
        ],
      },
      {
        title: 'More',
        items: [
          { label: 'Rehypothecated', href: '/cryptocurrencies', placeholder: true },
          { label: 'Crypto Treasuries', href: '/cryptocurrencies', placeholder: true },
          { label: 'NFTs', href: '/cryptocurrencies', placeholder: true },
        ],
      },
    ],
  },
  exchanges: {
    columns: [
      {
        title: 'Venues',
        items: [
          { label: 'Crypto Exchanges', href: '/exchanges', placeholder: true },
          { label: 'Decentralized Exchanges', href: '/exchanges', placeholder: true },
          { label: 'Derivatives', href: '/exchanges', placeholder: true },
          { label: 'Perpetual DEXs', href: '/exchanges', placeholder: true },
        ],
      },
    ],
  },
  rwa: {
    columns: [
      {
        title: 'Real World Assets',
        items: [
          { label: 'By Market Cap', href: '/rwa', placeholder: true },
          { label: 'Stocks', href: '/rwa', placeholder: true },
          { label: 'Commodities', href: '/rwa', placeholder: true },
        ],
      },
    ],
  },
  learn: {
    columns: [
      {
        title: 'Learn',
        items: [
          { label: 'Learn Crypto', href: '/learn', placeholder: true },
          { label: 'Research & Insights', href: '/learn', placeholder: true },
          { label: 'News', href: '/news', live: true },
          { label: 'Reports', href: '/learn', placeholder: true },
        ],
      },
      {
        title: 'Resources',
        items: [
          { label: 'Learn & Earn', href: '/learn', placeholder: true },
          { label: 'Videos', href: '/learn', placeholder: true },
          { label: 'Newsletter', href: '/learn', placeholder: true },
          { label: 'Glossary', href: '/learn', placeholder: true },
        ],
      },
    ],
  },
  products: {
    columns: [
      {
        title: 'Platform',
        items: [
          { label: 'Crypto Portfolio', href: '/dashboard', live: true },
          { label: 'Aurex Capital App', href: '/products', placeholder: true },
          { label: 'Aurex Capital Premium', href: '/products', placeholder: true },
        ],
      },
      {
        title: 'Business',
        items: [
          { label: 'Advertising', href: '/advertising', live: true },
          { label: 'Crypto Widget', href: '/products', placeholder: true },
          { label: 'AurexTerminal', href: '/products', placeholder: true },
        ],
      },
    ],
  },
};
