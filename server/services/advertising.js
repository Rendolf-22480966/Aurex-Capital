/**
 * Advertising — sponsor rotation (default) with optional news fallback.
 */
const { getRotationPool, getSidebarPool } = require('../config/sponsors');

const AD_NETWORK = (process.env.AD_NETWORK || 'sponsors').trim().toLowerCase();
const AD_PUBLISHER_ID = (process.env.AD_PUBLISHER_ID || '').trim();
const ROTATION_MS = Number(process.env.AD_ROTATION_MS) || 30_000;

const SLOT_REGISTRY = {
  overview_leaderboard: { id: 'overview_leaderboard', label: 'Overview Leaderboard', format: '728x90', placement: 'overview' },
  markets_leaderboard: { id: 'markets_leaderboard', label: 'Markets Leaderboard', format: '728x90', placement: 'markets' },
  dashboard_leaderboard: { id: 'dashboard_leaderboard', label: 'Dashboard Leaderboard', format: '728x90', placement: 'dashboard' },
  news_sidebar: { id: 'news_sidebar', label: 'News Sidebar', format: '300x250', placement: 'news' },
};

function isConfigured() {
  if (AD_NETWORK === 'sponsors' || AD_NETWORK === 'curated') return true;
  return Boolean(AD_NETWORK && AD_PUBLISHER_ID);
}

function emptySlot(slotId) {
  const def = SLOT_REGISTRY[slotId];
  if (!def) return null;
  return { ...def, active: false, creative: null, creatives: [] };
}

function buildSlot(slotId) {
  const def = SLOT_REGISTRY[slotId];
  const creatives = slotId === 'news_sidebar' ? getSidebarPool() : getRotationPool();
  return {
    ...def,
    active: creatives.length > 0,
    creative: creatives[0] || null,
    creatives,
    rotationMs: ROTATION_MS,
    meta: { configured: true, network: AD_NETWORK, sponsorCount: creatives.length },
  };
}

async function getSlot(slotId) {
  const def = SLOT_REGISTRY[slotId];
  if (!def) return null;
  if (!isConfigured()) {
    return { ...emptySlot(slotId), meta: { configured: false, message: 'Advertising not configured' } };
  }
  return buildSlot(slotId);
}

async function getAllSlots() {
  if (!isConfigured()) {
    const slots = {};
    for (const id of Object.keys(SLOT_REGISTRY)) slots[id] = emptySlot(id);
    return { configured: false, slots, meta: { network: null, message: 'Advertising not configured' } };
  }

  const slots = {};
  for (const id of Object.keys(SLOT_REGISTRY)) {
    slots[id] = buildSlot(id);
  }

  return {
    configured: true,
    slots,
    meta: {
      network: AD_NETWORK,
      rotationMs: ROTATION_MS,
      sponsorCount: getRotationPool().length,
      refreshedAt: new Date().toISOString(),
    },
  };
}

module.exports = { getAllSlots, getSlot, isConfigured, SLOT_REGISTRY };
