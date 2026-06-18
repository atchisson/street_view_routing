// Maintenance banner.
//
// Reads maintenance.json at startup; if `enabled` is true, shows a dismissible
// orange banner at the top of the page with `message` (and optional `until`).
//
// To toggle maintenance mode: just edit maintenance.json — no rebuild needed:
//   { "enabled": true, "message": "…", "until": "jusqu'au 15 juillet" }
// Set "enabled" back to false when the router is available again.

const STORAGE_KEY = 'maintenance-dismissed';

export async function setupMaintenanceBanner() {
  let cfg;
  try {
    const res = await fetch('./maintenance.json', { cache: 'no-store' });
    if (!res.ok) return;
    cfg = await res.json();
  } catch {
    return; // no config / unreadable → no banner
  }

  if (!cfg || cfg.enabled !== true || !cfg.message) return;

  const text = cfg.until ? `${cfg.message} (${cfg.until})` : String(cfg.message);

  // Don't reshow a banner the user already dismissed (until the message changes).
  try {
    if (localStorage.getItem(STORAGE_KEY) === text) return;
  } catch { /* localStorage unavailable → always show */ }

  const banner = document.createElement('div');
  banner.className = 'maintenance-banner';
  banner.id = 'maintenance-banner';
  banner.setAttribute('role', 'alert');

  const span = document.createElement('span');
  span.className = 'maintenance-banner-text';
  span.textContent = text; // textContent → no HTML injection from the config

  const close = document.createElement('button');
  close.className = 'maintenance-banner-close';
  close.setAttribute('aria-label', 'Fermer');
  close.innerHTML = '&times;';

  const clearOffset = () => document.documentElement.style.setProperty('--maint-h', '0px');

  close.addEventListener('click', () => {
    banner.remove();
    clearOffset();
    try { localStorage.setItem(STORAGE_KEY, text); } catch { /* ignore */ }
  });

  banner.append(span, close);
  document.body.prepend(banner);

  // Offset the top-anchored UI (search, panel, attribution) by the banner height.
  const setOffset = () =>
    document.documentElement.style.setProperty('--maint-h', `${banner.offsetHeight}px`);
  setOffset();
  window.addEventListener('resize', setOffset);
}
