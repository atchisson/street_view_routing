# Refonte responsive mobile — feuille glissable (bottom sheet)

**Date** : 2026-06-01
**Statut** : design validé, prêt pour le plan d'implémentation

## Problème

Sur mobile, le panneau de routage (`.routing-panel`) reste une carte flottante figée de 320px en haut à droite, peu utilisable. Les media queries responsives existantes contiennent des sélecteurs cassés : plusieurs règles ouvrent une liste avec `.routing-panel,` suivie d'un commentaire, ce qui « avale » le sélecteur et empêche le panneau de recevoir tout style mobile dédié. Résultat : le bouton censé afficher les filtres/réglages n'est pas réellement fonctionnel sur petit écran.

Exemples de sélecteurs cassés à nettoyer (dans `style.css`) :
- `@media (max-width: 768px)` ~ligne 2657 : `.routing-panel,` puis commentaire puis `.profile-btn { … }`
- ~ligne 2750 : `.routing-panel,` puis commentaire puis `.basemap-thumb`
- ~ligne 2802 (`@media (max-width: 480px)`) : `.routing-panel,` puis `.routing-header`

## Objectif

Sur mobile (`max-width: 768px`), transformer le panneau en **feuille glissable (bottom sheet)** à trois positions, pilotée par un déclencheur dédié, sans dupliquer l'UI ni modifier l'expérience desktop.

## Principe directeur

Réutiliser le **même DOM `.routing-panel`** et son contenu existant. La version mobile est obtenue par :
1. du CSS sous le seuil `max-width: 768px` qui repositionne le panneau en feuille ancrée en bas ;
2. un module JS léger qui gère les positions (snap), le geste de glissement et le déclencheur ;
3. une garde `window.matchMedia('(max-width: 768px)')` pour n'activer la logique feuille que sur mobile.

**Le rendu et le comportement desktop restent strictement inchangés.**

## Comportement

### Déclencheur (état fermé)
- Une **pilule « Itinéraire »** (icône vélo + libellé) en bas à droite de la carte, visible uniquement sur mobile.
- Tap → ouvre la feuille.
- Le bouton « collapse » desktop (`#collapse-routing-panel`) est masqué sur mobile (remplacé par le ✕ de la feuille).

### Les trois positions de la feuille
1. **Fermée** (`closed`) : feuille hors écran vers le bas ; seule la pilule est visible ; carte plein écran.
2. **Demi-écran** (`half`) : feuille à ~50 % de hauteur. Affiche les **résultats** : distance / durée / dénivelé + profil altimétrique compact + actions GPX / Effacer. La carte et l'itinéraire restent visibles au-dessus.
3. **Plein écran** (`full`) : feuille à pleine hauteur. Affiche tous les **réglages** : profils, adresses départ/arrivée, étapes, section Panoramax. Header fixe (titre « Itinéraire » + ✕) ; bouton « Calculer l'itinéraire » fixe en bas.

### Transitions
- Ouverture via la pilule, **sans itinéraire calculé** → position `full` (réglages).
- Appui sur **« Calculer l'itinéraire »** → après obtention du tracé, la feuille passe en `half` pour révéler la carte.
- **Poignée glissée** vers le haut → `full` ; vers le bas → `half` puis `closed`. Tap sur la poignée → bascule `half` ↔ `full`.
- **✕** dans le header → `closed`.
- **« Effacer »** → retour à `closed`.

### Contrôles carte en bas à gauche
`#bottom-left-ui-container` (zoom, dark mode, langue, réglages carte) :
- feuille `closed` → ancrés en bas à gauche (comportement actuel) ;
- feuille `half` → remontent juste au-dessus du bord supérieur de la feuille ;
- feuille `full` → masqués (la feuille occupe l'écran).

## Détails d'implémentation

### CSS (`style.css`)
- Nettoyer les sélecteurs `.routing-panel` cassés dans les blocs `@media (max-width: 768px)` et `@media (max-width: 480px)`.
- Sous `max-width: 768px`, restyler `.routing-panel` :
  - `position: fixed; left: 0; right: 0; bottom: 0; width: 100%; max-width: none;`
  - coins arrondis en haut, ombre vers le haut ;
  - hauteur pilotée par une variable/`transform: translateY()` selon la position ;
  - `transition` sur `transform`/`height` pour l'animation de snap ;
  - poignée (drag handle) visible en haut de la feuille (élément ajouté, masqué en desktop).
- Classes d'état sur `.routing-panel` : `.sheet-closed`, `.sheet-half`, `.sheet-full` (mobile uniquement).
- Header `.routing-content` : sections `réglages` vs bloc `résultats` (`#route-info` + `#heightgraph-container`) réorganisées pour que `half` montre les résultats et `full` montre les réglages. Profil altimétrique en variante compacte sur mobile.
- Pilule déclencheur : nouvel élément, `display: none` en desktop, visible en mobile.
- Repositionnement de `#bottom-left-ui-container` selon la classe d'état de la feuille.

### HTML (`index.html`)
- Ajouter la **pilule « Itinéraire »** (déclencheur mobile) et la **poignée** de la feuille. Les deux n'apparaissent qu'en mobile via CSS.
- Conserver tous les IDs existants pour ne casser aucun gestionnaire JS.

### JS (nouveau module, ex. `js/ui/mobileSheet.js`)
- Détecter le mobile via `matchMedia('(max-width: 768px)')` ; ré-évaluer au `resize`/changement d'orientation.
- Gérer l'état de la feuille (`closed` / `half` / `full`) par classes CSS et exposer des helpers `openSheet(state)`.
- Gérer le geste : `touchstart`/`touchmove`/`touchend` sur la poignée (et le header), avec accroche à la position la plus proche au relâchement. Pas de momentum physique complexe (POC).
- Câbler : pilule → `full` (ou `half` si itinéraire déjà présent) ; ✕ → `closed` ; tap poignée → bascule `half`/`full`.
- Après un calcul d'itinéraire réussi (hook sur le flux existant, ex. via l'événement déjà émis ou le retour de `calculate-route`), basculer en `half`.
- Réutiliser l'événement `routingPanelToggled` existant pour déclencher le recalcul/redraw du `heightgraph` (cf. `js/ui/panelPositioning.js`).
- Initialiser le module depuis `main.js` sans interférer avec la logique desktop.

### Compatibilité desktop
- Toute la logique feuille est conditionnée au mobile. En desktop, `matchMedia` renvoie `false`, aucune classe d'état n'est appliquée, le panneau garde son positionnement actuel et le bouton collapse fonctionne comme avant.

## Hors périmètre

- Refonte visuelle du desktop.
- Nouvelles fonctionnalités de routage.
- Internationalisation de nouveaux libellés au-delà de la clé nécessaire pour la pilule « Itinéraire » (à ajouter dans `en/fr/de.json`).

## Critères de réussite

- Sur mobile (≤ 768px), la pilule « Itinéraire » ouvre une feuille plein écran utilisable ; tous les réglages (profils, adresses, étapes, Panoramax) sont accessibles et tactiles (cibles ≥ 44px, pas de zoom iOS sur les champs).
- Après « Calculer », la feuille passe en demi-écran montrant résultats + profil altimétrique compact, carte et itinéraire visibles.
- Geste de glissement fonctionnel entre les trois positions ; ✕ et « Effacer » ferment la feuille.
- Les contrôles carte bas-gauche restent accessibles selon la position de la feuille.
- Aucune régression sur l'affichage et le comportement desktop.
