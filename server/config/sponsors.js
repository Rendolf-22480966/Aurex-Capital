/**
 * Aurex Capital sponsor roster — drop logo files into public/assets/sponsors/
 * and update logo paths here. URLs are editable for production.
 */
const SPONSORS = [
  {
    id: 'first-choice-cu',
    label: 'First Choice Credit Union',
    headline: 'Bank smarter with First Choice Credit Union',
    subline: 'Checking, savings, loans & digital banking built for your community',
    cta: 'Learn more',
    click_url: 'https://www.firstchoicecreditunion.com',
    external: true,
    theme: 'finance',
    logo: '/assets/sponsors/first-choice-cu.svg',
  },
  {
    id: 'speed-shipping',
    label: 'Speed Shipping & Security',
    headline: 'Speed Shipping & Security Company',
    subline: 'Fast freight, secure logistics & 24/7 shipment protection worldwide',
    cta: 'Get a quote',
    click_url: 'https://www.speedshippingsecurity.com',
    external: true,
    theme: 'logistics',
    logo: '/assets/sponsors/speed-shipping.svg',
  },
  {
    id: 'tiffany-co',
    label: 'Tiffany & Co.',
    headline: 'Tiffany & Co. — Iconic fine jewelry',
    subline: 'Engagement, diamonds & timeless gifts crafted to celebrate every moment',
    cta: 'Explore collection',
    click_url: 'https://www.tiffany.com',
    external: true,
    theme: 'luxury',
    logo: '/assets/sponsors/tiffany-co.svg',
  },
  {
    id: 'true-religion',
    label: 'True Religion',
    headline: 'True Religion — Premium denim & apparel',
    subline: 'Bold fits, signature stitching & street-luxury style for every season',
    cta: 'Shop now',
    click_url: 'https://www.truereligion.com',
    external: true,
    theme: 'fashion',
    logo: '/assets/sponsors/true-religion.svg',
  },
  {
    id: 'prestige-jewellers',
    label: 'Prestige Jewellers',
    headline: 'Prestige Jewellers — Diamonds & gold',
    subline: 'Custom pieces, certified stones & private client consultations',
    cta: 'Book visit',
    click_url: 'https://www.prestigejewellers.com',
    external: true,
    theme: 'luxury',
    logo: '/assets/sponsors/prestige-jewellers.svg',
  },
  {
    id: 'aurum-collection',
    label: 'Aurum Collection',
    headline: 'Aurum Collection — Modern luxury watches',
    subline: 'Swiss-inspired timepieces & limited-edition precious-metal accessories',
    cta: 'View lookbook',
    click_url: 'https://www.aurumcollection.com',
    external: true,
    theme: 'luxury',
    logo: '/assets/sponsors/aurum-collection.svg',
  },
];

function toBanner(sponsor, format = '728x90') {
  return {
    type: 'banner',
    id: sponsor.id,
    theme: sponsor.theme,
    badge: 'Sponsored',
    label: sponsor.label,
    headline: sponsor.headline,
    subline: sponsor.subline,
    cta: sponsor.cta,
    image_url: sponsor.logo,
    click_url: sponsor.click_url,
    external: sponsor.external,
    format,
  };
}

function getRotationPool(format = '728x90') {
  return SPONSORS.map((s) => toBanner(s, format));
}

function getSidebarPool() {
  return SPONSORS.map((s) => toBanner(s, '300x250'));
}

module.exports = { SPONSORS, toBanner, getRotationPool, getSidebarPool };
