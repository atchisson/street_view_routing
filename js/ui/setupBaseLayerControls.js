import { switchMapTheme } from './mapThemeSwitcher.js';

/**
 * Reinitialize all map layers and sources after a style change
 */
async function reinitializeMapLayers(map) {
  const { addBasicSources } = await import('../mapdata/sources.js');
  const { addBasicLayers } = await import('../mapdata/basicLayers.js');
  const { setupPhotonGeocoder } = await import('../utils/geocoder.js');
  const { setupRouting } = await import('../routing/routing.js');

  addBasicSources(map);
  addBasicLayers(map);
  setupPhotonGeocoder(map);
  setupRouting(map);

  // Restore Panoramax layer visibility from checkbox state after style reload
  const { routeState } = await import('../routing/routeState.js');
  const setVis = (id, visible) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  };
  setVis('panoramax-sequences-flat', routeState.avoidPhotoCoverage);
  setVis('panoramax-sequences-360', routeState.avoidPhotoCoverageOnly360);

  // Restore Waymarked Trails overlay visibility from checkbox state after style reload
  setVis('waymarked-hiking-layer', document.getElementById('toggleTrailsHiking')?.checked);
  setVis('waymarked-cycling-layer', document.getElementById('toggleTrailsCycling')?.checked);

  // Restore book boxes overlay after style reload (source/layer are created lazily)
  if (document.getElementById('toggleBookBoxes')?.checked) {
    const { setBoitesALivresVisibility } = await import('../mapdata/boitesALivres.js');
    setBoitesALivresVisibility(map, true);
  }
}

/**
 * Restore route after style change
 */
async function restoreRoute(map) {
  try {
    const { routeState } = await import('../routing/routeState.js');
    if (!routeState || !routeState.currentRouteData || !routeState.startPoint || !routeState.endPoint) {
      return; // No route to restore
    }
    
    const { coordinates, elevations, distance, encodedValues } = routeState.currentRouteData;
    if (!coordinates || coordinates.length === 0) {
      return; // No coordinates to restore
    }
    
    const { updateRouteColor } = await import('../routing/routeVisualization.js');
    const { drawHeightgraph } = await import('../routing/heightgraph.js');
    // Wait for route source and layer to be ready
    const waitForRouteLayer = (maxAttempts = 30, delay = 100) => {
      return new Promise((resolve) => {
        let attempts = 0;
        const checkLayer = () => {
          const source = map.getSource('route');
          const layer = map.getLayer('route-layer');
          if (source && layer) {
            resolve(true);
            return;
          }
          if (attempts >= maxAttempts) {
            console.warn('Route layer not ready after max attempts');
            resolve(false);
            return;
          }
          attempts++;
          setTimeout(checkLayer, delay);
        };
        checkLayer();
      });
    };
    
    const routeReady = await waitForRouteLayer();
    if (!routeReady) {
      // Retry once more after a longer delay
      await new Promise(resolve => setTimeout(resolve, 500));
      const retryReady = await waitForRouteLayer();
      if (!retryReady) {
        console.warn('Could not restore route: route layer not available');
        return;
      }
    }
    
    // Ensure routeState.mapInstance is set
    routeState.mapInstance = map;
    
    // Get route source and layer
    const routeSource = map.getSource('route');
    const routeLayer = map.getLayer('route-layer');
    
    if (!routeSource || !routeLayer) {
      console.warn('Route source or layer not found after waiting');
      return;
    }
    
    // Set basic route data first to ensure it's visible
    routeSource.setData({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      },
      properties: {
        color: '#3b82f6'
      }
    });
    
    // Update layer to support property-based coloring
    map.setPaintProperty('route-layer', 'line-color', ['get', 'color']);
    
    // Restore route visualization with encoded values (if available)
    const select = document.getElementById('heightgraph-encoded-select');
    const selectedType = select ? select.value : routeState.currentEncodedType || 'surface';
    
    // Update route color with current encoded values
    // This will create segments if encodedValues are available
    if (encodedValues && Object.keys(encodedValues).length > 0) {
      updateRouteColor(selectedType, encodedValues);
    }
    
    // Restore heightgraph
    if (elevations && elevations.length > 0) {
      drawHeightgraph(elevations, distance, encodedValues || {}, coordinates);
    } else if (encodedValues && Object.keys(encodedValues).length > 0) {
      drawHeightgraph([], distance, encodedValues, coordinates);
    }
    
  } catch (err) {
    console.warn('Could not restore route after style change:', err);
  }
}

export function setupBaseLayerControls(map, isInitializingRef) {
  document.querySelectorAll('input[name="color-style"]').forEach(rb => {
    rb.addEventListener("change", () => {
      // Permalink update can be added here if needed
    });
  });

  document.querySelectorAll(".basemap-thumb, .basemap-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      console.debug('[UI] basemap button clicked:', btn.dataset.map);
      const selectedMap = btn.dataset.map;
      const isSatellite = selectedMap === "satellite";
      const isOsm = selectedMap === "osm";
      const isTopo = selectedMap === "topo";

      if (!isSatellite && !isOsm && !isTopo) {
        console.warn('[UI] unsupported map style selected:', selectedMap);
        return;
      }

      // Ensure we have the light-dark base style for raster toggling
      const ensureStyle = async () => {
        const isUsingLightDarkStyle = document.body.hasAttribute('data-using-light-dark-style');
        if (!isUsingLightDarkStyle) {
          document.body.setAttribute('data-using-light-dark-style', 'true');
          map.setStyle("./style_light-dark.json");

          return new Promise(resolve => {
            map.once('style.load', async () => {
              await reinitializeMapLayers(map);
              await restoreRoute(map);
              resolve();
            });
          });
        }

        return Promise.resolve();
      };

      ensureStyle().then(() => {
        // set map theme to light by default when selecting raster sources
        switchMapTheme(map, false);

        const setLayerVisibility = (layerId, visible) => {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
          }
        };
        setLayerVisibility('satellite-layer', isSatellite);
        setLayerVisibility('osm-layer', isOsm);
        setLayerVisibility('topo-layer', isTopo);

        document.querySelectorAll('.basemap-thumb, .basemap-btn').forEach(t => t.classList.remove('selected'));
        btn.classList.add('selected');
      }).catch(err => {
        console.error('[UI] failed to switch basemap style', err);
      });
    });
  });
}

