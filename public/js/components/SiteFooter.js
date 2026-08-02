import {
  FOOTER_BRAND,
  FOOTER_GROUPS,
  FOOTER_DISCLAIMER,
  FOOTER_ATTRIBUTION,
} from '../config/footer.js';

const YEAR = new Date().getFullYear();

function renderLinkGroup(group) {
  const links = group.links
    .map(
      (link) =>
        `<li><a href="${link.href}" class="site-footer-link" data-route="${link.href}">${link.label}</a></li>`
    )
    .join('');
  return `
    <div class="site-footer-col">
      <h3 class="site-footer-col-title">${group.title}</h3>
      <ul class="site-footer-links">${links}</ul>
    </div>`;
}

export function renderSiteFooter() {
  const root = document.getElementById('siteFooter');
  if (!root) return;

  root.innerHTML = `
    <div class="site-footer-inner">
      <div class="site-footer-top">
        <div class="site-footer-brand">
          <a href="/" class="site-footer-logo" data-route="/">
            <span class="logo-icon">◆</span>
            <span>${FOOTER_BRAND.name}</span>
          </a>
          <p class="site-footer-tagline">${FOOTER_BRAND.tagline}</p>
        </div>
        <div class="site-footer-columns">${FOOTER_GROUPS.map(renderLinkGroup).join('')}</div>
      </div>
    </div>
    <div class="site-footer-disclaimer" role="note">
      <p>${FOOTER_DISCLAIMER}</p>
    </div>
    <div class="site-footer-bottom">
      <span>© ${YEAR} ${FOOTER_BRAND.name}</span>
      <span class="site-footer-sep" aria-hidden="true">·</span>
      <span>${FOOTER_ATTRIBUTION}</span>
    </div>`;
}

export function initSiteFooter() {
  renderSiteFooter();
}
