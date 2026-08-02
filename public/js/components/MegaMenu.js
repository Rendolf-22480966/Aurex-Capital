import { MEGA_MENUS } from '../config/navigation.js';
import { iconForItem } from './icons.js';

let panel = null;
let backdrop = null;
let activeKey = null;
let closeTimer = null;
let triggers = [];

function renderItem(item) {
  const icon = iconForItem(item.label);
  const isLink = item.href && !item.placeholder;
  const tag = isLink ? 'a' : 'span';
  const href = isLink ? ` href="${item.href}" data-route="${item.href}"` : '';
  const cls = item.placeholder ? 'mega-menu-item is-planned' : 'mega-menu-item';
  const badge = item.placeholder ? '<span class="mega-badge">Planned</span>' : '';
  return `<li>
    <${tag} class="${cls}"${href} role="menuitem">
      <span class="mega-item-icon">${icon}</span>
      <span class="mega-item-text">${item.label}</span>
      ${badge}
    </${tag}>
  </li>`;
}

function renderPanel(key) {
  const menu = MEGA_MENUS[key];
  if (!menu || !panel) return;

  const columns = menu.columns
    .map(
      (col) => `
      <div class="mega-menu-column">
        <p class="mega-menu-column-title">${col.title}</p>
        <ul class="mega-menu-list">${col.items.map(renderItem).join('')}</ul>
      </div>`
    )
    .join('');

  panel.innerHTML = `
    <div class="mega-menu-inner" role="menu" aria-label="${key} menu">
      ${columns}
    </div>`;
}

function setExpanded(key, expanded) {
  triggers.forEach((btn) => {
    const on = btn.dataset.mega === key && expanded;
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    btn.classList.toggle('is-open', on);
  });
}

export function closeMegaMenu() {
  clearTimeout(closeTimer);
  activeKey = null;
  panel?.classList.add('hidden');
  panel?.classList.remove('is-visible');
  triggers.forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
    btn.classList.remove('is-open');
  });
}

export function openMegaMenu(key) {
  if (!MEGA_MENUS[key] || !panel) return;
  clearTimeout(closeTimer);
  activeKey = key;
  renderPanel(key);
  panel.classList.remove('hidden');
  requestAnimationFrame(() => panel.classList.add('is-visible'));
  setExpanded(key, true);
}

export function toggleMegaMenu(key) {
  if (activeKey === key) closeMegaMenu();
  else openMegaMenu(key);
}

function scheduleClose() {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(closeMegaMenu, 120);
}

function cancelClose() {
  clearTimeout(closeTimer);
}

export function initMegaMenu(root = document) {
  panel = root.getElementById('megaMenuPanel');
  backdrop = root.getElementById('megaMenuBackdrop');
  if (!panel) return;

  triggers = [...root.querySelectorAll('[data-mega]')];

  triggers.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMegaMenu(btn.dataset.mega);
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleMegaMenu(btn.dataset.mega);
      }
      if (e.key === 'Escape') closeMegaMenu();
    });

    btn.addEventListener('mouseenter', () => {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        cancelClose();
        openMegaMenu(btn.dataset.mega);
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (window.matchMedia('(min-width: 1024px)').matches) scheduleClose();
    });
  });

  panel.addEventListener('mouseenter', cancelClose);
  panel.addEventListener('mouseleave', () => {
    if (window.matchMedia('(min-width: 1024px)').matches) scheduleClose();
  });

  panel.addEventListener('click', (e) => {
    const link = e.target.closest('[data-route]');
    if (link) closeMegaMenu();
  });

  backdrop?.addEventListener('click', closeMegaMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeKey) closeMegaMenu();
  });

  document.addEventListener('click', (e) => {
    if (!activeKey) return;
    if (e.target.closest('#megaMenuPanel') || e.target.closest('[data-mega]')) return;
    closeMegaMenu();
  });
}
