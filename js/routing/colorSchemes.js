// Centralized color schemes for route visualization
// Single source of truth for all color mappings

import { t } from '../i18n/i18n.js';

// Helper function to convert hex to rgba
function hexToRgba(hex, opacity = 1.0) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Surface colors (base hex values)
export const SURFACE_COLORS = {
  'asphalt': '#22c55e',      // Green
  'concrete': '#f97316',     // Orange
  'paved': '#3b82f6',       // Blue
  'unpaved': '#a855f7',     // Purple
  'gravel': '#ec4899',       // Pink
  'dirt': '#78350f',         // Brown
  'sand': '#eab308',         // Yellow
  'grass': '#16a34a',        // Dark green
  'ground': '#78350f',       // Brown
  'compacted': '#6b7280',    // Gray
  'fine_gravel': '#fb923c',  // Light orange
  'pebblestone': '#a855f7',  // Purple
  'cobblestone': '#6366f1',  // Indigo
  'wood': '#b45309',         // Dark orange
  'metal': '#475569',        // Slate
  'sett': '#6366f1',         // Indigo
  'paving_stones': '#0ea5e9' // Sky blue
};

// Road class colors (base hex values)
export const ROAD_CLASS_COLORS = {
  'motorway': '#dc2626',      // Red
  'trunk': '#ef4444',         // Light red
  'primary': '#f97316',       // Orange
  'secondary': '#eab308',     // Yellow
  'tertiary': '#22c55e',      // Green
  'unclassified': '#3b82f6',  // Blue
  'residential': '#a855f7',   // Purple
  'service': '#ec4899',       // Pink
  'track': '#78350f',         // Brown
  'path': '#6b7280',          // Gray
  'cycleway': '#0ea5e9',      // Sky blue
  'footway': '#16a34a',       // Dark green
  'steps': '#b45309',         // Dark orange
  'living_street': '#fb923c'  // Light orange
};

// Mapillary coverage colors
export const CUSTOM_PRESENT_COLORS = {
  true: '#3b82f6',   // Blue for true
  false: '#ec4899'   // Pink for false
};

// Panoramax photo coverage colors
export const PHOTO_COVERAGE_COLORS = {
  true: '#ef4444',   // Red: already covered
  false: '#22c55e'   // Green: not covered yet
};


// Default colors
export const DEFAULT_COLOR = '#9ca3af'; // Gray
export const DEFAULT_COLOR_RGBA = 'rgba(156, 163, 175, 0.3)';
export const DEFAULT_COLOR_RGBA_LIGHT = 'rgba(156, 163, 175, 0.15)';

/**
 * Get surface color (hex format)
 * @param {string|number} value - Surface value
 * @returns {string} Hex color
 */
export function getSurfaceColor(value) {
  if (!value) return DEFAULT_COLOR;
  const normalizedValue = String(value).toLowerCase();
  return SURFACE_COLORS[normalizedValue] || DEFAULT_COLOR;
}

/**
 * Get surface color (rgba format)
 * @param {string|number} value - Surface value
 * @param {number} opacity - Opacity (0.0 - 1.0)
 * @returns {string} RGBA color
 */
export function getSurfaceColorRgba(value, opacity = 0.3) {
  if (!value) return opacity === 0.15 ? DEFAULT_COLOR_RGBA_LIGHT : DEFAULT_COLOR_RGBA;
  const hexColor = getSurfaceColor(value);
  return hexToRgba(hexColor, opacity);
}

/**
 * Get road class color (hex format)
 * @param {string|number} value - Road class value
 * @returns {string} Hex color
 */
export function getRoadClassColor(value) {
  if (!value) return DEFAULT_COLOR;
  const normalizedValue = String(value).toLowerCase();
  return ROAD_CLASS_COLORS[normalizedValue] || DEFAULT_COLOR;
}

/**
 * Get road class color (rgba format)
 * @param {string|number} value - Road class value
 * @param {number} opacity - Opacity (0.0 - 1.0)
 * @returns {string} RGBA color
 */
export function getRoadClassColorRgba(value, opacity = 0.3) {
  if (!value) return opacity === 0.15 ? DEFAULT_COLOR_RGBA_LIGHT : DEFAULT_COLOR_RGBA;
  const hexColor = getRoadClassColor(value);
  return hexToRgba(hexColor, opacity);
}

/**
 * Get mapillary coverage color
 * @param {boolean|string} value - Mapillary coverage value
 * @returns {string} Hex color
 */
export function getCustomPresentColor(value) {
  const isTrue = value === true || value === 'True' || value === 'true';
  return isTrue ? CUSTOM_PRESENT_COLORS.true : CUSTOM_PRESENT_COLORS.false;
}

/**
 * Get photo coverage color (hex format)
 * @param {boolean|string} value - Photo coverage value
 * @returns {string} Hex color
 */
export function getPhotoCoverageColor(value) {
  const isTrue = value === true || value === 'True' || value === 'true';
  return isTrue ? PHOTO_COVERAGE_COLORS.true : PHOTO_COVERAGE_COLORS.false;
}

/**
 * Get photo coverage color (rgba format)
 * @param {boolean|string} value - Photo coverage value
 * @param {number} opacity - Opacity (0.0 - 1.0)
 * @returns {string} RGBA color
 */
export function getPhotoCoverageColorRgba(value, opacity = 0.3) {
  return hexToRgba(getPhotoCoverageColor(value), opacity);
}

/**
 * Get bicycle infrastructure color (hex format)
 * @param {string|number} value - Bicycle infrastructure value
 * @returns {string} Hex color
 */
/**
 * Get color for encoded value (general purpose)
 * Used in routeVisualization.js
 * @param {string} encodedType - Type of encoded value
 * @param {*} value - Value to get color for
 * @param {Array} allValues - All values for gradient calculation (optional)
 * @returns {string} Hex color
 */
export function getColorForEncodedValue(encodedType, value, allValues = []) {
  if (value === null || value === undefined) {
    return DEFAULT_COLOR;
  }
  
  if (encodedType === 'surface') {
    return getSurfaceColor(value);
  }
  
  if (encodedType === 'road_class') {
    return getRoadClassColor(value);
  }

  if (encodedType === 'photo_coverage' || encodedType === 'photo_coverage_only360') {
    return getPhotoCoverageColor(value);
  }
  
  if (encodedType === 'elevation' || encodedType === 'time' || encodedType === 'distance') {
    // Numeric data - use gradient color
    const validValues = allValues.filter(v => v !== null && v !== undefined);
    if (validValues.length === 0) return '#3b82f6';
    
    const minValue = Math.min(...validValues);
    const maxValue = Math.max(...validValues);
    const range = maxValue - minValue || 1;
    const normalized = (value - minValue) / range;
    
    if (normalized < 0.25) return '#3b82f6'; // Blue
    else if (normalized < 0.5) return '#10b981'; // Green
    else if (normalized < 0.75) return '#f59e0b'; // Orange
    else return '#ef4444'; // Red
  }
  
  // Categorical data - assign colors based on unique values
  const uniqueValues = [...new Set(allValues.filter(v => v !== null && v !== undefined && v !== ''))];
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];
  const valueIndex = uniqueValues.indexOf(value);
  return valueIndex >= 0 ? colors[valueIndex % colors.length] : DEFAULT_COLOR;
}

