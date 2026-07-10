// permalink.js - Permalink functionality for map state, routing, and context layers

import { routeState } from '../routing/routeState.js';
import {
  updateMarkers,
  getRandomWaypointSvg,
  applyPhotoCoverageSettings,
  syncPanoramaxLayers,
  updateStrengthRowVisibility,
} from '../routing/routingUI.js';
import { updateWaypointsList } from '../routing/waypoints/waypointList.js';
import { updateCoordinateTooltips } from '../routing/coordinates/coordinateTooltips.js';
import { ensureCustomModel } from '../routing/customModel.js';
import { GRAPHHOPPER_URL, PERMALINK as PERMALINK_CONFIG } from './constants.js';
import { t, getLang } from '../i18n/i18n.js';

export class Permalink {
  constructor(map) {
    this.map = map;
    this.isUpdating = false;
    this.pendingRouteCalculation = false; // Flag to track if route should be calculated after map loads
    this.hasMapParam = false; // track if map position came from URL
    this.setupEventListeners();
    // Load from URL asynchronously (don't await to avoid blocking constructor)
    this.loadFromURL().catch(err => {
      console.error('Error loading from URL:', err);
    });
  }

  setupEventListeners() {
    // Update URL on map move/zoom (debounced)
    this.map.on('moveend', () => this.updateURL());
    this.map.on('zoomend', () => this.updateURL());
    
    // Wait for map to load before calculating route from URL and setting default view
    this.map.once('load', async () => {
      // Always fetch /info to get data freshness date and set input max
      const bbox = await this.getRouterBBox();
      if (!this.hasMapParam && bbox) {
        try {
          this.map.fitBounds(bbox, {
            padding: { top: 70, bottom: 70, left: 70, right: 70 },
            duration: 800
          });
        } catch (err) {
          console.warn('[Permalink] fitBounds failed:', err);
        }
        this.drawRouterBBoxLayer(bbox);
      }
      // Sync panoramax layers after map is ready (needed when restored from URL)
      syncPanoramaxLayers();
      this.applyDisplaySettingsFromURL();
      this.scheduleRouterDownCheck();
      if (this.pendingRouteCalculation) {
        this.calculateRouteFromURL();
      }
    });
    
    // Update URL when route points change
    // We'll use a MutationObserver or polling to detect routeState changes
    // For now, we'll update on specific events
    this.setupRouteStateListeners();
  }

  setupRouteStateListeners() {
    // Monitor routeState changes by checking periodically
    // This is a simple approach - could be improved with a state management system
    let lastState = this.getRouteStateSnapshot();
    
    const checkState = () => {
      const currentState = this.getRouteStateSnapshot();
      if (JSON.stringify(currentState) !== JSON.stringify(lastState)) {
        lastState = currentState;
        this.updateURL();
      }
    };
    
    // Check state changes periodically (debounced)
    setInterval(checkState, PERMALINK_CONFIG.STATE_CHECK_INTERVAL);
    
    // Also update immediately when encoded type changes
    const encodedSelect = document.getElementById('heightgraph-encoded-select');
    if (encodedSelect) {
      encodedSelect.addEventListener('change', () => {
        setTimeout(() => this.updateURL(), PERMALINK_CONFIG.UPDATE_DELAY);
      });
    }
    
    // Update when profile changes
    document.querySelectorAll('.profile-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setTimeout(() => this.updateURL(), PERMALINK_CONFIG.UPDATE_DELAY);
      });
    });
  }

  getRouteStateSnapshot() {
    return {
      startPoint: routeState.startPoint,
      endPoint: routeState.endPoint,
      selectedProfile: routeState.selectedProfile,
      currentEncodedType: routeState.currentEncodedType,
      customModel: routeState.customModel,
      avoidPhotoCoverage: routeState.avoidPhotoCoverage,
      avoidPhotoCoverageOnly360: routeState.avoidPhotoCoverageOnly360,
      photoCoverageStrength: routeState.photoCoverageStrength,
      photoDateMin: routeState.photoDateMin,
      photoDateMax: routeState.photoDateMax,
      displaySettings: this.getDisplaySettings(),
    };
  }

  // Current basemap / view / overlay settings, read from the UI controls
  getDisplaySettings() {
    const checked = id => !!document.getElementById(id)?.checked;
    return {
      basemap: document.querySelector('.basemap-btn.selected')?.dataset.map || 'osm',
      terrain: checked('toggleTerrain'),
      hillshade: checked('toggleHillshade'),
      trailsHiking: checked('toggleTrailsHiking'),
      trailsCycling: checked('toggleTrailsCycling'),
      bookboxes: checked('toggleBookBoxes'),
    };
  }

  async getRouterBBox() {
    try {
      const infoUrl = `${GRAPHHOPPER_URL}/info`;
      const response = await fetch(infoUrl);
      if (!response.ok) {
        console.warn('[Permalink] Could not load router info, status', response.status);
        this.routerInfoFailed = true;
        return null;
      }
      this.routerInfoFailed = false;
      const data = await response.json();
      console.debug('[Permalink] /info response:', data);

      // ── Coverage date ceiling ──────────────────────────────────────────────
      // Done before bbox check so it always runs even if bbox is missing.
      if (data.data_date) {
        const dataDateStr = data.data_date.substring(0, 10);
        routeState.panoramaxDataDate = dataDateStr;

        const el = document.getElementById('coverage-date-info');
        if (el) {
          const formattedDate = new Intl.DateTimeFormat(getLang(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dataDateStr + 'T12:00:00'));
          el.textContent = t('photoCoverage.coverageDate').replace('{date}', formattedDate);
          el.style.display = 'block';
        }

        const maxInput = document.getElementById('photo-date-max');
        if (maxInput) {
          maxInput.setAttribute('max', dataDateStr);
          // Set or clamp: use data date if input is empty or exceeds the ceiling
          if (!maxInput.value || maxInput.value > dataDateStr) {
            maxInput.value = dataDateStr;
            routeState.photoDateMax = dataDateStr;
          }
        }
      }

      if (data.coverage_date_min) {
        const minInput = document.getElementById('photo-date-min');
        if (minInput && !minInput.value) {
          minInput.value = data.coverage_date_min.substring(0, 10);
          routeState.photoDateMin = minInput.value;
        }
      }

      // ── Bounding box ──────────────────────────────────────────────────────
      let bbox = null;
      if (Array.isArray(data.bbox) && data.bbox.length === 4) {
        bbox = data.bbox;
      } else if (Array.isArray(data.boundingBox) && data.boundingBox.length === 4) {
        bbox = data.boundingBox;
      } else if (data.min_lat != null && data.min_lon != null && data.max_lat != null && data.max_lon != null) {
        bbox = [data.min_lat, data.min_lon, data.max_lat, data.max_lon];
      } else if (data.minLat != null && data.minLon != null && data.maxLat != null && data.maxLon != null) {
        bbox = [data.minLat, data.minLon, data.maxLat, data.maxLon];
      }

      if (!bbox) {
        console.warn('[Permalink] Router info does not include a recognized bbox format');
      }

      return this.normalizeBbox(bbox);
    } catch (err) {
      console.warn('[Permalink] failed to fetch router bbox:', err);
      this.routerInfoFailed = true;
      return null;
    }
  }

  // If the router /info call failed at startup, retry once after a short delay
  // (avoids false positives on flaky connections), then warn the user with a
  // banner — otherwise the outage is only discovered when calculating a route.
  scheduleRouterDownCheck() {
    if (!this.routerInfoFailed) return;
    setTimeout(async () => {
      const bbox = await this.getRouterBBox();
      if (!this.routerInfoFailed) {
        // Router came back: apply the bbox that was missed at startup
        if (!this.hasMapParam && bbox) {
          try {
            this.map.fitBounds(bbox, {
              padding: { top: 70, bottom: 70, left: 70, right: 70 },
              duration: 800
            });
          } catch { /* ignore */ }
          this.drawRouterBBoxLayer(bbox);
        }
        return;
      }
      const { showRouterDownBanner } = await import('../ui/maintenanceBanner.js');
      showRouterDownBanner();
    }, 3000);
  }

  normalizeBbox(bbox) {
    if (!Array.isArray(bbox) || bbox.length !== 4) return null;

    const [a, b, c, d] = bbox.map(Number);
    if ([a, b, c, d].some(v => Number.isNaN(v))) return null;

    const isLat = v => !Number.isNaN(v) && v >= -90 && v <= 90;
    const isLon = v => !Number.isNaN(v) && v >= -180 && v <= 180;

    // Prefer GraphHopper format: [minLon,minLat,maxLon,maxLat]
    if (isLon(a) && isLat(b) && isLon(c) && isLat(d)) {
      return [[a, b], [c, d]];
    }

    // Try [minLat,minLon,maxLat,maxLon] just in case
    if (isLat(a) && isLon(b) && isLat(c) && isLon(d)) {
      return [[b, a], [d, c]];
    }

    // fallback exact min/max by bounding all coords
    const lngValues = [a, b, c, d].filter(isLon);
    const latValues = [a, b, c, d].filter(isLat);
    if (lngValues.length >= 2 && latValues.length >= 2) {
      const minLng = Math.min(...lngValues);
      const maxLng = Math.max(...lngValues);
      const minLat = Math.min(...latValues);
      const maxLat = Math.max(...latValues);
      return [[minLng, minLat], [maxLng, maxLat]];
    }

    return null;
  }

  /**
   * Add a GeoJSON polygon layer showing the GraphHopper coverage area.
   * @param {Array} bbox - [[minLng, minLat], [maxLng, maxLat]]
   */
  drawRouterBBoxLayer(bbox) {
    if (!this.map || !bbox) return;

    const [[minLng, minLat], [maxLng, maxLat]] = bbox;

    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat]
        ]]
      }
    };

    // Remove existing layers/source if they already exist (e.g., after a style reload)
    if (this.map.getLayer('router-bbox-fill')) this.map.removeLayer('router-bbox-fill');
    if (this.map.getLayer('router-bbox-border')) this.map.removeLayer('router-bbox-border');
    if (this.map.getSource('router-bbox')) this.map.removeSource('router-bbox');

    this.map.addSource('router-bbox', {
      type: 'geojson',
      data: geojson
    });

    // Very light fill to mark the covered area
    this.map.addLayer({
      id: 'router-bbox-fill',
      type: 'fill',
      source: 'router-bbox',
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.04
      }
    });

    // Dashed border to clearly outline the coverage zone
    this.map.addLayer({
      id: 'router-bbox-border',
      type: 'line',
      source: 'router-bbox',
      paint: {
        'line-color': '#3b82f6',
        'line-width': 1.5,
        'line-opacity': 0.5,
        'line-dasharray': [4, 4]
      }
    });
  }

  // Restore basemap / view / overlay settings parsed from the URL.
  // Reuses the existing UI controls (checkbox change events, basemap button click)
  // so all layer logic stays in one place.
  applyDisplaySettingsFromURL() {
    const settings = this.pendingDisplaySettings;
    if (!settings) return;
    this.pendingDisplaySettings = null;

    const activateToggle = (id, on) => {
      const el = document.getElementById(id);
      if (el && on && !el.checked) {
        el.checked = true;
        el.dispatchEvent(new Event('change'));
      }
    };
    activateToggle('toggleTerrain', settings.terrain);
    activateToggle('toggleHillshade', settings.hillshade);
    activateToggle('toggleTrailsHiking', settings.trailsHiking);
    activateToggle('toggleTrailsCycling', settings.trailsCycling);
    activateToggle('toggleBookBoxes', settings.bookboxes);

    if (settings.basemap && settings.basemap !== 'osm') {
      const btn = document.querySelector(`.basemap-btn[data-map="${CSS.escape(settings.basemap)}"]`);
      // Skip hidden buttons (e.g. topo without an API key)
      if (btn && getComputedStyle(btn).display !== 'none') {
        btn.click();
      }
    }
  }

  buildParamParts() {
    const paramParts = [];

    // Map state
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    paramParts.push(`map=${Math.round(zoom * 10) / 10}/${Math.round(center.lat * 1000) / 1000}/${Math.round(center.lng * 1000) / 1000}`);

    // Route points
    if (routeState.startPoint) {
      const [lng, lat] = routeState.startPoint;
      paramParts.push(`start=${Math.round(lat * 10000) / 10000}/${Math.round(lng * 10000) / 10000}`);
    }
    if (routeState.endPoint) {
      const [lng, lat] = routeState.endPoint;
      paramParts.push(`end=${Math.round(lat * 10000) / 10000}/${Math.round(lng * 10000) / 10000}`);
    }

    // Waypoints
    routeState.waypoints.forEach(waypoint => {
      let wLng, wLat;
      if (Array.isArray(waypoint)) {
        [wLng, wLat] = waypoint;
      } else if (waypoint && typeof waypoint === 'object') {
        wLng = waypoint.lng;
        wLat = waypoint.lat;
      } else return;
      paramParts.push(`waypoint=${Math.round(wLat * 10000) / 10000}/${Math.round(wLng * 10000) / 10000}`);
    });

    // Profile
    if (routeState.selectedProfile) {
      paramParts.push(`profile=${encodeURIComponent(routeState.selectedProfile)}`);
    }

    // Encoded value type
    if (routeState.currentEncodedType) {
      paramParts.push(`encoded=${encodeURIComponent(routeState.currentEncodedType)}`);
    }

    // Photo coverage
    if (routeState.avoidPhotoCoverage) paramParts.push('avoid_coverage=1');
    if (routeState.avoidPhotoCoverageOnly360) paramParts.push('avoid_360=1');
    if (routeState.avoidPhotoCoverage || routeState.avoidPhotoCoverageOnly360) {
      paramParts.push(`coverage_strength=${routeState.photoCoverageStrength ?? 50}`);
    }
    if (routeState.photoDateMin) paramParts.push(`date_min=${routeState.photoDateMin}`);
    if (routeState.photoDateMax) paramParts.push(`date_max=${routeState.photoDateMax}`);

    // Basemap / view / overlay settings (only non-defaults, to keep the URL short)
    const display = this.getDisplaySettings();
    if (display.basemap && display.basemap !== 'osm') paramParts.push(`basemap=${encodeURIComponent(display.basemap)}`);
    if (display.terrain) paramParts.push('terrain=1');
    if (display.hillshade) paramParts.push('hillshade=1');
    if (display.trailsHiking) paramParts.push('trails_hiking=1');
    if (display.trailsCycling) paramParts.push('trails_cycling=1');
    if (display.bookboxes) paramParts.push('bookboxes=1');

    return paramParts;
  }

  updateURL() {
    if (this.isUpdating) return;
    const newURL = `${window.location.pathname}?${this.buildParamParts().join('&')}`;
    window.history.replaceState({}, '', newURL);
  }

  async loadFromURL() {
    const params = new URLSearchParams(window.location.search);

    // ── SYNCHRONOUS SECTION ──────────────────────────────────────────────────
    // Everything here runs before the first await, so routeState is fully
    // populated before the map 'load' event can fire and call syncPanoramaxLayers.

    // Map position
    const mapParam = params.get('map');
    if (mapParam) {
      const parts = mapParam.split('/');
      if (parts.length === 3) {
        const zoom = parseFloat(parts[0]);
        const lat  = parseFloat(parts[1]);
        const lng  = parseFloat(parts[2]);
        if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
          this.hasMapParam = true;
          this.isUpdating = true;
          this.map.setCenter([lng, lat]);
          this.map.setZoom(zoom);
          setTimeout(() => { this.isUpdating = false; }, 100);
        }
      }
    }
    if (!this.hasMapParam) {
      console.debug('[Permalink] No map param in URL, will fit router bbox once map is loaded');
    }

    // Start point
    const startParam  = params.get('start');
    const pointParams = params.getAll('point');
    if (startParam) {
      const sep = startParam.includes('/') ? '/' : ',';
      const [lat, lng] = startParam.split(sep).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) {
        routeState.startPoint = [lng, lat];
        const el = document.getElementById('start-input');
        if (el) el.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }
    } else if (pointParams.length >= 1) {
      const sep = pointParams[0].includes('/') ? '/' : ',';
      const [lat, lng] = pointParams[0].split(sep).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) {
        routeState.startPoint = [lng, lat];
        const el = document.getElementById('start-input');
        if (el) el.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }
    }

    // End point
    const endParam = params.get('end');
    if (endParam) {
      const sep = endParam.includes('/') ? '/' : ',';
      const [lat, lng] = endParam.split(sep).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) {
        routeState.endPoint = [lng, lat];
        const el = document.getElementById('end-input');
        if (el) el.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }
    } else if (pointParams.length >= 2) {
      const sep = pointParams[1].includes('/') ? '/' : ',';
      const [lat, lng] = pointParams[1].split(sep).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) {
        routeState.endPoint = [lng, lat];
        const el = document.getElementById('end-input');
        if (el) el.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }
    }

    // Waypoints (coordinates only — addresses fetched async below)
    const waypointParams = params.getAll('waypoint');
    routeState.waypoints = [];
    routeState.waypointAddresses = [];
    waypointParams.forEach(wp => {
      const sep = wp.includes('/') ? '/' : ',';
      const [lat, lng] = wp.split(sep).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) {
        routeState.waypoints.push({ lng, lat, svgId: getRandomWaypointSvg() });
      }
    });

    // Profile
    const profileParam  = params.get('profile');
    const validProfiles = ['bike_customizable', 'car_customizable', 'foot'];
    const profile = validProfiles.includes(profileParam) ? profileParam : 'bike_customizable';
    routeState.selectedProfile = profile;
    routeState.customModel = ensureCustomModel(null, profile);
    document.querySelectorAll('.profile-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.profile === profile);
    });

    // Encoded value type
    const encodedParam = params.get('encoded');
    if (encodedParam) {
      routeState.currentEncodedType = encodedParam;
      const encodedSelect = document.getElementById('heightgraph-encoded-select');
      if (encodedSelect) encodedSelect.value = encodedParam;
    }

    // Basemap / view / overlay settings (applied once the map is loaded,
    // because the layers and toggle handlers must exist first)
    this.pendingDisplaySettings = {
      basemap: params.get('basemap'),
      terrain: params.get('terrain') === '1',
      hillshade: params.get('hillshade') === '1',
      trailsHiking: params.get('trails_hiking') === '1',
      trailsCycling: params.get('trails_cycling') === '1',
      bookboxes: params.get('bookboxes') === '1',
    };

    // Photo coverage settings
    const avoidCoverage      = params.get('avoid_coverage') === '1';
    const avoid360           = params.get('avoid_360') === '1';
    const coverageStrengthParam = params.get('coverage_strength');
    const dateMinParam       = params.get('date_min');
    const dateMaxParam       = params.get('date_max');

    routeState.avoidPhotoCoverage      = avoidCoverage;
    routeState.avoidPhotoCoverageOnly360 = avoid360;
    if (coverageStrengthParam !== null) {
      routeState.photoCoverageStrength = parseFloat(coverageStrengthParam);
    }
    if (dateMinParam) routeState.photoDateMin = dateMinParam;
    if (dateMaxParam) routeState.photoDateMax = dateMaxParam;

    const coverageSwitch  = document.getElementById('avoid-photo-coverage');
    if (coverageSwitch)  coverageSwitch.checked = avoidCoverage;
    const coverage360Switch = document.getElementById('avoid-photo-coverage-360');
    if (coverage360Switch) coverage360Switch.checked = avoid360;
    const strengthSlider  = document.getElementById('photo-coverage-strength');
    if (strengthSlider)  strengthSlider.value = routeState.photoCoverageStrength ?? 50;
    const dateMinInput = document.getElementById('photo-date-min');
    if (dateMinInput && dateMinParam) dateMinInput.value = dateMinParam;
    const dateMaxInput = document.getElementById('photo-date-max');
    if (dateMaxInput && dateMaxParam) dateMaxInput.value = dateMaxParam;

    if (avoidCoverage || avoid360) {
      applyPhotoCoverageSettings();
      updateStrengthRowVisibility();
    }

    // Route calculation flag (map layers sync happens in the 'load' handler)
    if (routeState.startPoint && routeState.endPoint) {
      this.pendingRouteCalculation = true;
      if (this.map.loaded()) {
        this.calculateRouteFromURL();
      }
    }

    // ── ASYNC SECTION ────────────────────────────────────────────────────────
    // Geocoding only — map layer state is already fully set above.

    const { reverseGeocode } = await import('../utils/geocoder.js');

    const waypointAddresses = await Promise.all(
      routeState.waypoints.map(wp => reverseGeocode(wp.lng, wp.lat))
    );
    routeState.waypointAddresses = waypointAddresses;

    if (routeState.startPoint) {
      routeState.startAddress = await reverseGeocode(routeState.startPoint[0], routeState.startPoint[1]);
    }
    if (routeState.endPoint) {
      routeState.endAddress = await reverseGeocode(routeState.endPoint[0], routeState.endPoint[1]);
    }

    if (routeState.startPoint || routeState.endPoint || routeState.waypoints.length > 0) {
      updateMarkers(this.map);
      updateWaypointsList();
      updateCoordinateTooltips();
    }
  }

  calculateRouteFromURL() {
    // Check if routing sources exist (they should be created by setupRouting)
    // setupRouting is called in map.on('load'), so we need to wait for it
    let retryCount = 0;
    const maxRetries = PERMALINK_CONFIG.MAX_ROUTE_RETRIES;
    
    const checkAndCalculate = () => {
      if (this.map.getSource('route') && routeState.startPoint && routeState.endPoint) {
        import('../routing/routeRecalculator.js').then(({ recalculateRouteIfReady }) => {
          recalculateRouteIfReady();
        });
        this.pendingRouteCalculation = false;
      } else if (this.pendingRouteCalculation && retryCount < maxRetries) {
        // Retry after a short delay if sources don't exist yet
        retryCount++;
        setTimeout(checkAndCalculate, PERMALINK_CONFIG.ROUTE_RETRY_DELAY);
      } else if (retryCount >= maxRetries) {
        // Give up after max retries
        console.warn('Permalink: Could not calculate route - routing sources not available');
        this.pendingRouteCalculation = false;
      }
    };
    
    // Start checking
    checkAndCalculate();
  }

  // Method to get current state as URL parameters
  getCurrentState() {
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    
    return {
      lng: Math.round(center.lng * 1000) / 1000,
      lat: Math.round(center.lat * 1000) / 1000,
      zoom: Math.round(zoom * 10) / 10,
      startPoint: routeState.startPoint,
      endPoint: routeState.endPoint,
      profile: routeState.selectedProfile,
      encodedType: routeState.currentEncodedType
    };
  }

  // Method to generate shareable URL
  getShareableURL() {
    return `${window.location.origin}${window.location.pathname}?${this.buildParamParts().join('&')}`;
  }
}

// Export a simple setup function
export function setupPermalink(map) {
  return new Permalink(map);
}
