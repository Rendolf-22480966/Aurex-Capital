/** Market workspace routes (secondary navigation) */
export const MARKET_ROUTES = {
  overview: { path: '/', view: 'overview', title: 'Global Market Overview' },
  dashboard: { path: '/dashboard', view: 'dashboard', title: 'Dashboard' },
  markets: { path: '/markets', view: 'markets', title: 'Cryptocurrency Markets' },
  trending: { path: '/trending', view: 'trending', title: 'Trending Coins' },
  gainers: { path: '/gainers', view: 'gainers', title: 'Top Gainers' },
  losers: { path: '/losers', view: 'losers', title: 'Top Losers' },
  watchlist: { path: '/watchlist', view: 'watchlist', title: 'Watchlist' },
  activity: { path: '/activity', view: 'activity', title: 'Activity' },
  news: { path: '/news', view: 'news', title: 'Crypto News' },
  coin: { path: '/coin/:id', view: 'coin', title: 'Coin Detail' },
};

/** Legacy view name aliases */
export const VIEW_ALIASES = {
  trades: 'activity',
  coinDetail: 'coin',
};

function legalPage(path, title, heading, summary) {
  return {
    path,
    title: `${title} — Aurex Capital`,
    eyebrow: 'Legal',
    heading,
    summary,
    sections: [],
    cta: { label: 'Return to markets', href: '/' },
  };
}

/** Static / placeholder content pages (global navigation destinations) */
export const PLACEHOLDER_PAGES = {
  api: {
    path: '/api',
    title: 'Aurex Capital API',
    eyebrow: 'Developers',
    heading: 'Market data API for builders',
    summary:
      'Aurex Capital is preparing a developer platform for programmatic access to market data, portfolio tools, and platform integrations. Documentation and pricing will be published when the API program launches.',
    sections: [
      {
        title: 'Planned capabilities',
        items: [
          'REST endpoints for market snapshots and coin metadata',
          'Authentication and rate-limit tiers',
          'Developer documentation and SDK guidance',
          'Sandbox keys for evaluation',
        ],
      },
      {
        title: 'Current status',
        items: [
          'Internal market-data proxy is operational for the Aurex web platform',
          'Public API keys and external developer access are not yet available',
        ],
      },
    ],
    cta: { label: 'Return to markets', href: '/' },
  },
  exchanges: {
    path: '/exchanges',
    title: 'Exchanges — Aurex Capital',
    eyebrow: 'Markets',
    heading: 'Exchange coverage',
    summary:
      'Aurex Capital will expand beyond spot cryptocurrency listings to include exchange intelligence, decentralized venues, and derivatives markets. This section is under active development.',
    sections: [
      {
        title: 'Planned areas',
        items: ['Centralized exchanges', 'Decentralized exchanges', 'Derivatives', 'Perpetual DEXs'],
      },
    ],
    cta: { label: 'Browse cryptocurrencies', href: '/markets' },
  },
  rwa: {
    path: '/rwa',
    title: 'Real World Assets — Aurex Capital',
    eyebrow: 'RWA',
    heading: 'Tokenized real-world assets',
    summary:
      'Real World Asset (RWA) market data — including tokenized equities, commodities, and on-chain treasuries — will be integrated when curated data sources are connected.',
    sections: [
      {
        title: 'Planned coverage',
        items: ['By market cap', 'Stocks', 'Commodities'],
      },
    ],
    cta: { label: 'View crypto markets', href: '/markets' },
  },
  learn: {
    path: '/learn',
    title: 'Learn — Aurex Capital',
    eyebrow: 'Education',
    heading: 'Learn crypto with Aurex Capital',
    summary:
      'Educational content, research, and market insights will be published here. Aurex Capital does not yet operate a full learning portal; this page outlines the roadmap.',
    sections: [
      {
        title: 'Planned content',
        items: [
          'Learn Crypto',
          'Research & Insights',
          { label: 'Crypto News', href: '/news', live: true },
          'Reports',
          'Learn & Earn',
          'Videos',
          'Newsletter',
          'Glossary',
        ],
      },
    ],
    cta: { label: 'Explore live markets', href: '/' },
  },
  products: {
    path: '/products',
    title: 'Products — Aurex Capital',
    eyebrow: 'Products',
    heading: 'Aurex Capital product suite',
    summary:
      'Aurex Capital offers paper trading and portfolio tools today, with additional products planned for future release. Only features that are live are linked below.',
    sections: [
      {
        title: 'Available now',
        items: [
          { label: 'Crypto Portfolio (Dashboard)', href: '/dashboard', live: true },
          { label: 'Live market terminal', href: '/markets', live: true },
        ],
      },
      {
        title: 'In development',
        items: [
          'Aurex Capital App',
          { label: 'Aurex Capital Premium', href: '/products', placeholder: true },
          { label: 'Advertising', href: '/advertising', live: true },
          { label: 'Crypto Widget', href: '/products', placeholder: true },
          'AurexTerminal',
        ],
      },
    ],
    cta: { label: 'Open dashboard', href: '/dashboard' },
  },
  advertising: {
    path: '/advertising',
    title: 'Advertising — Aurex Capital',
    eyebrow: 'Business',
    heading: 'Advertise on Aurex Capital',
    summary:
      'Aurex Capital offers premium placements across the market terminal for crypto projects, exchanges, and financial services. Ad slots are architected and ready — connect your network to go live.',
    sections: [
      {
        title: 'Available placements',
        items: [
          { label: 'Overview leaderboard (728×90)', href: '/', live: true },
          { label: 'Markets leaderboard (728×90)', href: '/markets', live: true },
          { label: 'News sidebar (300×250)', href: '/news', live: true },
        ],
      },
      {
        title: 'Enable ads on your instance',
        items: [
          'Set AD_NETWORK and AD_PUBLISHER_ID in server .env',
          'Restart the Aurex Capital server',
          'Slots fill automatically — no frontend changes required',
        ],
      },
      {
        title: 'Supported networks (planned)',
        items: ['Google AdSense', 'Carbon Ads', 'Custom HTML creatives'],
      },
    ],
    cta: { label: 'View market overview', href: '/' },
  },
  cryptocurrencies: {
    path: '/cryptocurrencies',
    title: 'Cryptocurrencies — Aurex Capital',
    eyebrow: 'Cryptocurrencies',
    heading: 'Browse digital assets',
    summary:
      'Explore live cryptocurrency market data ranked by market capitalization, volume, and price performance. Advanced category and chain filters will be added in a future release.',
    sections: [
      {
        title: 'Browse now',
        items: [
          { label: 'All markets by market cap', href: '/markets', live: true },
          { label: 'Trending', href: '/trending', live: true },
          { label: 'Top gainers', href: '/gainers', live: true },
          { label: 'Top losers', href: '/losers', live: true },
        ],
      },
      {
        title: 'Coming soon',
        items: ['Categories', 'Chains', 'NFTs', 'Crypto Treasuries', 'Highlights', 'New listings'],
      },
    ],
    cta: { label: 'View all markets', href: '/markets' },
  },
  'legal/terms': legalPage(
    '/legal/terms',
    'Terms of Service',
    'Terms of Service',
    'Formal terms of service for Aurex Capital will be published here. The platform currently operates as a paper-trading and market-data demonstration environment.'
  ),
  'legal/privacy': legalPage(
    '/legal/privacy',
    'Privacy Policy',
    'Privacy Policy',
    'Aurex Capital privacy practices and data handling policies will be documented on this page.'
  ),
  'legal/disclaimer': {
    path: '/legal/disclaimer',
    title: 'Disclaimer — Aurex Capital',
    eyebrow: 'Legal',
    heading: 'Important disclaimer',
    summary:
      'All content on Aurex Capital and linked platforms is for general information only, procured from third party sources. We make no warranties regarding accuracy or updatedness.',
    sections: [
      {
        title: 'General information',
        items: [
          'All content provided herein on our website, hyperlinked sites, associated applications, forums, blogs, social media accounts and other platforms ("Site") is for your general information only, procured from third party sources.',
          'We make no warranties of any kind in relation to our content, including but not limited to accuracy and updatedness.',
          'No part of the content that we provide constitutes financial advice, legal advice or any other form of advice meant for your specific reliance for any purpose.',
        ],
      },
      {
        title: 'Your responsibility',
        items: [
          'Any use or reliance on our content is solely at your own risk and discretion.',
          'You should conduct your own research, review, analyse and verify our content before relying on them.',
          'No content on our Site is meant to be a solicitation or offer.',
        ],
      },
      {
        title: 'Trading risk',
        items: [
          'Trading is a highly risky activity that can lead to major losses.',
          'Please consult your financial advisor before making any decision.',
        ],
      },
    ],
    cta: { label: 'Return to markets', href: '/markets' },
  },
};

export function pathForView(view, params = {}, query = {}) {
  const normalized = VIEW_ALIASES[view] || view;
  const entry = Object.values(MARKET_ROUTES).find((r) => r.view === normalized);
  if (!entry) return '/';

  let path = entry.path;
  if (normalized === 'coin' && params.id) {
    path = `/coin/${encodeURIComponent(params.id)}`;
  }

  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const q = qs.toString();
  return q ? `${path}?${q}` : path;
}

export function viewFromPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path.startsWith('/coin/')) {
    const id = decodeURIComponent(path.slice('/coin/'.length).split('/')[0]);
    if (id) return { type: 'market', view: 'coin', params: { id } };
  }

  for (const route of Object.values(MARKET_ROUTES)) {
    if (route.path === path) {
      return { type: 'market', view: route.view, params: {} };
    }
  }

  return { type: 'market', view: 'overview', params: {} };
}

export function getPlaceholderByPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return Object.entries(PLACEHOLDER_PAGES).find(([, p]) => p.path === path) || null;
}
