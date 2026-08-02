/** Minimal inline icons for navigation (original Aurex set) */
export const NAV_ICONS = {
  chart: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 12V8M6 12V5M10 12V7M14 12V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  grid: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>',
  link: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l1.5-1.5a3.5 3.5 0 0 0-4.95-4.95L7 4.05" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0l-1.5 1.5a3.5 3.5 0 0 0 4.95 4.95L9 11.95" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  book: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 2.5h4v11H3.5A.5.5 0 0 1 3 13V2.5Zm6 0h4v11H9.5A.5.5 0 0 1 9 13V2.5Z" stroke="currentColor" stroke-width="1.3"/></svg>',
  box: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 5.5 8 2.5l5.5 3v5L8 14.5l-5.5-3v-5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 8v6.5M2.5 5.5 8 8l5.5-2.5" stroke="currentColor" stroke-width="1.3"/></svg>',
  layers: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5 14.5 5 8 8.5 1.5 5 8 1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M1.5 8 8 11.5 14.5 8M1.5 11l6.5 3.5L14.5 11" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  trending: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 11 6 7l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  building: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M6 5h1M9 5h1M6 8h1M9 8h1M6 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
};

export function iconForItem(label) {
  const map = {
    'By Market Cap': 'chart',
    Categories: 'grid',
    Chains: 'link',
    Trending: 'trending',
    Gainers: 'trending',
    Losers: 'chart',
    'Learn Crypto': 'book',
    'Crypto Portfolio': 'box',
    'Crypto Exchanges': 'building',
  };
  const key = map[label] || 'layers';
  return NAV_ICONS[key] || NAV_ICONS.layers;
}
