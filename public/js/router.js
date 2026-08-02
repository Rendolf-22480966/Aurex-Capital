import { pathForView, viewFromPath, VIEW_ALIASES } from './config/routes.js';
import { getPlaceholderPageId } from './views/PlaceholderView.js';

let handler = null;
let suppressNextPop = false;
function parseQuery(search) {
  const query = {};
  new URLSearchParams(search || '').forEach((v, k) => {
    query[k] = v;
  });
  return query;
}

export function resolveRoute(locationLike = window.location) {
  const pathname = locationLike.pathname || '/';
  const query = parseQuery(locationLike.search);

  const placeholderId = getPlaceholderPageId(pathname);
  if (placeholderId) {
    return { type: 'placeholder', pageId: placeholderId, view: null, params: {}, query };
  }

  const match = viewFromPath(pathname);
  return { ...match, query };
}

export function initRouter(onRoute) {
  handler = onRoute;

  window.addEventListener('popstate', () => {
    if (suppressNextPop) {
      suppressNextPop = false;
      return;
    }
    handler?.(resolveRoute());
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-route], a[href^="/"]');
    if (!link || link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const href = link.getAttribute('data-route') || link.getAttribute('href');
    if (!href || href.startsWith('//') || href.startsWith('/api') || href.startsWith('/admin')) return;
    if (/^https?:/i.test(href)) return;
    e.preventDefault();
    navigate(href);
  });

  handler(resolveRoute());
}

export function navigate(path, { replace = false } = {}) {
  const url = path.startsWith('/') ? path : `/${path}`;
  if (replace) {
    window.history.replaceState({ path: url }, '', url);
  } else if (`${window.location.pathname}${window.location.search}` !== url) {
    window.history.pushState({ path: url }, '', url);
  }
  handler?.(resolveRoute());
}

export function navigateView(view, { params = {}, query = {}, replace = false } = {}) {
  const normalized = VIEW_ALIASES[view] || view;
  const path = pathForView(normalized, params, query);
  navigate(path, { replace });
}

export function getPathForView(view, params = {}, query = {}) {
  return pathForView(VIEW_ALIASES[view] || view, params, query);
}

/** Prevent popstate when replacing URL during auth param cleanup */
export function suppressPopOnce() {
  suppressNextPop = true;
}
