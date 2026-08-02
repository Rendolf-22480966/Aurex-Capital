import { PLACEHOLDER_PAGES, getPlaceholderByPath } from '../config/routes.js';

function renderListItem(item) {
  if (typeof item === 'string') return `<li>${item}</li>`;
  if (item.href) {
    const tag = item.live ? 'a' : 'span';
    const attrs = item.live ? ` href="${item.href}" data-route="${item.href}"` : ' class="placeholder-item"';
    return `<li><${tag}${attrs}>${item.label}${item.live ? '' : ' <em>(planned)</em>'}</${tag}></li>`;
  }
  return `<li>${item.label || item}</li>`;
}

export function renderPlaceholderPage(pageId) {
  const page = PLACEHOLDER_PAGES[pageId];
  const root = document.getElementById('placeholderContent');
  if (!page || !root) return;

  document.title = page.title;

  const sections = (page.sections || [])
    .map(
      (section) => `
      <div class="placeholder-section panel">
        <h2>${section.title}</h2>
        <ul class="placeholder-list">${section.items.map(renderListItem).join('')}</ul>
      </div>`
    )
    .join('');

  root.innerHTML = `
    <div class="placeholder-page">
      <p class="placeholder-eyebrow">${page.eyebrow}</p>
      <h1>${page.heading}</h1>
      <p class="placeholder-summary">${page.summary}</p>
      ${sections ? `<div class="placeholder-sections">${sections}</div>` : ''}
      ${
        page.cta
          ? `<p class="placeholder-cta"><a href="${page.cta.href}" class="btn btn-primary btn-sm" data-route="${page.cta.href}">${page.cta.label}</a></p>`
          : ''
      }
    </div>`;
}

export function getPlaceholderPageId(pathname) {
  const match = getPlaceholderByPath(pathname);
  return match ? match[0] : null;
}
