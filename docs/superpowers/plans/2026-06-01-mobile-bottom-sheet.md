# Mobile Bottom-Sheet Responsive Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur mobile (≤ 768px), transformer le panneau de routage en feuille glissable (bottom sheet) à trois positions, déclenchée par une pilule « Itinéraire », sans modifier l'expérience desktop.

**Architecture:** On réutilise le même DOM `.routing-panel`. La version mobile est obtenue par du CSS sous `max-width: 768px` (positionnement en feuille ancrée en bas, classes d'état `sheet-closed`/`sheet-half`/`sheet-full`) plus un module JS léger (`js/ui/mobileSheet.js`) qui gère les états, le geste de glissement et le déclencheur, le tout gardé par `matchMedia('(max-width: 768px)')`. Deux événements custom (`routeDisplayed`, `routeCleared`) émis depuis `routing.js` pilotent les transitions automatiques.

**Tech Stack:** HTML statique, CSS vanilla (`style.css`), JavaScript ES modules (pas de bundler, pas de framework de test), MapLibre GL JS.

> **Note sur les tests :** ce projet n'a ni `package.json` ni runner de test. La vérification se fait **manuellement dans le navigateur** via le mode responsive (DevTools → device toolbar, ex. iPhone SE 375px) servi par `python -m http.server 8000`. Chaque tâche se termine par une étape de vérification observable. **Les commits sont laissés à l'utilisateur** (préférence explicite) : à la fin de chaque tâche, un point de contrôle indique quoi committer si tu le souhaites, sans l'exécuter automatiquement.

---

## File Structure

- **`index.html`** *(modifier)* — ajouter, à l'intérieur de `.routing-panel` en tout début, une poignée de feuille (`#sheet-grabber` + `#sheet-close`) ; ajouter, juste après `.routing-panel`, le déclencheur pilule `#mobile-route-trigger`. Les deux ne s'affichent qu'en mobile via CSS.
- **`style.css`** *(modifier)* — (1) nettoyer les sélecteurs `.routing-panel` cassés ; (2) ajouter un bloc mobile bottom-sheet : positionnement en feuille, états, poignée, pilule, reflow réglages/résultats, repositionnement de `#bottom-left-ui-container`.
- **`js/ui/mobileSheet.js`** *(créer)* — machine à états de la feuille, geste de glissement, câblage déclencheur/fermeture, garde `matchMedia`.
- **`main.js`** *(modifier)* — importer et initialiser `setupMobileSheet`.
- **`js/routing/routing.js`** *(modifier)* — émettre `routeDisplayed` au succès, `routeCleared` dans `clearRoute`, et ajuster le `padding.bottom` de `fitBounds` sur mobile pour que l'itinéraire reste visible au-dessus de la feuille demi-écran.
- **`js/i18n/en.json`, `fr.json`, `de.json`** *(modifier)* — ajouter la clé `routing.openPanel` (libellé de la pilule) et `routing.closePanel` (titre du bouton fermer).

---

## Task 1: Nettoyer les sélecteurs CSS responsives cassés

**Files:**
- Modify: `style.css` (blocs `@media (max-width: 768px)` ~2655 et `@media (max-width: 480px)` ~2801)

Les media queries contiennent des sélecteurs `.routing-panel,` orphelins, immédiatement suivis d'un commentaire, qui « avalent » le sélecteur suivant et produisent des règles erronées.

- [ ] **Step 1: Localiser les trois sélecteurs cassés**

Run: `grep -n "\.routing-panel,$" style.css`
Expected: trois résultats, aux alentours des lignes 2657, 2750 et 2802.

- [ ] **Step 2: Corriger le bloc ~2657**

Dans `@media (max-width: 768px)`, remplacer :

```css
  /* Panels: Full width on mobile, less padding */
  .routing-panel,

  /* Larger touch targets for buttons */
  .profile-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 10px;
  }
```

par (on retire le `.routing-panel,` orphelin ; le panneau sera stylé dans le nouveau bloc de la Task 4) :

```css
  /* Larger touch targets for buttons */
  .profile-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 10px;
  }
```

- [ ] **Step 3: Corriger le bloc ~2750**

Remplacer :

```css
  /* Ensure panels don't overlap with bottom geocoder and controls */
  .routing-panel,

  /* Smaller basemap thumbs on mobile */
  .basemap-thumb {
    width: 50px;
    height: 50px;
  }
```

par :

```css
  /* Smaller basemap thumbs on mobile */
  .basemap-thumb {
    width: 50px;
    height: 50px;
  }
```

- [ ] **Step 4: Corriger le bloc ~2802**

Dans `@media (max-width: 480px)`, remplacer :

```css
@media (max-width: 480px) {
  .routing-panel,

  .routing-header {
    padding: 12px 10px;
  }
```

par :

```css
@media (max-width: 480px) {
  .routing-header {
    padding: 12px 10px;
  }
```

- [ ] **Step 5: Vérifier qu'il ne reste aucun sélecteur orphelin**

Run: `grep -n "\.routing-panel,$" style.css`
Expected: aucun résultat.

- [ ] **Step 6: Point de contrôle**

Servir le site (`python -m http.server 8000`), ouvrir en mode responsive 375px : le rendu ne doit pas être pire qu'avant (le panneau reste la carte flottante en haut à droite — c'est attendu, on le restyle ensuite). Aucune erreur console.
Commit suggéré (si tu le souhaites) : `git commit -am "fix: remove broken .routing-panel selectors in responsive media queries"`.

---

## Task 2: Ajouter les éléments HTML (poignée, bouton fermer, pilule déclencheur)

**Files:**
- Modify: `index.html` (`.routing-panel` ~ligne 36, et juste après sa fermeture ~ligne 340)

- [ ] **Step 1: Ajouter la poignée et le bouton fermer en haut de `.routing-panel`**

Localiser l'ouverture du panneau :

```html
  <!-- Routing Control Panel -->
  <div class="routing-panel">
    <div class="routing-header">
```

Insérer le bloc poignée juste après `<div class="routing-panel">` et **avant** `<div class="routing-header">` :

```html
  <!-- Routing Control Panel -->
  <div class="routing-panel">
    <!-- Mobile bottom-sheet grabber (hidden on desktop via CSS) -->
    <div class="sheet-grabber" id="sheet-grabber">
      <div class="sheet-handle"></div>
      <button class="sheet-close" id="sheet-close" data-i18n-title="routing.closePanel" title="Fermer" aria-label="Fermer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="routing-header">
```

- [ ] **Step 2: Ajouter la pilule déclencheur juste après la fermeture de `.routing-panel`**

Localiser la fin du panneau (la balise fermante `</div>` du `.routing-panel`, juste avant `<!-- Bottom Left UI Container -->` ~ligne 341) :

```html
    </div>
  </div>

  <!-- Bottom Left UI Container -->
  <div id="bottom-left-ui-container">
```

Insérer la pilule entre la fermeture du panneau et le conteneur bas-gauche :

```html
    </div>
  </div>

  <!-- Mobile trigger pill (hidden on desktop via CSS) -->
  <button class="mobile-route-trigger" id="mobile-route-trigger" data-i18n-title="routing.openPanel" title="Itinéraire">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5"></circle>
      <circle cx="18.5" cy="17.5" r="3.5"></circle>
      <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 3"></path>
      <path d="M5.5 17.5 9 3h6l2.5 7H5.5"></path>
    </svg>
    <span data-i18n="routing.openPanel">Itinéraire</span>
  </button>

  <!-- Bottom Left UI Container -->
  <div id="bottom-left-ui-container">
```

- [ ] **Step 3: Point de contrôle**

Recharger en responsive : les nouveaux éléments existent dans le DOM mais sont invisibles (aucun style mobile encore). Aucune régression desktop (largeur > 768px : la poignée et la pilule sont masquées par défaut une fois la Task 4 faite ; pour l'instant elles peuvent apparaître brièvement — c'est attendu jusqu'à la Task 4).
Commit suggéré : `git commit -am "feat: add mobile sheet grabber and trigger pill markup"`.

---

## Task 3: Ajouter les clés i18n

**Files:**
- Modify: `js/i18n/fr.json`, `js/i18n/en.json`, `js/i18n/de.json` (objet `routing`)

- [ ] **Step 1: Ajouter les clés dans `fr.json`**

Dans l'objet `"routing"`, après la clé `"expandPanel": "Développer",`, ajouter :

```json
    "openPanel": "Itinéraire",
    "closePanel": "Fermer",
```

- [ ] **Step 2: Ajouter les clés dans `en.json`**

Dans l'objet `"routing"`, au même endroit logique, ajouter :

```json
    "openPanel": "Route",
    "closePanel": "Close",
```

- [ ] **Step 3: Ajouter les clés dans `de.json`**

Dans l'objet `"routing"`, ajouter :

```json
    "openPanel": "Route",
    "closePanel": "Schließen",
```

- [ ] **Step 4: Vérifier la validité JSON des trois fichiers**

Run: `python -c "import json; [json.load(open(f,encoding='utf-8')) for f in ['js/i18n/fr.json','js/i18n/en.json','js/i18n/de.json']]; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Point de contrôle**

Commit suggéré : `git commit -am "i18n: add openPanel/closePanel keys for mobile sheet"`.

---

## Task 4: CSS du bottom-sheet mobile (positionnement, états, poignée, pilule)

**Files:**
- Modify: `style.css` (ajouter un nouveau bloc à la fin du fichier, avant l'éventuel dernier `@media (prefers-color-scheme: dark)` ou simplement en fin de fichier)

Cette tâche ajoute tout le style mobile. Les classes d'état (`sheet-closed`/`sheet-half`/`sheet-full`) seront appliquées par le JS en Task 5, mais on les style maintenant et on vérifie en les ajoutant manuellement via l'inspecteur.

- [ ] **Step 1: Ajouter le bloc desktop (masquage des éléments mobiles)**

Ajouter en fin de `style.css` (hors media query, donc actif partout — on le neutralise en mobile ensuite) :

```css
/* ───── Mobile bottom-sheet : éléments masqués en desktop ───── */
.sheet-grabber,
.mobile-route-trigger {
  display: none;
}
```

- [ ] **Step 2: Ajouter le bloc mobile principal**

Ajouter ensuite (nouveau `@media`) le cœur du bottom-sheet :

```css
@media (max-width: 768px) {
  /* La feuille : ancrée en bas, pleine largeur, glissable */
  .routing-panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: none;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -4px 18px var(--shadow-md);
    transform: translateY(100%); /* défaut = fermé, avant que le JS applique une classe */
    transition: transform 0.3s ease;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* États pilotés par le JS */
  .routing-panel.sheet-closed { transform: translateY(100%); }
  .routing-panel.sheet-half   { transform: translateY(55%); }
  .routing-panel.sheet-full   { transform: translateY(0); border-radius: 0; }

  /* Pendant un glissement actif : pas d'animation (suivi du doigt) */
  .routing-panel.sheet-dragging { transition: none; }

  /* Poignée + bouton fermer */
  .sheet-grabber {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 10px 0 6px;
    flex-shrink: 0;
    touch-action: none; /* on gère le geste nous-mêmes */
    cursor: grab;
  }
  .sheet-handle {
    width: 40px;
    height: 4px;
    border-radius: 3px;
    background: var(--border-secondary, #cbd5e1);
  }
  .sheet-close {
    position: absolute;
    right: 10px;
    top: 6px;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 9px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  /* Le header desktop est remplacé par la poignée sur mobile */
  .routing-panel .routing-header {
    display: none;
  }

  /* Contenu défilable en plein écran */
  .routing-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* La pilule déclencheur */
  .mobile-route-trigger {
    display: flex;
    align-items: center;
    gap: 7px;
    position: fixed;
    right: 12px;
    bottom: 14px;
    z-index: 3;
    background: var(--accent, #6d28d9);
    color: #fff;
    font-family: sans-serif;
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: 22px;
    padding: 11px 16px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
    cursor: pointer;
  }
  .mobile-route-trigger svg { stroke: #fff; }

  /* Masquer la pilule quand la feuille est ouverte */
  .routing-panel.sheet-half ~ .mobile-route-trigger,
  .routing-panel.sheet-full ~ .mobile-route-trigger {
    display: none;
  }

  /* Contrôles carte bas-gauche : suivent l'état de la feuille */
  .routing-panel.sheet-half ~ #bottom-left-ui-container {
    bottom: calc(45% + 12px);
    transition: bottom 0.3s ease;
  }
  .routing-panel.sheet-full ~ #bottom-left-ui-container {
    display: none;
  }
}
```

> Remarque : `--accent` n'existe peut-être pas comme variable. Si `getComputedStyle` montre une couleur vide, remplacer `var(--accent, #6d28d9)` par `#6d28d9` en dur (le violet utilisé dans les maquettes). Vérifier à l'étape suivante.

- [ ] **Step 3: Ajouter le reflow réglages/résultats pour l'état demi-écran**

Ajouter dans le **même** `@media (max-width: 768px)` :

```css
  /* État demi-écran : on ne montre que les résultats */
  .routing-panel.sheet-half .profile-selector,
  .routing-panel.sheet-half .routing-input-group,
  .routing-panel.sheet-half .waypoints-container,
  .routing-panel.sheet-half .provider-accordion,
  .routing-panel.sheet-half .github-links,
  .routing-panel.sheet-half #calculate-route {
    display: none;
  }

  /* Ordonner les résultats en premier dans le demi-écran */
  .routing-panel.sheet-half #route-info { order: 1; }
  .routing-panel.sheet-half #heightgraph-container { order: 2; }
  .routing-panel.sheet-half .routing-buttons { order: 3; }

  /* Profil altimétrique compact sur mobile */
  .routing-panel.sheet-half #heightgraph-container canvas {
    max-height: 120px;
  }
```

- [ ] **Step 4: Vérifier visuellement chaque état via l'inspecteur**

Servir le site, mode responsive 375px. Dans l'inspecteur, ajouter manuellement la classe sur `.routing-panel` et observer :
- `sheet-full` → la feuille couvre l'écran, poignée + ✕ en haut, contenu défilable, bouton « Calculer » visible en bas. La pilule et les contrôles bas-gauche disparaissent.
- `sheet-half` → la feuille occupe ~45% bas de l'écran ; carte visible au-dessus ; les réglages (profils, adresses, Panoramax) sont masqués ; `#route-info` visible (vide tant qu'aucun itinéraire). Contrôles bas-gauche remontés.
- `sheet-closed` → feuille hors écran ; pilule « Itinéraire » visible en bas à droite.

Expected: les trois états se comportent comme décrit. Vérifier aussi que la couleur d'accent de la pilule s'affiche (sinon appliquer la remarque du Step 2).

- [ ] **Step 5: Vérifier l'absence de régression desktop**

Repasser en largeur > 768px : panneau identique à avant (carte 320px haut-droite), poignée/pilule invisibles, contrôles bas-gauche en place.

- [ ] **Step 6: Point de contrôle**

Commit suggéré : `git commit -am "feat: mobile bottom-sheet styling (states, handle, trigger, results reflow)"`.

---

## Task 5: Module JS de la feuille (états, déclencheur, fermeture, tap poignée)

**Files:**
- Create: `js/ui/mobileSheet.js`
- Modify: `main.js` (import + init)

- [ ] **Step 1: Créer `js/ui/mobileSheet.js` (sans le geste de glissement pour l'instant)**

```javascript
// Mobile bottom-sheet controller.
// Reuses the existing .routing-panel DOM and toggles state classes on mobile only.
// Desktop (width > 768px) is untouched: no state class is applied.

const MOBILE_MQ = '(max-width: 768px)';
const STATES = ['sheet-closed', 'sheet-half', 'sheet-full'];

let panel = null;
let mq = null;

// Tracks whether a route is currently displayed (set via custom events).
window.__hasRoute = window.__hasRoute || false;

function isMobile() {
  return mq ? mq.matches : window.matchMedia(MOBILE_MQ).matches;
}

export function setSheetState(state) {
  if (!panel) return;
  STATES.forEach((s) => panel.classList.remove(s));
  panel.classList.add(state);
  window.dispatchEvent(new CustomEvent('routingPanelToggled'));
}

function openSheet() {
  setSheetState(window.__hasRoute ? 'sheet-half' : 'sheet-full');
}

function closeSheet() {
  setSheetState('sheet-closed');
}

function toggleHalfFull() {
  if (!panel) return;
  if (panel.classList.contains('sheet-full')) {
    setSheetState('sheet-half');
  } else {
    setSheetState('sheet-full');
  }
}

// Apply or clear mobile state depending on viewport.
function syncToViewport() {
  if (!panel) return;
  if (isMobile()) {
    // If no state yet, start closed.
    const hasState = STATES.some((s) => panel.classList.contains(s));
    if (!hasState) setSheetState('sheet-closed');
  } else {
    // Desktop: remove all sheet classes so desktop CSS applies cleanly.
    STATES.forEach((s) => panel.classList.remove(s));
    panel.classList.remove('sheet-dragging');
  }
}

export function setupMobileSheet() {
  panel = document.querySelector('.routing-panel');
  if (!panel) return;

  mq = window.matchMedia(MOBILE_MQ);

  const trigger = document.getElementById('mobile-route-trigger');
  const closeBtn = document.getElementById('sheet-close');
  const grabber = document.getElementById('sheet-grabber');

  if (trigger) trigger.addEventListener('click', openSheet);
  if (closeBtn) closeBtn.addEventListener('click', closeSheet);
  // Tap on the grabber (without dragging) toggles half/full.
  if (grabber) grabber.addEventListener('click', (e) => {
    // Ignore clicks that originated on the close button.
    if (e.target.closest('#sheet-close')) return;
    toggleHalfFull();
  });

  // Route lifecycle → automatic transitions (mobile only).
  window.addEventListener('routeDisplayed', () => {
    window.__hasRoute = true;
    if (isMobile()) setSheetState('sheet-half');
  });
  window.addEventListener('routeCleared', () => {
    window.__hasRoute = false;
    if (isMobile()) setSheetState('sheet-closed');
  });

  // React to viewport changes (rotation, resize, devtools).
  if (mq.addEventListener) {
    mq.addEventListener('change', syncToViewport);
  } else if (mq.addListener) {
    mq.addListener(syncToViewport); // Safari < 14 fallback
  }

  syncToViewport();
}
```

- [ ] **Step 2: Brancher l'init dans `main.js`**

Localiser l'import des modules UI (~ligne 9) :

```javascript
import { setupPanelPositioning } from './js/ui/panelPositioning.js';
```

Ajouter en dessous :

```javascript
import { setupMobileSheet } from './js/ui/mobileSheet.js';
```

Puis localiser le bloc d'init UI en bas de fichier (~ligne 176) :

```javascript
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupToggleHandlers();
    setupPanelPositioning();
  });
} else {
  setupToggleHandlers();
  setupPanelPositioning();
}
```

Le remplacer par :

```javascript
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupToggleHandlers();
    setupPanelPositioning();
    setupMobileSheet();
  });
} else {
  setupToggleHandlers();
  setupPanelPositioning();
  setupMobileSheet();
}
```

- [ ] **Step 3: Vérifier le cycle en navigateur (mobile)**

Servir le site, mode responsive 375px, recharger :
- Au chargement : feuille fermée, pilule « Itinéraire » visible.
- Tap pilule → feuille en plein écran (réglages), pilule cachée.
- Tap poignée → bascule plein écran ↔ demi-écran.
- Tap ✕ → feuille fermée, pilule revient.

Expected: comportement conforme, aucune erreur console.

- [ ] **Step 4: Vérifier l'absence d'effet en desktop**

Largeur > 768px, recharger : aucune classe `sheet-*` sur `.routing-panel` (vérifier dans l'inspecteur), comportement collapse desktop inchangé. Passer de desktop à mobile en redimensionnant : la feuille s'initialise en `sheet-closed`.

- [ ] **Step 5: Point de contrôle**

Commit suggéré : `git commit -am "feat: mobile sheet state controller (trigger, close, tap-to-toggle)"`.

---

## Task 6: Émettre les événements de cycle de vie de l'itinéraire + padding mobile

**Files:**
- Modify: `js/routing/routing.js` (succès ~ligne 1045 ; mobile padding ~ligne 1013 ; `clearRoute` ~ligne 1067+)

- [ ] **Step 1: Émettre `routeDisplayed` après `fitBounds`**

Localiser, dans le bloc de succès :

```javascript
      map.fitBounds(bounds, { padding });
    } else {
      throw new Error(ERROR_MESSAGES.NO_ROUTE_FOUND);
    }
```

Le remplacer par :

```javascript
      map.fitBounds(bounds, { padding });

      // Notify the mobile bottom-sheet that a route is now displayed.
      window.dispatchEvent(new CustomEvent('routeDisplayed'));
    } else {
      throw new Error(ERROR_MESSAGES.NO_ROUTE_FOUND);
    }
```

- [ ] **Step 2: Ajuster le `padding.bottom` mobile pour la feuille demi-écran**

Localiser le calcul du padding mobile :

```javascript
      if (isMobile) {
        // On mobile: minimal padding, panels are usually collapsed or smaller
        padding = {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20
        };
      } else {
```

Le remplacer par (réserve ~45% bas pour la feuille demi-écran, afin que l'itinéraire reste visible au-dessus) :

```javascript
      if (isMobile) {
        // On mobile the route is shown above the half-open bottom sheet (~45% of height).
        padding = {
          top: 30,
          right: 30,
          bottom: Math.round(window.innerHeight * 0.45) + 30,
          left: 30
        };
      } else {
```

- [ ] **Step 3: Émettre `routeCleared` dans `clearRoute`**

Localiser le début de `clearRoute` :

```javascript
export function clearRoute(map) {
  // Cleanup heightgraph event handlers
  cleanupHeightgraphHandlers();
```

Le remplacer par :

```javascript
export function clearRoute(map) {
  // Notify the mobile bottom-sheet that the route is gone.
  window.dispatchEvent(new CustomEvent('routeCleared'));

  // Cleanup heightgraph event handlers
  cleanupHeightgraphHandlers();
```

- [ ] **Step 4: Vérifier le flux complet en navigateur (mobile)**

Mode responsive 375px :
1. Ouvrir la feuille (pilule) → plein écran.
2. Définir départ + arrivée (via les champs ou clic carte), tap « Calculer l'itinéraire ».
3. Attendu : l'itinéraire s'affiche sur la carte **au-dessus** de la feuille, et la feuille passe automatiquement en **demi-écran** montrant distance / durée / dénivelé + profil altimétrique compact + boutons GPX/Effacer.
4. Glisser la poignée vers le haut → réglages (plein écran) ; vers le bas → demi-écran.
5. Tap « Effacer » → feuille fermée, pilule revient, itinéraire effacé.

Expected: flux conforme, l'itinéraire n'est jamais caché derrière la feuille, aucune erreur console.

- [ ] **Step 5: Vérifier desktop**

Largeur > 768px : calculer un itinéraire ; le padding desktop (panneau 320px) est inchangé, aucun changement de comportement. Les événements `routeDisplayed`/`routeCleared` sont émis mais sans effet (la garde `isMobile()` du module les ignore).

- [ ] **Step 6: Point de contrôle**

Commit suggéré : `git commit -am "feat: emit route lifecycle events and reserve mobile fitBounds padding"`.

---

## Task 7: Geste de glissement (drag-to-snap) sur la poignée

**Files:**
- Modify: `js/ui/mobileSheet.js`

On ajoute le suivi tactile : pendant le glissement on suit le doigt via `transform`, au relâchement on accroche à l'état le plus proche (en tenant compte d'un seuil de vélocité).

- [ ] **Step 1: Ajouter la logique de glissement dans `mobileSheet.js`**

À l'intérieur de `setupMobileSheet`, après le câblage du `grabber` (le `addEventListener('click', …)` existant), ajouter :

```javascript
  // ─── Drag-to-snap gesture on the grabber ───
  if (grabber) {
    let dragging = false;
    let startY = 0;
    let startTranslate = 0;
    let currentTranslate = 0;
    let moved = false;
    const vh = () => window.innerHeight;

    // Translate (px) currently implied by the active state class.
    const stateTranslatePx = () => {
      if (panel.classList.contains('sheet-full')) return 0;
      if (panel.classList.contains('sheet-half')) return vh() * 0.55;
      return vh(); // closed
    };

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
      // Clamp between full (0) and closed (vh).
      currentTranslate = Math.min(vh(), Math.max(0, startTranslate + delta));
      panel.style.transform = `translateY(${currentTranslate}px)`;
      if (e.cancelable) e.preventDefault();
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('sheet-dragging');
      // Clear inline transform so the state class drives position again.
      panel.style.transform = '';

      if (!moved) return; // a tap → handled by the click listener

      // Snap to nearest of the three anchor positions.
      const anchors = [
        { state: 'sheet-full', px: 0 },
        { state: 'sheet-half', px: vh() * 0.55 },
        { state: 'sheet-closed', px: vh() },
      ];
      let nearest = anchors[0];
      let best = Infinity;
      for (const a of anchors) {
        const d = Math.abs(currentTranslate - a.px);
        if (d < best) { best = d; nearest = a; }
      }
      setSheetState(nearest.state);
      if (nearest.state === 'sheet-closed') window.__hasRoute = window.__hasRoute; // keep flag; trigger reopens correctly
    };

    grabber.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);

    // Mouse support (useful for testing in DevTools without touch emulation).
    grabber.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
  }
```

> Note : le listener `click` du grabber (tap → `toggleHalfFull`) et ce geste coexistent. Un vrai glissement met `moved = true` et `onPointerUp` gère le snap ; un simple tap garde `moved = false` et laisse le `click` agir. Sur souris, `mouseup` après un drag déclenche aussi `click` ; le garde `moved` empêche le double-traitement côté drag, et `toggleHalfFull` sur un micro-mouvement reste acceptable. Si un double-déclenchement gênant apparaît en test, ajouter dans `onPointerUp`, après un vrai drag : `if (moved) { const swallow = (ev) => { ev.stopPropagation(); grabber.removeEventListener('click', swallow, true); }; grabber.addEventListener('click', swallow, true); }`.

- [ ] **Step 2: Vérifier le glissement en navigateur (mobile, émulation tactile)**

Mode responsive 375px, émulation tactile activée :
- Calculer un itinéraire (feuille en demi-écran).
- Glisser la poignée lentement vers le haut puis relâcher à mi-course → accroche à plein écran.
- Glisser vers le bas → accroche à demi-écran, puis un nouveau glissement bas → fermé.
- Pendant le glissement, la feuille suit le doigt sans animation saccadée ; au relâchement elle s'anime vers l'état accroché.

Expected: glissement fluide, accroche aux 3 positions, tap simple toujours fonctionnel (bascule half/full).

- [ ] **Step 3: Vérifier qu'aucun glissement ne s'active en desktop**

Largeur > 768px : `mousedown` sur la zone n'a aucun effet (la garde `isMobile()` retourne false).

- [ ] **Step 4: Point de contrôle**

Commit suggéré : `git commit -am "feat: drag-to-snap gesture for mobile bottom-sheet"`.

---

## Task 8: Vérification finale & polish

**Files:**
- Aucune création ; ajustements éventuels dans `style.css` / `js/ui/mobileSheet.js` selon observations.

- [ ] **Step 1: Parcours complet sur petit écran (375px)**

Vérifier de bout en bout :
- Sélection profil (vélo/voiture/marche) : cibles tactiles confortables.
- Saisie d'adresse + résultats geocoder lisibles dans la feuille plein écran.
- Ajout d'une étape (waypoint) et réordonnancement.
- Section Panoramax : pilules, sélecteurs de date, curseur de pondération tous utilisables.
- Calcul → demi-écran → résultats + profil altimétrique compact lisibles.
- GPX / Effacer accessibles en demi-écran.
- Bascule de langue et dark mode (contrôles bas-gauche) accessibles quand la feuille est fermée ou demi-ouverte.

- [ ] **Step 2: Vérifier 480px et un grand mobile (414px) et une petite tablette (768px)**

Le breakpoint 768px : à 768px exactement la feuille s'applique ; à 769px le desktop reprend. Vérifier qu'aucun état intermédiaire ne casse la mise en page.

- [ ] **Step 3: Vérifier le dark mode mobile**

Activer le dark mode : poignée, feuille, pilule et bouton fermer utilisent les variables de thème (`--bg-primary`, `--text-*`, `--border-*`) et restent lisibles. Ajuster les valeurs en dur résiduelles si nécessaire.

- [ ] **Step 4: Vérifier le profil altimétrique**

Le `heightgraph` (canvas) se redessine correctement quand la feuille passe en demi-écran (l'événement `routingPanelToggled` est déjà écouté par `panelPositioning.js`, qui déclenche le redraw). Confirmer qu'il n'est ni coupé ni déformé.

- [ ] **Step 5: Vérifier la non-régression desktop complète**

Largeur > 768px : tout le comportement d'origine (collapse, quick actions, calcul, padding) est strictement inchangé.

- [ ] **Step 6: Point de contrôle final**

Commit suggéré : `git commit -am "polish: mobile bottom-sheet final adjustments"`.

---

## Self-Review (couverture du spec)

- **Sélecteurs CSS cassés** → Task 1. ✓
- **Pilule déclencheur (option B)** → Task 2 (HTML) + Task 4 (CSS) + Task 5 (clic). ✓
- **3 positions (closed/half/full)** → Task 4 (CSS états) + Task 5 (machine à états). ✓
- **Transitions (ouverture full/half, calcul→half, ✕→closed, effacer→closed)** → Task 5 + Task 6. ✓
- **Geste de glissement avec snap** → Task 7. ✓
- **Reflow réglages vs résultats + profil altimétrique compact** → Task 4 Step 3. ✓
- **Repositionnement des contrôles bas-gauche selon l'état** → Task 4 Step 2 (sélecteurs `~`). ✓
- **Padding fitBounds mobile (itinéraire au-dessus de la feuille)** → Task 6 Step 2. ✓
- **i18n pilule/fermer** → Task 3. ✓
- **Non-régression desktop (garde matchMedia)** → vérifiée à chaque tâche (Steps « desktop »). ✓
- **Critères de réussite du spec** → couverts par les vérifications Task 8. ✓
