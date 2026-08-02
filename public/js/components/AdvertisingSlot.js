import { api } from '../api.js';
import { AD_SLOTS, AD_EMPTY_MESSAGE, fallbackSlot } from '../config/advertising.js';

let cache = null;
const rotators = new Map();
const DEFAULT_ROTATION_MS = 30_000;

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linkAttrs(creative) {
  const url = creative.click_url || '#';
  const external = creative.external !== false && /^https?:/i.test(url);
  if (external) {
    return { href: url, attrs: 'target="_blank" rel="noopener noreferrer sponsored"' };
  }
  return { href: url, attrs: `data-route="${escapeHtml(url)}"` };
}

function renderBanner(creative, slotId) {
  const { href, attrs } = linkAttrs(creative);
  const isSidebar = slotId.includes('sidebar');
  const theme = creative.theme || 'news';
  const sizeClass = isSidebar ? 'ad-banner-sidebar' : 'ad-banner-leaderboard';

  return `
    <div class="ad-slot ad-slot-live ${sizeClass} ad-theme-${theme}" role="complementary" aria-label="Advertisement">
      <span class="ad-sponsored-badge">${escapeHtml(creative.badge || 'Sponsored')}</span>
      <a href="${escapeHtml(href)}" ${attrs} class="ad-banner-link">
        ${creative.image_url ? `<img class="ad-banner-img" src="${escapeHtml(creative.image_url)}" alt="${escapeHtml(creative.label || '')}" loading="lazy" />` : '<span class="ad-banner-img-fallback" aria-hidden="true">◆</span>'}
        <span class="ad-banner-copy">
          ${creative.label ? `<em class="ad-banner-label">${escapeHtml(creative.label)}</em>` : ''}
          <strong class="ad-banner-headline">${escapeHtml(creative.headline || '')}</strong>
          ${creative.subline ? `<span class="ad-banner-sub">${escapeHtml(creative.subline)}</span>` : ''}
          ${creative.cta ? `<span class="ad-banner-cta">${escapeHtml(creative.cta)} →</span>` : ''}
        </span>
      </a>
    </div>`;
}

function renderCreative(slotId, creative) {
  if (!creative) return '';

  if (creative.type === 'banner' || creative.headline) {
    return renderBanner(creative, slotId);
  }

  if (creative.type === 'html' && creative.html) {
    return `<div class="ad-slot ad-slot-live ad-slot-html"><span class="ad-sponsored-badge">Sponsored</span>${creative.html}</div>`;
  }

  if (creative.type === 'image' && creative.image_url) {
    const { href, attrs } = linkAttrs(creative);
    return `
      <div class="ad-slot ad-slot-live">
        <span class="ad-sponsored-badge">Sponsored</span>
        <a href="${escapeHtml(href)}" ${attrs}>
          <img src="${escapeHtml(creative.image_url)}" alt="${escapeHtml(creative.alt || 'Advertisement')}" loading="lazy" />
        </a>
      </div>`;
  }

  return '';
}

function renderPlaceholder(slotId, configured = false) {
  const def = AD_SLOTS[slotId] || { label: slotId, format: '' };
  const sizeClass = slotId.includes('sidebar') ? 'ad-slot-sidebar' : 'ad-slot-leaderboard';
  return `
    <div class="ad-slot ad-slot-empty ${sizeClass}" role="complementary" aria-label="Advertisement">
      <div class="ad-slot-inner">
        <span class="ad-slot-eyebrow">Sponsored</span>
        <p class="ad-slot-message">${AD_EMPTY_MESSAGE}</p>
        <p class="ad-slot-detail">${def.label}${def.format ? ` · ${def.format}` : ''}</p>
        ${!configured ? `<a href="/advertising" class="ad-slot-link" data-route="/advertising">Advertising on Aurex →</a>` : ''}
      </div>
    </div>`;
}

function stopRotator(slotId) {
  const timer = rotators.get(slotId);
  if (timer) {
    clearInterval(timer);
    rotators.delete(slotId);
  }
}

function stopAllRotators() {
  for (const slotId of rotators.keys()) stopRotator(slotId);
}

function startRotator(el, slotId, slot) {
  stopRotator(slotId);
  const creatives = slot?.creatives?.length ? slot.creatives : slot?.creative ? [slot.creative] : [];
  if (creatives.length <= 1) return;

  const interval = slot.rotationMs || cache?.meta?.rotationMs || DEFAULT_ROTATION_MS;
  let index = 0;

  const tick = () => {
    index = (index + 1) % creatives.length;
    el.classList.add('ad-slot-fading');
    setTimeout(() => {
      el.innerHTML = renderCreative(slotId, creatives[index]);
      el.classList.remove('ad-slot-fading');
    }, 220);
  };

  rotators.set(slotId, setInterval(tick, interval));
}

function resolveSlot(slotId, slot, configured) {
  if (configured && slot?.active && (slot?.creative || slot?.creatives?.length)) {
    return slot;
  }
  return fallbackSlot(slotId);
}

function renderSlotElement(el, slotId, slot, configured) {
  el.classList.add('ad-slot-wrap');
  el.dataset.adLoaded = 'true';

  const resolved = resolveSlot(slotId, slot, configured);
  const creative = resolved.creative || resolved.creatives?.[0];
  const html = renderCreative(slotId, creative);
  el.innerHTML = html || renderPlaceholder(slotId, true);
  if (html && resolved.creatives?.length > 1) startRotator(el, slotId, resolved);
  else stopRotator(slotId);
}

function primeEmptyMounts() {
  document.querySelectorAll('[data-ad-slot]').forEach((el) => {
    if (el.dataset.adLoaded || el.querySelector('.ad-slot')) return;
    const slot = fallbackSlot(el.dataset.adSlot);
    el.classList.add('ad-slot-wrap');
    el.innerHTML = renderCreative(el.dataset.adSlot, slot.creative) || renderPlaceholder(el.dataset.adSlot, true);
  });
}

export async function loadAdvertisingSlots({ force = false } = {}) {
  if (force) {
    stopAllRotators();
    document.querySelectorAll('[data-ad-slot]').forEach((el) => {
      delete el.dataset.adLoaded;
    });
  }

  const pending = document.querySelectorAll('[data-ad-slot]:not([data-ad-loaded])');
  if (!pending.length && cache && !force) {
    document.querySelectorAll('[data-ad-slot]').forEach((el) => {
      renderSlotElement(el, el.dataset.adSlot, cache.slots?.[el.dataset.adSlot], cache.configured);
    });
    return;
  }

  primeEmptyMounts();

  try {
    cache = await api.getAdSlots();
    document.querySelectorAll('[data-ad-slot]').forEach((el) => {
      renderSlotElement(el, el.dataset.adSlot, cache.slots?.[el.dataset.adSlot], cache.configured);
    });
  } catch (err) {
    console.warn('[Aurex] Ad slots API failed, using fallback sponsors:', err.message);
    cache = { configured: true, slots: {}, meta: { network: 'fallback' } };
    document.querySelectorAll('[data-ad-slot]').forEach((el) => {
      renderSlotElement(el, el.dataset.adSlot, fallbackSlot(el.dataset.adSlot), true);
    });
  }
}

export function initAdvertisingSlots() {
  primeEmptyMounts();
  loadAdvertisingSlots();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAllRotators();
    else if (cache?.configured) loadAdvertisingSlots();
  });
}

export function refreshAdvertisingSlots() {
  loadAdvertisingSlots({ force: true });
}

export function mountVisibleAdSlots(view) {
  const slotByView = {
    overview: 'overview_leaderboard',
    markets: 'markets_leaderboard',
    news: 'news_sidebar',
    dashboard: 'dashboard_leaderboard',
  };
  const slotId = slotByView[view];
  if (!slotId) return;
  const el = document.querySelector(`[data-ad-slot="${slotId}"]:not([data-ad-loaded])`);
  if (el) loadAdvertisingSlots();
}
