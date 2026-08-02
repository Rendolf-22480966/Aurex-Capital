/** Registered ad slot mount points (mirrors server SLOT_REGISTRY). */
export const AD_SLOTS = {
  overview_leaderboard: {
    id: 'overview_leaderboard',
    label: 'Overview Leaderboard',
    format: '728×90',
  },
  markets_leaderboard: {
    id: 'markets_leaderboard',
    label: 'Markets Leaderboard',
    format: '728×90',
  },
  dashboard_leaderboard: {
    id: 'dashboard_leaderboard',
    label: 'Dashboard Leaderboard',
    format: '728×90',
  },
  news_sidebar: {
    id: 'news_sidebar',
    label: 'News Sidebar',
    format: '300×250',
  },
};

export const AD_NETWORKS = [
  { id: 'sponsors', label: 'Sponsor rotation (default)', env: 'AD_NETWORK=sponsors' },
  { id: 'curated', label: 'Curated live promos', env: 'AD_NETWORK=curated' },
  { id: 'google_adsense', label: 'Google AdSense', env: 'AD_NETWORK=google_adsense + AD_PUBLISHER_ID' },
  { id: 'carbon', label: 'Carbon Ads', env: 'AD_NETWORK=carbon + AD_PUBLISHER_ID' },
  { id: 'custom', label: 'Custom HTML', env: 'AD_NETWORK=custom + AD_PUBLISHER_ID' },
];

export const AD_EMPTY_MESSAGE = 'Ad slot loading…';

/** Offline fallback — mirrors server/config/sponsors.js so slots never stay blank. */
export const FALLBACK_SPONSORS = [
  {
    type: 'banner',
    id: 'first-choice-cu',
    theme: 'finance',
    badge: 'Sponsored',
    label: 'First Choice Credit Union',
    headline: 'Bank smarter with First Choice Credit Union',
    subline: 'Checking, savings, loans & digital banking built for your community',
    cta: 'Learn more',
    image_url: '/assets/sponsors/first-choice-cu.svg',
    click_url: 'https://www.firstchoicecreditunion.com',
    external: true,
  },
  {
    type: 'banner',
    id: 'speed-shipping',
    theme: 'logistics',
    badge: 'Sponsored',
    label: 'Speed Shipping & Security',
    headline: 'Speed Shipping & Security Company',
    subline: 'Fast freight, secure logistics & 24/7 shipment protection worldwide',
    cta: 'Get a quote',
    image_url: '/assets/sponsors/speed-shipping.svg',
    click_url: 'https://www.speedshippingsecurity.com',
    external: true,
  },
  {
    type: 'banner',
    id: 'tiffany-co',
    theme: 'luxury',
    badge: 'Sponsored',
    label: 'Tiffany & Co.',
    headline: 'Tiffany & Co. — Iconic fine jewelry',
    subline: 'Engagement, diamonds & timeless gifts crafted to celebrate every moment',
    cta: 'Explore collection',
    image_url: '/assets/sponsors/tiffany-co.svg',
    click_url: 'https://www.tiffany.com',
    external: true,
  },
  {
    type: 'banner',
    id: 'true-religion',
    theme: 'fashion',
    badge: 'Sponsored',
    label: 'True Religion',
    headline: 'True Religion — Premium denim & apparel',
    subline: 'Bold fits, signature stitching & street-luxury style for every season',
    cta: 'Shop now',
    image_url: '/assets/sponsors/true-religion.svg',
    click_url: 'https://www.truereligion.com',
    external: true,
  },
  {
    type: 'banner',
    id: 'prestige-jewellers',
    theme: 'luxury',
    badge: 'Sponsored',
    label: 'Prestige Jewellers',
    headline: 'Prestige Jewellers — Diamonds & gold',
    subline: 'Custom pieces, certified stones & private client consultations',
    cta: 'Book visit',
    image_url: '/assets/sponsors/prestige-jewellers.svg',
    click_url: 'https://www.prestigejewellers.com',
    external: true,
  },
  {
    type: 'banner',
    id: 'aurum-collection',
    theme: 'luxury',
    badge: 'Sponsored',
    label: 'Aurum Collection',
    headline: 'Aurum Collection — Modern luxury watches',
    subline: 'Swiss-inspired timepieces & limited-edition precious-metal accessories',
    cta: 'View lookbook',
    image_url: '/assets/sponsors/aurum-collection.svg',
    click_url: 'https://www.aurumcollection.com',
    external: true,
  },
];

export function fallbackSlot(slotId) {
  const format = slotId?.includes('sidebar') ? '300x250' : '728x90';
  const creatives = FALLBACK_SPONSORS.map((c) => ({ ...c, format }));
  const def = AD_SLOTS[slotId] || { id: slotId, label: slotId, format };
  return {
    ...def,
    active: true,
    creative: creatives[0],
    creatives,
    rotationMs: 30_000,
  };
}
