import { bootstrap } from './app.js';

bootstrap().catch((err) => {
  console.error('[Aurex] Failed to start:', err);
  const root = document.getElementById('app-root');
  if (root) {
    root.insertAdjacentHTML(
      'afterbegin',
      `<div class="server-warning" style="margin:1rem">App failed to load: ${err.message}. Hard refresh (Ctrl+Shift+R) or run <code>npm start</code>.</div>`
    );
  }
});