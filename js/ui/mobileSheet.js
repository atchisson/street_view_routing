// Mobile bottom-sheet controller.
// Reuses the existing .routing-panel DOM and toggles state classes on mobile only.
// Two positions: a always-visible grabber bar ('sheet-peek') and full screen ('sheet-full').
// Desktop (width > 768px) is untouched: no state class is applied.

const MOBILE_MQ = '(max-width: 768px)';
const STATES = ['sheet-peek', 'sheet-full'];
const PEEK_HEIGHT = 28; // px of the grabber bar left visible in peek — matches CSS

let panel = null;
let mq = null;

function isMobile() {
  return mq ? mq.matches : window.matchMedia(MOBILE_MQ).matches;
}

export function setSheetState(state) {
  if (!panel) return;
  STATES.forEach((s) => panel.classList.remove(s));
  panel.classList.add(state);
  window.dispatchEvent(new CustomEvent('routingPanelToggled'));
}

function togglePeekFull() {
  if (!panel) return;
  setSheetState(panel.classList.contains('sheet-full') ? 'sheet-peek' : 'sheet-full');
}

// Apply or clear mobile state depending on viewport.
function syncToViewport() {
  if (!panel) return;
  if (isMobile()) {
    const hasState = STATES.some((s) => panel.classList.contains(s));
    if (!hasState) setSheetState('sheet-peek');
  } else {
    STATES.forEach((s) => panel.classList.remove(s));
    panel.classList.remove('sheet-dragging');
  }
}

export function setupMobileSheet() {
  panel = document.querySelector('.routing-panel');
  if (!panel) return;

  mq = window.matchMedia(MOBILE_MQ);

  const closeBtn = document.getElementById('sheet-close');
  const grabber = document.getElementById('sheet-grabber');

  // The ✕ (only shown in full) collapses back to the peek bar.
  if (closeBtn) closeBtn.addEventListener('click', () => setSheetState('sheet-peek'));

  // ─── Drag-to-snap gesture on the grabber (a tap toggles peek/full) ───
  if (grabber) {
    let dragging = false;
    let startY = 0;
    let startTranslate = 0;
    let currentTranslate = 0;
    let moved = false;
    const vh = () => window.innerHeight;

    // Translate (px) currently implied by the active state class.
    const stateTranslatePx = () =>
      panel.classList.contains('sheet-full') ? 0 : vh() - PEEK_HEIGHT;

    const onPointerDown = (e) => {
      if (!isMobile()) return;
      if (e.target.closest('#sheet-close')) return;
      dragging = true;
      moved = false;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      startTranslate = stateTranslatePx();
      currentTranslate = startTranslate;
      panel.classList.add('sheet-dragging');
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const delta = y - startY;
      if (Math.abs(delta) > 4) moved = true;
      // Clamp between full (0) and peek (vh - PEEK_HEIGHT).
      currentTranslate = Math.min(vh() - PEEK_HEIGHT, Math.max(0, startTranslate + delta));
      panel.style.transform = `translateY(${currentTranslate}px)`;
      if (e.cancelable) e.preventDefault();
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('sheet-dragging');
      // Clear inline transform so the state class drives position again.
      panel.style.transform = '';

      if (!moved) {
        // A tap (no drag) toggles between peek and full.
        togglePeekFull();
        return;
      }

      // Snap to the nearest of the two anchor positions.
      const fullDist = Math.abs(currentTranslate - 0);
      const peekDist = Math.abs(currentTranslate - (vh() - PEEK_HEIGHT));
      setSheetState(fullDist <= peekDist ? 'sheet-full' : 'sheet-peek');
    };

    grabber.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);

    // Mouse support (useful for testing in DevTools without touch emulation).
    grabber.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
  }

  // ─── Pull-to-collapse: en plein écran, tirer le contenu vers le bas alors qu'on est
  //     tout en haut (plus rien à scroller) replie la feuille en bandeau. ───
  {
    let pulling = false;
    let pStartY = 0;
    let pCurrent = 0;
    const vh = () => window.innerHeight;

    const onContentStart = (e) => {
      if (!isMobile() || !panel.classList.contains('sheet-full')) return;
      if (e.target.closest('#sheet-grabber')) return; // la poignée a son propre geste
      pStartY = e.touches[0].clientY;
      pulling = false;
    };

    const onContentMove = (e) => {
      if (!isMobile() || !panel.classList.contains('sheet-full')) return;
      if (e.target.closest('#sheet-grabber')) return;
      const y = e.touches[0].clientY;
      if (!pulling) {
        // Ne démarre que si on est en haut du scroll et qu'on tire vers le bas.
        if (panel.scrollTop <= 0 && y - pStartY > 6) {
          pulling = true;
          pStartY = y; // rebase pour éviter un saut
          panel.classList.add('sheet-dragging');
        } else {
          return;
        }
      }
      pCurrent = Math.min(vh() - PEEK_HEIGHT, Math.max(0, y - pStartY));
      panel.style.transform = `translateY(${pCurrent}px)`;
      if (e.cancelable) e.preventDefault();
    };

    const onContentEnd = () => {
      if (!pulling) return;
      pulling = false;
      panel.classList.remove('sheet-dragging');
      panel.style.transform = '';
      // Replie si on a tiré de plus de ~20% de la hauteur d'écran.
      setSheetState(pCurrent > vh() * 0.2 ? 'sheet-peek' : 'sheet-full');
    };

    panel.addEventListener('touchstart', onContentStart, { passive: true });
    panel.addEventListener('touchmove', onContentMove, { passive: false });
    panel.addEventListener('touchend', onContentEnd);
  }

  // After a route is calculated/cleared, collapse to the peek bar so the map stays visible.
  window.addEventListener('routeDisplayed', () => {
    if (isMobile()) setSheetState('sheet-peek');
  });
  window.addEventListener('routeCleared', () => {
    if (isMobile()) setSheetState('sheet-peek');
  });

  if (mq.addEventListener) {
    mq.addEventListener('change', syncToViewport);
  } else if (mq.addListener) {
    mq.addListener(syncToViewport);
  }

  syncToViewport();
}
