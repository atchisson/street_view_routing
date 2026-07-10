// "Boîtes à livres" (book boxes without photo) overlay
// Data bundled in data/boites-a-livres-sans-photo.geojson — regenerate with:
//   node tools/update-boites-a-livres.mjs
// Source and layer are created lazily on first activation (the GeoJSON is ~1.4 MB).

import { t } from '../i18n/i18n.js';

const SOURCE_ID = 'boites-a-livres';
const LAYER_ID = 'boites-a-livres-layer';

let clickHandlerBound = false;

export function ensureBoitesALivresLayer(map) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: './data/boites-a-livres-sans-photo.geojson',
      attribution: '© <a href="https://www.boites-a-livres.fr" target="_blank">boites-a-livres.fr</a>'
    });
  }

  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 10, 4, 14, 7],
        'circle-color': '#d97706',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 1.5],
        'circle-stroke-color': '#ffffff'
      }
    });
  }

  if (!clickHandlerBound) {
    clickHandlerBound = true;

    map.on('click', LAYER_ID, (e) => {
      const feature = e.features && e.features[0];
      if (!feature) return;
      const { name, address } = feature.properties || {};
      new maplibregl.Popup({ closeButton: false })
        .setLngLat(feature.geometry.coordinates)
        .setHTML(`<div style="font-size: 12px; line-height: 1.4;">
          <strong>📚 ${name || ''}</strong><br>${address || ''}<br>
          <small style="opacity: 0.75;">${t('mapSettings.bookBoxPopupNote')} — <a href="https://www.boites-a-livres.fr" target="_blank" rel="noopener noreferrer">boites-a-livres.fr</a></small>
        </div>`)
        .addTo(map);
    });

    map.on('mouseenter', LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });
  }
}

export function setBoitesALivresVisibility(map, visible) {
  if (visible) {
    ensureBoitesALivresLayer(map);
  }
  if (map.getLayer(LAYER_ID)) {
    map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
  }
}
