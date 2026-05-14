// Routing UI handlers: buttons, inputs, markers, geocoding

import { routeState } from './routeState.js';
import { exportRouteToGPX } from './gpxExport.js';
import {
  ensureCustomModel,
  updatePhotoCoverageRule,
  updatePhotoCoverageOnly360Rule,
} from './customModel.js';
import { setupRoutingInputGeocoder, reverseGeocode } from '../utils/geocoder.js';
import { ERROR_MESSAGES } from '../utils/constants.js';
import { t } from '../i18n/i18n.js';
import { recalculateRouteIfReady } from './routeRecalculator.js';
import { isRouteCalculationInProgress } from './routing.js';
import { trackEvent } from '../analytics.js';
import { createStartMarker, createEndMarker, createWaypointMarker } from './markers/markerFactory.js';
import { updateWaypointsList } from './waypoints/waypointList.js';
import { updateCoordinateTooltips } from './coordinates/coordinateTooltips.js';
import { addWaypoint } from './waypoints/waypointManager.js';

// Available SVG files for waypoints
const WAYPOINT_SVGS = [
  'raspberry-svgrepo-com.svg',
  'pineapple-svgrepo-com.svg',
  'banana-svgrepo-com.svg',
  'fries-svgrepo-com.svg',
  'broccoli-svgrepo-com.svg',
  'doughnut-svgrepo-com.svg',
  'grapes-svgrepo-com.svg',
  'pretzel-svgrepo-com.svg',
  'apple-svgrepo-com.svg',
  'cabbage-svgrepo-com.svg',
  'toffee-svgrepo-com.svg',
  'cheese-svgrepo-com.svg',
  'aubergine-svgrepo-com.svg',
  'carrot-svgrepo-com.svg'
];

/**
 * Get a random SVG ID for a waypoint that hasn't been used yet
 * Only allows duplicates if all 14 SVGs are already in use
 * @returns {string} SVG filename
 */
export function getRandomWaypointSvg() {
  // Get all currently used SVG IDs from waypoints
  const usedSvgIds = new Set(
    routeState.waypoints
      .map(wp => wp && typeof wp === 'object' && wp.svgId ? wp.svgId : null)
      .filter(id => id !== null)
  );
  
  // Get available SVGs (not yet used)
  const availableSvgs = WAYPOINT_SVGS.filter(svg => !usedSvgIds.has(svg));
  
  // If there are available SVGs, use one of them
  if (availableSvgs.length > 0) {
    return availableSvgs[Math.floor(Math.random() * availableSvgs.length)];
  }
  
  // All SVGs are in use, allow duplicates
  return WAYPOINT_SVGS[Math.floor(Math.random() * WAYPOINT_SVGS.length)];
}
// Smooth exponential mapping: s=0 → weak (0.5 / 0.25), s=100 → strong (0.01 / 0.005)
function getPhotoCoverageMultipliers() {
  const t = Math.max(0, Math.min(100, routeState.photoCoverageStrength || 50)) / 100;
  return {
    photo:    0.5  * Math.pow(0.02, t),  // 0.5 at t=0, ~0.07 at t=0.5, 0.01 at t=1
    photo360: 0.5  * Math.pow(0.02, t)    // 0.5 at t=0, ~0.07 at t=0.5, 0.01 at t=1
  };
}

function updateOptSliderBg(el) {
  const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.background = `linear-gradient(to right, #3b82f6 ${pct}%, var(--border-secondary, #d1d5db) ${pct}%)`;
}

export function applyPhotoCoverageSettings() {
  if (!routeState.customModel) return;
  const { photo, photo360 } = getPhotoCoverageMultipliers();
  const dateMin = routeState.photoDateMin;
  const dateMax = routeState.photoDateMax;

  routeState.customModel = updatePhotoCoverageRule(
    routeState.customModel,
    routeState.avoidPhotoCoverage,
    photo,
    dateMin,
    dateMax
  );

  routeState.customModel = updatePhotoCoverageOnly360Rule(
    routeState.customModel,
    routeState.avoidPhotoCoverageOnly360,
    photo360,
    dateMin,
    dateMax
  );
}

function applyPanoramaxDateFilter() {
  const map = window.map;
  if (!map) return;
  const minDate = routeState.photoDateMin;
  // Always cap to data freshness ceiling so the layer never shows photos beyond what the router knows
  let maxDate = routeState.photoDateMax;
  if (routeState.panoramaxDataDate) {
    maxDate = (maxDate && maxDate < routeState.panoramaxDataDate) ? maxDate : routeState.panoramaxDataDate;
  }

  const baseFilters = {
    'panoramax-sequences-flat': ['==', ['get', 'type'], 'flat'],
    'panoramax-sequences-360': ['==', ['get', 'type'], 'equirectangular'],
  };

  Object.entries(baseFilters).forEach(([layerId, baseFilter]) => {
    if (!map.getLayer(layerId)) return;
    if (!minDate && !maxDate) {
      map.setFilter(layerId, baseFilter);
    } else {
      map.setFilter(layerId, ['all', baseFilter,
        ...( minDate ? [['>=', ['get', 'date'], minDate]] : [] ),
        ...( maxDate ? [['<=', ['get', 'date'], maxDate]] : [] ),
      ]);
    }
  });
}

function showDataDateToast(dataDate) {
  if (sessionStorage.getItem('panoramaxDateCeilingWarned')) return;
  sessionStorage.setItem('panoramaxDateCeilingWarned', '1');
  const msg = t('photoCoverage.dateCeiling').replace('{date}', dataDate);
  const toast = document.createElement('div');
  toast.className = 'pano-date-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 6000);
}

export function updateStrengthRowVisibility() {
  const anyChecked = routeState.avoidPhotoCoverage || routeState.avoidPhotoCoverageOnly360;

  const options = document.getElementById('pano-options');
  if (options) options.classList.toggle('show', anyChecked);

  const accordion = document.getElementById('pano-accordion');
  if (accordion) {
    accordion.classList.toggle('active', anyChecked);
    if (anyChecked) accordion.classList.add('open');
  }

  const pillAll = document.getElementById('ppill-all');
  if (pillAll) pillAll.classList.toggle('active', !!routeState.avoidPhotoCoverage);
  const pill360 = document.getElementById('ppill-360');
  if (pill360) pill360.classList.toggle('active', !!routeState.avoidPhotoCoverageOnly360);
}

// Show/hide Panoramax map layers to match checkbox state.
// avoid-photo-coverage   → flat + 360 sequences (avoids all coverage)
// avoid-photo-coverage-360 → 360 sequences only
export function syncPanoramaxLayers() {
  const map = window.map;
  if (!map) return;
  const setVis = (id, visible) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  };
  setVis('panoramax-sequences-flat', routeState.avoidPhotoCoverage);
  setVis('panoramax-sequences-360', routeState.avoidPhotoCoverage || routeState.avoidPhotoCoverageOnly360);
  applyPanoramaxDateFilter();
}
export function setupUIHandlers(map) {
  const startBtn = document.getElementById('set-start');
  const endBtn = document.getElementById('set-end');
  const clearBtn = document.getElementById('clear-route');
  const calculateBtn = document.getElementById('calculate-route');
  const startInput = document.getElementById('start-input');
  const endInput = document.getElementById('end-input');
  const collapseBtn = document.getElementById('collapse-routing-panel');
  
  
  // Collapse/expand panel handler
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      const panel = document.querySelector('.routing-panel');
      if (panel) {
        const isCollapsed = panel.classList.contains('collapsed');
        if (isCollapsed) {
          // Expand panel
          panel.classList.remove('collapsed');
          collapseBtn.classList.remove('collapsed');
          collapseBtn.title = t('routing.collapsePanel');
        } else {
          // Collapse panel
          panel.classList.add('collapsed');
          collapseBtn.classList.add('collapsed');
          collapseBtn.title = t('routing.expandPanel');
        }
        
        // Trigger panel positioning update
        window.dispatchEvent(new CustomEvent('routingPanelToggled'));
      }
    });
  }

  // Helper function to handle start/end button clicks
  const handleStartClick = () => {
    routeState.isSelectingStart = true;
    routeState.isSelectingEnd = false;
    map.getCanvas().style.cursor = 'crosshair';
    // Update both original and header buttons
    document.querySelectorAll('.btn-set-start, .btn-set-start-header').forEach(btn => {
      btn.classList.add('active');
    });
    document.querySelectorAll('.btn-set-end, .btn-set-end-header').forEach(btn => {
      btn.classList.remove('active');
    });
  };

  const handleEndClick = () => {
    routeState.isSelectingEnd = true;
    routeState.isSelectingStart = false;
    map.getCanvas().style.cursor = 'crosshair';
    // Update both original and header buttons
    document.querySelectorAll('.btn-set-end, .btn-set-end-header').forEach(btn => {
      btn.classList.add('active');
    });
    document.querySelectorAll('.btn-set-start, .btn-set-start-header').forEach(btn => {
      btn.classList.remove('active');
    });
  };

  if (startBtn) {
    startBtn.addEventListener('click', handleStartClick);
  }

  // Header start button
  const startBtnHeader = document.getElementById('set-start-header');
  if (startBtnHeader) {
    startBtnHeader.addEventListener('click', handleStartClick);
  }

  if (endBtn) {
    endBtn.addEventListener('click', handleEndClick);
  }

  // Header end button
  const endBtnHeader = document.getElementById('set-end-header');
  if (endBtnHeader) {
    endBtnHeader.addEventListener('click', handleEndClick);
  }

  // Hide route button
  const hideBtn = document.getElementById('hide-route');
  if (hideBtn) {
    let isHidden = false;
    // Store hidden state globally so routeVisualization can access it
    window.routeIsHidden = false;
    
    hideBtn.addEventListener('click', () => {
      isHidden = !isHidden;
      window.routeIsHidden = isHidden;
      
      // Toggle route layer opacity (0.1 when hidden, 0.8 when visible)
      if (map.getLayer('route-layer')) {
        const newOpacity = isHidden ? 0.1 : 0.8;
        map.setPaintProperty('route-layer', 'line-opacity', newOpacity);
        
        // Hide/show hover segment layer when route is hidden
        if (map.getLayer('route-hover-segment-layer')) {
          map.setLayoutProperty('route-hover-segment-layer', 'visibility', isHidden ? 'none' : 'visible');
        }
      }
      
      // Update button icon and title
      const svg = hideBtn.querySelector('svg');
      if (svg) {
        if (isHidden) {
          // Show eye-off icon (hidden)
          svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
          hideBtn.title = t('routing.show');
        } else {
          // Show eye icon (visible)
          svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
          hideBtn.title = t('routing.hide');
        }
      }
    });
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      // Clear waypoints list immediately
      const waypointsList = document.getElementById('waypoints-list');
      if (waypointsList) {
        waypointsList.innerHTML = '';
      }
      
      // Import dynamically to avoid circular dependency
      import('./routing.js').then(({ clearRoute }) => {
        clearRoute(map);
        // Reset hide button state
        const hideBtn = document.getElementById('hide-route');
        if (hideBtn) {
          window.routeIsHidden = false;
          const svg = hideBtn.querySelector('svg');
          if (svg) {
            // Reset to eye icon (visible)
            svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
            hideBtn.title = t('routing.hide');
          }
        }
      });
    });
  }

  if (calculateBtn) {
    calculateBtn.addEventListener('click', () => {
      if (routeState.startPoint && routeState.endPoint) {
        recalculateRouteIfReady();
      } else {
        alert(ERROR_MESSAGES.MISSING_START_END);
      }
    });
  }

  // GPX Export button
  const exportGpxBtn = document.getElementById('export-gpx');
  if (exportGpxBtn) {
    exportGpxBtn.addEventListener('click', () => {
      trackEvent('Route', 'ExportGPX');
      exportRouteToGPX();
    });
  }
  
  // Photo coverage switch handler (Panoramax fork)
  const avoidPhotoCoverageSwitch = document.getElementById('avoid-photo-coverage');
  if (avoidPhotoCoverageSwitch) {
    avoidPhotoCoverageSwitch.addEventListener('change', (e) => {
      routeState.avoidPhotoCoverage = e.target.checked;
      if (!routeState.customModel) {
        routeState.customModel = ensureCustomModel(null, routeState.selectedProfile);
      }
      applyPhotoCoverageSettings();
      updateStrengthRowVisibility();
      syncPanoramaxLayers();
      recalculateRouteIfReady();
    });
  }

  const avoidPhotoCoverage360Switch = document.getElementById('avoid-photo-coverage-360');
  if (avoidPhotoCoverage360Switch) {
    avoidPhotoCoverage360Switch.addEventListener('change', (e) => {
      routeState.avoidPhotoCoverageOnly360 = e.target.checked;
      if (!routeState.customModel) {
        routeState.customModel = ensureCustomModel(null, routeState.selectedProfile);
      }
      applyPhotoCoverageSettings();
      updateStrengthRowVisibility();
      syncPanoramaxLayers();
      recalculateRouteIfReady();
    });
  }

  const strengthSlider = document.getElementById('photo-coverage-strength');
  if (strengthSlider) {
    strengthSlider.value = routeState.photoCoverageStrength ?? 50;
    updateOptSliderBg(strengthSlider);
    strengthSlider.addEventListener('input', (e) => {
      routeState.photoCoverageStrength = parseFloat(e.target.value);
      updateOptSliderBg(e.target);
      if (routeState.customModel) {
        applyPhotoCoverageSettings();
        recalculateRouteIfReady();
      }
    });
  }

  // Accordion header toggle
  const panoHeader = document.getElementById('pano-accordion-header');
  if (panoHeader) {
    panoHeader.addEventListener('click', () => {
      document.getElementById('pano-accordion').classList.toggle('open');
    });
  }

  // Pills – radio-like: selecting one deselects the other; clicking active pill deselects it
  const ppillAll = document.getElementById('ppill-all');
  if (ppillAll) {
    ppillAll.addEventListener('click', () => {
      const wasActive = routeState.avoidPhotoCoverage;
      routeState.avoidPhotoCoverage = !wasActive;
      routeState.avoidPhotoCoverageOnly360 = false;
      trackEvent('Panoramax', wasActive ? 'Disable' : 'Enable', 'all');
      document.getElementById('avoid-photo-coverage').checked = routeState.avoidPhotoCoverage;
      document.getElementById('avoid-photo-coverage-360').checked = false;
      if (!routeState.customModel) routeState.customModel = ensureCustomModel(null, routeState.selectedProfile);
      applyPhotoCoverageSettings();
      updateStrengthRowVisibility();
      syncPanoramaxLayers();
      recalculateRouteIfReady();
    });
  }

  const ppill360 = document.getElementById('ppill-360');
  if (ppill360) {
    ppill360.addEventListener('click', () => {
      const wasActive = routeState.avoidPhotoCoverageOnly360;
      routeState.avoidPhotoCoverageOnly360 = !wasActive;
      routeState.avoidPhotoCoverage = false;
      trackEvent('Panoramax', wasActive ? 'Disable' : 'Enable', '360');
      document.getElementById('avoid-photo-coverage-360').checked = routeState.avoidPhotoCoverageOnly360;
      document.getElementById('avoid-photo-coverage').checked = false;
      if (!routeState.customModel) routeState.customModel = ensureCustomModel(null, routeState.selectedProfile);
      applyPhotoCoverageSettings();
      updateStrengthRowVisibility();
      syncPanoramaxLayers();
      recalculateRouteIfReady();
    });
  }

  const photoDateMinInput = document.getElementById('photo-date-min');
  const photoDateMaxInput = document.getElementById('photo-date-max');

  if (photoDateMinInput) {
    photoDateMinInput.addEventListener('change', (e) => {
      routeState.photoDateMin = e.target.value || null;
      applyPanoramaxDateFilter();
      if (routeState.customModel && (routeState.avoidPhotoCoverage || routeState.avoidPhotoCoverageOnly360)) {
        applyPhotoCoverageSettings();
        recalculateRouteIfReady();
      }
    });
  }

  if (photoDateMaxInput) {
    photoDateMaxInput.addEventListener('change', (e) => {
      const value = e.target.value || null;
      if (value && routeState.panoramaxDataDate && value > routeState.panoramaxDataDate) {
        showDataDateToast(routeState.panoramaxDataDate);
        e.target.value = routeState.panoramaxDataDate;
        routeState.photoDateMax = routeState.panoramaxDataDate;
      } else {
        routeState.photoDateMax = value;
      }
      applyPanoramaxDateFilter();
      if (routeState.customModel && (routeState.avoidPhotoCoverage || routeState.avoidPhotoCoverageOnly360)) {
        applyPhotoCoverageSettings();
        recalculateRouteIfReady();
      }
    });
  }

  // Profile selector buttons (bike_customizable / car_customizable / foot)
  document.querySelectorAll('.profile-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const profile = btn.dataset.profile;
      if (profile === routeState.selectedProfile) return;

      trackEvent('Route', 'Profile', profile);
      routeState.selectedProfile = profile;
      routeState.customModel = ensureCustomModel(null, profile);

      // Update active state
      document.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      recalculateRouteIfReady();
    });
  });

  // Add waypoint button handler
  // Helper function to handle add waypoint button click
  const handleAddWaypointClick = () => {
    routeState.isSelectingWaypoint = true;
    routeState.isSelectingStart = false;
    routeState.isSelectingEnd = false;
    map.getCanvas().style.cursor = 'crosshair';

    document.querySelectorAll('.btn-set-start, .btn-set-start-header').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.btn-set-end, .btn-set-end-header').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.btn-add-waypoint, .btn-add-waypoint-header').forEach(btn => {
      btn.classList.add('active');
      btn.title = t('routing.addWaypointActive');
    });
  };

  const addWaypointBtn = document.getElementById('add-waypoint');
  if (addWaypointBtn) {
    addWaypointBtn.addEventListener('click', handleAddWaypointClick);
  }

  // Header add waypoint button
  const addWaypointBtnHeader = document.getElementById('add-waypoint-header');
  if (addWaypointBtnHeader) {
    addWaypointBtnHeader.addEventListener('click', handleAddWaypointClick);
  }
  
  // Waypoint optimization toggle handler
  const waypointOptimizationToggle = document.getElementById('waypoint-optimization-toggle');
  if (waypointOptimizationToggle) {
    // Initialize checkbox state from routeState
    waypointOptimizationToggle.checked = routeState.waypointOptimizationEnabled !== false;
    
    waypointOptimizationToggle.addEventListener('change', (e) => {
      routeState.waypointOptimizationEnabled = e.target.checked;
      
      // If optimization is re-enabled, reset manual sort flag to allow optimization
      if (e.target.checked) {
        routeState.waypointsManuallySorted = false;
      }
      
      // If optimization is enabled and we have waypoints, recalculate route with optimization
      if (e.target.checked && routeState.startPoint && routeState.endPoint && routeState.waypoints.length > 1) {
        recalculateRouteIfReady();
      }
    });
  }

  // Map click handler
  map.on('click', async (e) => {
    if (routeState.isSelectingStart) {
      await setStartPoint(map, e.lngLat, { autoActivateEnd: true });
      routeState.isSelectingStart = false;
      // Remove active class from both original and header buttons
      document.querySelectorAll('.btn-set-start, .btn-set-start-header').forEach(btn => {
        btn.classList.remove('active');
      });
    } else if (routeState.isSelectingEnd) {
      await setEndPoint(map, e.lngLat);
      routeState.isSelectingEnd = false;
      map.getCanvas().style.cursor = '';
    } else if (routeState.isSelectingWaypoint) {
      await addWaypoint(map, e.lngLat);
      routeState.isSelectingWaypoint = false;
      map.getCanvas().style.cursor = '';
      document.querySelectorAll('.btn-add-waypoint, .btn-add-waypoint-header').forEach(btn => {
        btn.classList.remove('active');
        btn.title = t('routing.addWaypoint');
      });
    }
  });

  // Geocoder integration for start and end inputs
  let startGeocoderControl = null;
  let endGeocoderControl = null;

  if (startInput) {
    startGeocoderControl = setupRoutingInputGeocoder(startInput, map, async ({ lng, lat, address }) => {
      // Use centralized setStartPoint function with geocoder options
      await setStartPoint(map, { lng, lat }, {
        fromGeocoder: true,
        address: address,
        autoActivateEnd: true
      });
      routeState.isSelectingStart = false;
      map.flyTo({ center: [lng, lat], zoom: 14 });
    });
  }

  if (endInput) {
    endGeocoderControl = setupRoutingInputGeocoder(endInput, map, async ({ lng, lat, address }) => {
      // Use centralized setEndPoint function with geocoder options
      await setEndPoint(map, { lng, lat }, {
        fromGeocoder: true,
        address: address
      });
      routeState.isSelectingEnd = false;
      map.getCanvas().style.cursor = '';
      map.flyTo({ center: [lng, lat], zoom: 14 });
    });
  }
  
  // Store geocoder controls for use in setStartPoint/setEndPoint
  if (startGeocoderControl) {
    window.startGeocoderControl = startGeocoderControl;
  }
  if (endGeocoderControl) {
    window.endGeocoderControl = endGeocoderControl;
  }
}

export async function setStartPoint(map, lngLat, options = {}) {
  const { fromGeocoder = false, address = null, autoActivateEnd = false } = options;
  
  routeState.startPoint = [lngLat.lng, lngLat.lat];
  updateMarkers(map);
  
  const startInput = document.getElementById('start-input');
  if (startInput) {
    if (fromGeocoder) {
      // Address is provided by geocoder, use it
      if (address) {
        routeState.startAddress = address;
      }
      // Mark as from geocoder (not map click)
      if (window.startGeocoderControl) {
        window.startGeocoderControl.setFromMapClick(false);
      }
    } else {
      // From map click - show coordinates
      startInput.value = `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`;
      if (window.startGeocoderControl) {
        window.startGeocoderControl.setFromMapClick(true);
      }
      // Fetch address for tooltip
      routeState.startAddress = await reverseGeocode(lngLat.lng, lngLat.lat);
      updateCoordinateTooltips();
    }
  }
  
  // Automatically activate end point selection mode if requested
  if (autoActivateEnd) {
    routeState.isSelectingStart = false;
    routeState.isSelectingEnd = true;
    map.getCanvas().style.cursor = 'crosshair';
    // Remove active class from both original and header buttons
    document.querySelectorAll('.btn-set-start, .btn-set-start-header').forEach(btn => {
      btn.classList.remove('active');
    });
    // Add active class to end buttons
    document.querySelectorAll('.btn-set-end, .btn-set-end-header').forEach(btn => {
      btn.classList.add('active');
    });
  }
  
  updateCoordinateTooltips();
  
  // Automatically calculate route if both points are set
  recalculateRouteIfReady();
}

export async function setEndPoint(map, lngLat, options = {}) {
  const { fromGeocoder = false, address = null } = options;
  
  routeState.endPoint = [lngLat.lng, lngLat.lat];
  updateMarkers(map);
  
  const endInput = document.getElementById('end-input');
  if (endInput) {
    if (fromGeocoder) {
      // Address is provided by geocoder, use it
      if (address) {
        routeState.endAddress = address;
      }
      // Mark as from geocoder (not map click)
      if (window.endGeocoderControl) {
        window.endGeocoderControl.setFromMapClick(false);
      }
    } else {
      // From map click - show coordinates
      endInput.value = `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`;
      if (window.endGeocoderControl) {
        window.endGeocoderControl.setFromMapClick(true);
      }
      // Fetch address for tooltip
      routeState.endAddress = await reverseGeocode(lngLat.lng, lngLat.lat);
      updateCoordinateTooltips();
    }
  }
  
  // Remove active class from both original and header buttons
  document.querySelectorAll('.btn-set-end, .btn-set-end-header').forEach(btn => {
    btn.classList.remove('active');
  });
  
  updateCoordinateTooltips();
  
  // Automatically calculate route if both points are set
  recalculateRouteIfReady();
}

export function updateMarkers(map) {
  // Remove existing markers
  if (routeState.startMarker) {
    routeState.startMarker.remove();
    routeState.startMarker = null;
  }
  if (routeState.endMarker) {
    routeState.endMarker.remove();
    routeState.endMarker = null;
  }
  // Remove all waypoint markers
  routeState.waypointMarkers.forEach(marker => {
    if (marker) marker.remove();
  });
  routeState.waypointMarkers = [];
  
  // Create start marker using factory
  if (routeState.startPoint) {
    routeState.startMarker = createStartMarker(map, routeState.startPoint);
  }
  
  // Create end marker using factory
  if (routeState.endPoint) {
    routeState.endMarker = createEndMarker(map, routeState.endPoint);
  }
  
  // Create waypoint markers using factory
  routeState.waypoints.forEach((waypoint, index) => {
    const marker = createWaypointMarker(map, waypoint, index);
    routeState.waypointMarkers.push(marker);
  });
  
  // Waypoints container is always visible now, no need to hide/show
}

// Waypoint List UI is now in ./waypoints/waypointList.js

// Waypoint management is now in ./waypoints/waypointManager.js
export { addWaypoint, removeWaypoint } from './waypoints/waypointManager.js';


export async function geocodeAddress(query) {
  try {
    // Use Photon geocoder
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      return {
        lng: feature.geometry.coordinates[0],
        lat: feature.geometry.coordinates[1]
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}

// Coordinate tooltips are now in ./coordinates/coordinateTooltips.js

