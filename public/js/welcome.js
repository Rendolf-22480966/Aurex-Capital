const WELCOME_DURATION_MS = 10_000;
let welcomeTimer = null;

function firstName(user) {
  if (!user) return 'there';
  return user.first_name || user.username || 'there';
}

export function showWelcomeBanner(user) {
  const banner = document.getElementById('welcomeBanner');
  if (!banner) return;

  const nameEl = document.getElementById('welcomeName');
  if (nameEl) nameEl.textContent = firstName(user);

  banner.classList.remove('hidden', 'welcome-banner-out');
  requestAnimationFrame(() => banner.classList.add('welcome-banner-in'));

  clearTimeout(welcomeTimer);
  welcomeTimer = setTimeout(hideWelcomeBanner, WELCOME_DURATION_MS);
}

export function hideWelcomeBanner() {
  clearTimeout(welcomeTimer);
  welcomeTimer = null;

  const banner = document.getElementById('welcomeBanner');
  if (!banner || banner.classList.contains('hidden')) return;

  banner.classList.remove('welcome-banner-in');
  banner.classList.add('welcome-banner-out');

  setTimeout(() => {
    banner.classList.add('hidden');
    banner.classList.remove('welcome-banner-out');
  }, 300);
}

export function dismissWelcomeIfVisible() {
  const banner = document.getElementById('welcomeBanner');
  if (banner?.classList.contains('welcome-banner-in')) {
    hideWelcomeBanner();
  }
}
