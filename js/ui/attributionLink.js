// Make the "OpenStreetMap contributors" attribution text a clickable link.
//
// MapLibre merges and de-duplicates attributions from every source, including
// remote TileJSON sources (e.g. Mapterhorn) whose attribution contains a plain
// "© OpenStreetMap contributors". That plain text wins over our source-level
// linked attribution, so the link never reaches the DOM. We re-inject it here
// and keep it in place via a MutationObserver (MapLibre rewrites the attribution
// whenever sources/layers change).

const OSM_PLAIN = '© OpenStreetMap contributors';
const OSM_LINK =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

function linkify() {
  document.querySelectorAll('.maplibregl-ctrl-attrib-inner').forEach((el) => {
    // Already linked → nothing to do (also prevents the observer from looping).
    if (el.querySelector('a[href*="openstreetmap.org/copyright"]')) return;
    if (el.innerHTML.includes(OSM_PLAIN)) {
      el.innerHTML = el.innerHTML.replace(OSM_PLAIN, OSM_LINK);
    }
  });
}

export function setupAttributionLink() {
  const container = document.querySelector('.maplibregl-ctrl-attrib');
  if (!container) {
    // Attribution control not in the DOM yet — retry on the next frame.
    requestAnimationFrame(setupAttributionLink);
    return;
  }

  linkify();

  // Re-apply whenever MapLibre rewrites the attribution content.
  const observer = new MutationObserver(() => linkify());
  observer.observe(container, { childList: true, subtree: true, characterData: true });
}
