// Constants used throughout the application

import { t } from '../i18n/i18n.js';
import { envConfig } from '../config/envConfig.js';

// GraphHopper URL - loaded from .env or default fallback
export const GRAPHHOPPER_URL = envConfig.GRAPHHOPPER_URL || 'https://graphhopper.atchisson.fr';

// Error messages — dynamic getters so they reflect the current language at call time
export const ERROR_MESSAGES = {
  get OUT_OF_BOUNDS() { return t('errors.outOfBounds'); },
  get NO_ROUTE_FOUND() { return t('errors.noRouteFound'); },
  get NETWORK_ERROR() { return t('errors.networkError'); },
  get INVALID_COORDINATES() { return t('errors.invalidCoordinates'); },
  get ROUTE_CALCULATION_IN_PROGRESS() { return t('errors.calculationInProgress'); },
  get MISSING_START_END() { return t('errors.missingStartEnd'); }
};

// Route calculation settings
export const ROUTE_CALCULATION = {
  DEBOUNCE_DELAY: 300, // ms
  MAX_TIMEOUT: 1000, // ms
  RETRY_DELAY: 100, // ms
  MAX_RETRIES: 50
};

// Default values
export const DEFAULTS = {
  PROFILE: 'bike_customizable',
  ENCODED_TYPE: 'photo_coverage',
  MAPILLARY_WEIGHT: 1.0
};

// Coordinate validation
export const COORDINATE_LIMITS = {
  MIN_LNG: -180,
  MAX_LNG: 180,
  MIN_LAT: -90,
  MAX_LAT: 90
};

// Route info formatting
export const FORMATTING = {
  DISTANCE_PRECISION: 2,
  COORDINATE_PRECISION: 5,
  COORDINATE_PRECISION_URL: 4,
  TIME_PRECISION: 0
};

// Permalink settings
export const PERMALINK = {
  STATE_CHECK_INTERVAL: 500, // ms
  UPDATE_DELAY: 100, // ms
  LAYER_ACTIVATION_DELAY: 500, // ms
  MAX_LAYER_RETRIES: 25,
  LAYER_RETRY_DELAY: 200, // ms
  MAX_ROUTE_RETRIES: 50,
  ROUTE_RETRY_DELAY: 100 // ms
};

// UI element IDs (for easier refactoring)
export const UI_IDS = {
  START_INPUT: 'start-input',
  END_INPUT: 'end-input',
  CALCULATE_BTN: 'calculate-route',
  CLEAR_BTN: 'clear-route',
  EXPORT_GPX_BTN: 'export-gpx',
  ROUTE_INFO: 'route-info',
  HEIGHTGRAPH_CONTAINER: 'heightgraph-container',
  ENCODED_SELECT: 'heightgraph-encoded-select'
};

// Layer IDs
export const LAYER_IDS = {
  ROUTE: 'route',
  ROUTE_LAYER: 'route-layer',
  ROUTE_HOVER_SEGMENT: 'route-hover-segment',
  ROUTE_HOVER_SEGMENT_LAYER: 'route-hover-segment-layer',
  HEIGHTGRAPH_HOVER_POINT: 'heightgraph-hover-point',
  HEIGHTGRAPH_HOVER_POINT_LAYER: 'heightgraph-hover-point-layer',
  HILLSHADE_LAYER: 'hillshade-layer',
  TERRAIN: 'terrain'
};


