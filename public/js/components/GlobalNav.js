import { GLOBAL_NAV } from '../config/navigation.js';

function renderNavItem(item) {
  if (item.megaKey) {
    return `<div class="global-nav-item">
      <button type="button" class="global-nav-trigger" data-mega="${item.megaKey}"
        aria-haspopup="true" aria-expanded="false" aria-controls="megaMenuPanel">
        ${item.label}
        <svg class="global-nav-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
    </div>`;
  }
  return `<a href="${item.href}" class="global-nav-link" data-route="${item.href}">${item.label}</a>`;
}

export function renderGlobalNav(container) {
  if (!container) return;
  container.innerHTML = GLOBAL_NAV.map(renderNavItem).join('');
}

export function initGlobalNav() {
  renderGlobalNav(document.getElementById('globalNav'));
}
