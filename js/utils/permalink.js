// permalink.js - Permalink functionality for map state, routing, and context layers

import { routeState } from '../routing/routeState.js';
import { updateMarkers, getRandomWaypointSvg } from '../routing/routingUI.js';
import { updateWaypointsList } from '../routing/waypoints/waypointList.js';
import { updateCoordinateTooltips } from '../routing/coordinates/coordinateTooltips.js';
import { ensureCustomModel } from '../routing/customModel.js';
import { GRAPHHOPPER_URL, PERMALINK as PERMALINK_CONFIG } from './constants.js';
import { t } from '../i18n/i18n.js';

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
      if (!this.hasMapParam) {
        await this.fitMapToRouterBBox();
      }
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
      customModel: routeState.customModel
    };
  }

  async getRouterBBox() {
    try {
      const infoUrl = `${GRAPHHOPPER_URL}/info`;
      const response = await fetch(infoUrl);
      if (!response.ok) {
        console.warn('[Permalink] Could not load router info, status', response.status);
        return null;
      }
      const data = await response.json();

      // Common keys: bbox or boundingBox, plus min/max lat/lon
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
        console.warn('[Permalink] Router info does not include bboxes');
        return null;
      }

      if (data.coverage_date) {
        const el = document.getElementById('coverage-date-info');
        if (el) {
          const dateStr = data.coverage_date.substring(0, 10);
          el.textContent = t('photoCoverage.coverageDate').replace('{date}', dateStr);
          el.style.display = 'block';
        }
      }

      // Date range picker: show and populate only when date data is available
      if (data.coverage_date_min || data.coverage_date) {
        const dateRangeEl = document.getElementById('coverage-date-range');
        if (dateRangeEl) dateRangeEl.style.display = 'block';

        const minInput = document.getElementById('photo-date-min');
        const maxInput = document.getElementById('photo-date-max');

        if (minInput) {
          minInput.disabled = false;
          if (data.coverage_date_min) {
            minInput.value = data.coverage_date_min.substring(0, 10);
            routeState.photoDateMin = minInput.value;
          }
        }
        if (maxInput) {
          maxInput.disabled = false;
          if (data.coverage_date) {
            maxInput.value = data.coverage_date.substring(0, 10);
            routeState.photoDateMax = maxInput.value;
          }
        }
      }

      return this.normalizeBbox(bbox);
    } catch (err) {
      console.warn('[Permalink] failed to fetch router bbox:', err);
      return null;
    }
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

  async fitMapToRouterBBox() {
    if (!this.map) return;

    const bbox = await this.getRouterBBox();
    if (!bbox) {
      console.warn('[Permalink] No router bbox available to fit map');
      return;
    }

    try {
      this.map.fitBounds(bbox, {
        padding: { top: 70, bottom: 70, left: 70, right: 70 },
        duration: 800
      });
      console.debug('[Permalink] Map fit to router bbox', bbox);
    } catch (err) {
      console.warn('[Permalink] fitBounds failed:', err);
    }

    // Draw a subtle rectangle showing the GraphHopper coverage area
    this.drawRouterBBoxLayer(bbox);
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

  updateURL() {
    if (this.isUpdating) return;
    
    const paramParts = [];
    
    // Map state
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    const lng = Math.round(center.lng * 1000) / 1000;
    const lat = Math.round(center.lat * 1000) / 1000;
    const zoomRounded = Math.round(zoom * 10) / 10;
    
    paramParts.push(`map=${zoomRounded}/${lat}/${lng}`);
    
    // Route points (using / separator like map parameter)
    if (routeState.startPoint) {
      const [startLng, startLat] = routeState.startPoint;
      paramParts.push(`start=${Math.round(startLat * 10000) / 10000}/${Math.round(startLng * 10000) / 10000}`);
    }
    
    if (routeState.endPoint) {
      const [endLng, endLat] = routeState.endPoint;
      paramParts.push(`end=${Math.round(endLat * 10000) / 10000}/${Math.round(endLng * 10000) / 10000}`);
    }
    
    // Waypoints
    routeState.waypoints.forEach(waypoint => {
      // Support both array format [lng, lat] and object format {lng, lat, svgId}
      let lng, lat;
      if (Array.isArray(waypoint)) {
        [lng, lat] = waypoint;
      } else if (waypoint && typeof waypoint === 'object') {
        lng = waypoint.lng;
        lat = waypoint.lat;
      } else {
        return; // Skip invalid waypoints
      }
      paramParts.push(`waypoint=${Math.round(lat * 10000) / 10000}/${Math.round(lng * 10000) / 10000}`);
    });
    
    // Profile - include all profiles including car_customizable
    if (routeState.selectedProfile) {
      paramParts.push(`profile=${encodeURIComponent(routeState.selectedProfile)}`);
    }
    
    
    // Encoded value type
    if (routeState.currentEncodedType) {
      paramParts.push(`encoded=${encodeURIComponent(routeState.currentEncodedType)}`);
    }
    
    const newURL = `${window.location.pathname}?${paramParts.join('&')}`;
    window.history.replaceState({}, '', newURL);
  }

  async loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    // Load map state
    const mapParam = params.get('map');
    if (mapParam) {
      const parts = mapParam.split('/');
      if (parts.length === 3) {
        const zoom = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        const lng = parseFloat(parts[2]);
        
        if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
          this.hasMapParam = true;
          this.isUpdating = true;
          this.map.setCenter([lng, lat]);
          this.map.setZoom(zoom);
          setTimeout(() => {
            this.isUpdating = false;
          }, 100);
        }
      }
    }

    if (!this.hasMapParam) {
      // If no explicit map parameter is available in URL, map will be centered to router bbox on load.
      console.debug('[Permalink] No map param in URL, will fit router bbox once map is loaded');
    }
    
    // Load route points
    // Support both 'start'/'end' format and 'point' format (GraphHopper style)
    const startParam = params.get('start');
    const pointParams = params.getAll('point');
    
    if (startParam) {
      // Support both / and , separators (backwards compatibility)
      const separator = startParam.includes('/') ? '/' : ',';
      const [lat, lng] = startParam.split(separator).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) {
        routeState.startPoint = [lng, lat];
        // Update input field
        const startInput = document.getElementById('start-input');
        if (startInput) {
          startInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
      }
    } else if (pointParams.length >= 1) {
      // Support 'point' parameter format (GraphHopper style)
      const separator = pointParams[0].includes('/') ? '/' : ',';
      const [lat, lng] = pointParams[0].split(separator).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) {
        routeState.startPoint = [lng, lat];
        const startInput = document.getElementById('start-input');
        if (startInput) {
          startInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
      }
    }
    
    const endParam = params.get('end');
    if (endParam) {
      // Support both / and , separators (backwards compatibility)
      const separator = endParam.includes('/') ? '/' : ',';
      const [lat, lng] = endParam.split(separator).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) {
        routeState.endPoint = [lng, lat];
        // Update input field
        const endInput = document.getElementById('end-input');
        if (endInput) {
          endInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
      }
    } else if (pointParams.length >= 2) {
      // Support 'point' parameter format (GraphHopper style)
      const separator = pointParams[1].includes('/') ? '/' : ',';
      const [lat, lng] = pointParams[1].split(separator).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) {
        routeState.endPoint = [lng, lat];
        const endInput = document.getElementById('end-input');
        if (endInput) {
          endInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
      }
    }
    
    // Load waypoints
    const waypointParams = params.getAll('waypoint');
    routeState.waypoints = [];
    routeState.waypointAddresses = [];
    
    // Load waypoints and fetch addresses asynchronously
    const waypointPromises = waypointParams.map(async (waypointParam) => {
      // Support both / and , separators (backwards compatibility)
      const separator = waypointParam.includes('/') ? '/' : ',';
      const [lat, lng] = waypointParam.split(separator).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) {
        // Create waypoint object with random SVG (same as when adding new waypoint)
        routeState.waypoints.push({
          lng: lng,
          lat: lat,
          svgId: getRandomWaypointSvg()
        });
        
        // Fetch address for tooltip
        const { reverseGeocode } = await import('../utils/geocoder.js');
        const address = await reverseGeocode(lng, lat);
        routeState.waypointAddresses.push(address);
      }
    });
    
    // Wait for all waypoint addresses to be fetched
    await Promise.all(waypointPromises);
    
    // Also fetch addresses for start and end points if they exist
    if (routeState.startPoint) {
      const { reverseGeocode } = await import('../utils/geocoder.js');
      routeState.startAddress = await reverseGeocode(routeState.startPoint[0], routeState.startPoint[1]);
    }
    
    if (routeState.endPoint) {
      const { reverseGeocode } = await import('../utils/geocoder.js');
      routeState.endAddress = await reverseGeocode(routeState.endPoint[0], routeState.endPoint[1]);
    }
    
    // Update markers if points were loaded
    if (routeState.startPoint || routeState.endPoint || routeState.waypoints.length > 0) {
      updateMarkers(this.map);
      updateWaypointsList();
      updateCoordinateTooltips();
    }
    
    // Restore profile from URL (default: bike_customizable)
    const profileParam = params.get('profile');
    const validProfiles = ['bike_customizable', 'car_customizable', 'foot'];
    const profile = validProfiles.includes(profileParam) ? profileParam : 'bike_customizable';
    routeState.selectedProfile = profile;
    routeState.customModel = ensureCustomModel(null, profile);

    // Update profile button UI to match restored profile
    document.querySelectorAll('.profile-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.profile === profile);
    });
    
    // Load encoded value type
    const encodedParam = params.get('encoded');
    if (encodedParam) {
      routeState.currentEncodedType = encodedParam;
      // Update select dropdown
      const encodedSelect = document.getElementById('heightgraph-encoded-select');
      if (encodedSelect) {
        encodedSelect.value = encodedParam;
      }
    }
    
    // If both start and end points are loaded, mark for route calculation
    // Route will be calculated after map is loaded and routing sources exist
    if (routeState.startPoint && routeState.endPoint) {
      this.pendingRouteCalculation = true;
      // If map is already loaded, calculate immediately
      if (this.map.loaded()) {
        this.calculateRouteFromURL();
      }
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
    const paramParts = [];
    
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    const mapParam = `${Math.round(zoom * 10) / 10}/${Math.round(center.lat * 1000) / 1000}/${Math.round(center.lng * 1000) / 1000}`;
    paramParts.push(`map=${mapParam}`);
    
    if (routeState.startPoint) {
      const [lng, lat] = routeState.startPoint;
      paramParts.push(`start=${Math.round(lat * 10000) / 10000}/${Math.round(lng * 10000) / 10000}`);
    }
    
    if (routeState.endPoint) {
      const [lng, lat] = routeState.endPoint;
      paramParts.push(`end=${Math.round(lat * 10000) / 10000}/${Math.round(lng * 10000) / 10000}`);
    }
    
    // Add waypoints
    routeState.waypoints.forEach(waypoint => {
      // Support both array format [lng, lat] and object format {lng, lat, svgId}
      let lng, lat;
      if (Array.isArray(waypoint)) {
        [lng, lat] = waypoint;
      } else if (waypoint && typeof waypoint === 'object') {
        lng = waypoint.lng;
        lat = waypoint.lat;
      } else {
        return; // Skip invalid waypoints
      }
      paramParts.push(`waypoint=${Math.round(lat * 10000) / 10000}/${Math.round(lng * 10000) / 10000}`);
    });
    
    // Profile - include all profiles including car_customizable
    if (routeState.selectedProfile) {
      paramParts.push(`profile=${encodeURIComponent(routeState.selectedProfile)}`);
    }
    
    
    if (routeState.currentEncodedType) {
      paramParts.push(`encoded=${encodeURIComponent(routeState.currentEncodedType)}`);
    }
    
    return `${window.location.origin}${window.location.pathname}?${paramParts.join('&')}`;
  }
}

// Export a simple setup function
export function setupPermalink(map) {
  return new Permalink(map);
}
