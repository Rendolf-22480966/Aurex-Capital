import { GLOBAL_NAV, MEGA_MENUS, MARKET_NAV } from '../config/navigation.js';
import { closeMegaMenu } from './MegaMenu.js';

let overlay = null;
let isOpen = false;

function renderMegaSection(key, label) {
  const menu = MEGA_MENUS[key];
  if (!menu) return '';

  const groups = menu.columns
    .map(
      (col) => `
      <div class="mobile-nav-group">
        <p class="mobile-nav-group-title">${col.title}</p>
        ${col.items
          .map((item) => {
            if (item.live && !item.placeholder) {
              return `<a href="${item.href}" class="mobile-nav-sublink" data-route="${item.href}">${item.label}</a>`;
            }
            return `<span class="mobile-nav-sublink is-planned">${item.label} <em>(planned)</em></span>`;
          })
          .join('')}
      </div>`
    )
    .join('');

  return `
    <details class="mobile-nav-details">
      <summary>${label}</summary>
      <div class="mobile-nav-details-body">${groups}</div>
    </details>`;
}

function renderDrawer() {
  const globalLinks = GLOBAL_NAV.map((item) => {
    if (item.megaKey) return renderMegaSection(item.megaKey, item.label);
    return `<a href="${item.href}" class="mobile-nav-link" data-route="${item.href}">${item.label}</a>`;
  }).join('');

  const marketLinks = MARKET_NAV.map(
    (item) =>
      `<a href="${item.href}" class="mobile-nav-market-link${item.authHighlight ? ' user-only hidden' : ''}" data-route="${item.href}" data-view="${item.view}">${item.label}</a>`
  ).join('');

  return `
    <div class="mobile-nav-panel" role="dialog" aria-modal="true" aria-label="Site navigation">
      <div class="mobile-nav-head">
        <span class="mobile-nav-brand">◆ Aurex Capital</span>
        <button type="button" class="mobile-nav-close" id="mobileNavClose" aria-label="Close menu">&times;</button>
      </div>
      <div class="mobile-nav-body">
        <p class="mobile-nav-section-label">Platform</p>
        ${globalLinks}
        <p class="mobile-nav-section-label">Markets</p>
        <div class="mobile-nav-market-grid">${marketLinks}</div>
      </div>
    </div>`;
}

export function closeMobileNav() {
  if (!overlay) return;
  isOpen = false;
  overlay.classList.add('hidden');
  overlay.classList.remove('is-open');
  document.body.classList.remove('mobile-nav-open');
  document.getElementById('mobileMenuBtn')?.setAttribute('aria-expanded', 'false');
}

export function openMobileNav() {
  if (!overlay) return;
  closeMegaMenu();
  isOpen = true;
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('is-open'));
  document.body.classList.add('mobile-nav-open');
  document.getElementById('mobileMenuBtn')?.setAttribute('aria-expanded', 'true');
}

export function initMobileNav() {
  overlay = document.getElementById('mobileNavOverlay');
  const btn = document.getElementById('mobileMenuBtn');
  if (!overlay || !btn) return;

  overlay.innerHTML = renderDrawer();

  btn.addEventListener('click', () => {
    if (isOpen) closeMobileNav();
    else openMobileNav();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeMobileNav();
    if (e.target.id === 'mobileNavClose' || e.target.closest('#mobileNavClose')) closeMobileNav();
    if (e.target.closest('[data-route]')) closeMobileNav();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeMobileNav();
  });
}
