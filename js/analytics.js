// Analytics wrapper – thin layer over Matomo's _paq queue.
// All calls are no-ops if Matomo hasn't loaded (e.g. ad-blocker).

export function trackEvent(category, action, name, value) {
  const _paq = window._paq;
  if (!Array.isArray(_paq)) return;
  const args = ['trackEvent', category, action];
  if (name  !== undefined) args.push(String(name));
  if (value !== undefined) args.push(Number(value));
  _paq.push(args);
}
