// Custom Model Management for car_customizable and bike_customizable profiles
// Handles custom routing models for GraphHopper API

// ============================================================================
// DEFAULT CUSTOM MODELS
// ============================================================================

/**
 * Default custom model configuration for car_customizable profile
 * 
 * ZWECK:
 * Optimiert Autofahrten basierend auf:
 * - Straßenklassen (bevorzugt Hauptstraßen)
 * - Radinfrastruktur (sperrt Radwege)
 * - Oberflächenqualität
 * - Mapillary Coverage (anpassbar über Slider)
 * 
 * PRIORITY-REGELN:
 * - Basis: 1.0 (keine Reduktion)
 * - Hauptstraßen bevorzugen (MOTORWAY, TRUNK, PRIMARY)
 * - Kleine Straßen abwerten (RESIDENTIAL, LIVING_STREET)
 * - Schlechte Oberflächen abwerten
 * - Mapillary Coverage bevorzugen (Standard 1.0, anpassbar)
 */
export const defaultCarCustomModel = {
  "distance_influence": 90,
  "priority": [
    // Basis: Keine Reduktion
    {"if": "true", "multiply_by": 1.0},
    
    // Fußwege, Wege, Treppen und Radwege sperren (Fallback für road_class)
    {"if": "road_class==FOOTWAY||road_class==PATH||road_class==STEPS||road_class==CYCLEWAY", "multiply_by": 0.0},
    
    // Hauptstraßen bevorzugen (höhere Priorität)
    {"if": "road_class==MOTORWAY", "limit_to": 1.0},
    {"if": "road_class==TRUNK", "limit_to": 0.95},
    {"if": "road_class==PRIMARY", "limit_to": 0.9},
    {"if": "road_class==SECONDARY", "limit_to": 0.85},
    
    // Kleine Straßen abwerten (weniger bevorzugt)
    {"if": "road_class==RESIDENTIAL||road_class==LIVING_STREET", "multiply_by": 0.7},
    {"if": "road_class==SERVICE", "multiply_by": 0.5},
    {"if": "road_class==TRACK", "multiply_by": 0.4}
  ],
  "speed": [
    // Basis: eingebaute Autogeschwindigkeit nutzen
    {"if": "true", "limit_to": "car_average_speed"},
    {"if": "true", "multiply_by": 0.8}, // 20% Reduktion für realistischere Geschwindigkeiten
    
    // Access-Logik: Kein Autozugang = sperren
    {"if": "car_access==false", "limit_to": 0},
    
    // Durchfahrtsbeschränkungen (motor_vehicle=destination, private, no) sperren
    // Keine road_access-Regel mehr, da this property im GraphHopper-Modell oft nicht verfügbar ist
    
    // Fußwege, Wege, Treppen und Radwege sperren
    {"if": "road_class==FOOTWAY||road_class==PATH||road_class==STEPS||road_class==CYCLEWAY", "limit_to": 0},
    
  ]
};

/**
 * Default custom model configuration for bike_customizable profile
 * 
 * ZWECK:
 * Optimiert Fahrradrouten für Touren-/Alltagsräder basierend auf:
 * - Straßenklassen (road_class)
 * - Oberflächenqualität (surface)
 * - Steigungen (average_slope)
 * - Mapillary Coverage (anpassbar über Slider)
 * 
 * WICHTIGE KONFIGURATION:
 * - bike_average_speed muss in der GraphHopper-Konfiguration (config.yml) auf 25 km/h gesetzt werden
 *   Beispiel: {"if": "true", "limit_to": 25} im bike profile
 * 
 * PRIORITY-REGELN (Reihenfolge ist wichtig!):
 * 1. Basis: 0.8 (ermöglicht Multiplikatoren > 1.0 ohne über 1.0 zu gehen)
 * 2. Access-Logik: Sperrt unzugängliche Wege
 * 3. Road Class: Abwertung von Hauptstraßen
 * 5. Oberflächen: Abwertung von schlechten Oberflächen
 * 6. Mapillary Coverage: Standard 1.0 (anpassbar über Slider)
 * 
 * SPEED-REGELN:
 * - Basis: bike_average_speed (25 km/h, in GraphHopper-Konfiguration gesetzt)
 * - Steigungen: Reduziert Geschwindigkeit (0.25x bei sehr steil, 0.90x bei leicht)
 * - Gefälle: Bleibt bei Basisgeschwindigkeit (1.0x)
 * - Oberflächen: Zusätzliche Reduktion (Sand: 0.5x, Kopfsteinpflaster: 0.7x)
 * 
 * HINWEIS:
 * - limit_to setzt nur Obergrenzen, keine Mindestgeschwindigkeiten
 * - multiply_by kann nicht über 1.0 gehen (GraphHopper-Limitierung)
 * - Reihenfolge der Regeln ist wichtig (werden sequenziell angewendet)
 */
export const defaultBikeCustomModel = {
  "distance_influence": 80,
  "priority": [
    // Basis: Start mit einem mittleren Wert
    {"if": "true", "multiply_by": 0.8},
    
    // Ungeeignete Wege für ein normales Touren-/Alltagsrad
    {"if": "mtb_rating > 2", "multiply_by": 0},
    {"if": "hike_rating > 1", "multiply_by": 0},
    
    // Access-Logik
    {"if": "!bike_access && (!backward_bike_access || roundabout)", "multiply_by": 0},
    // Against-direction penalty: adjusted dynamically by updateAvoidPushingRule()
    // Default: 0.2 (slight penalty), with "avoid pushing" enabled: 0.01 (strong penalty)
    {"else_if": "!bike_access && backward_bike_access && !roundabout", "multiply_by": 0.2},

    // Road class fallback (best quality first)
    {"if": "road_class==CYCLEWAY", "limit_to": 1.0},
    {"if": "road_class==TRACK", "limit_to": 0.9},
    {"if": "road_class==SERVICE", "limit_to": 0.8},
    {"if": "road_class==RESIDENTIAL||road_class==LIVING_STREET", "multiply_by": 0.8},
    {"if": "road_class==SECONDARY", "multiply_by": 0.7},
    {"if": "road_class==PRIMARY", "multiply_by": 0.6},
    {"if": "road_class==TRUNK||road_class==MOTORWAY", "multiply_by": 0.5},
    
    // Access-Logik bleibt
    {"if": "bike_network != OTHER", "limit_to": 0.9}
  ],
  "speed": [
    // Basis: eingebaute Fahrradgeschwindigkeit nutzen (auf 25km/h gesetzt)
    {"if": "true", "limit_to": "bike_average_speed"},
    
    // Gegen Einbahn -> nur Schrittgeschwindigkeit (Schieben)
    {"if": "!bike_access && backward_bike_access && !roundabout", "limit_to": 5},
    
    // Treppen sehr langsam
    {"if": "road_class == STEPS", "limit_to": 4},
    
    // Steigungs-basierte Geschwindigkeitsanpassungen
    {"if": "average_slope >= 15", "multiply_by": 0.25},
    {"else_if": "average_slope >= 10", "multiply_by": 0.40},
    {"else_if": "average_slope >= 8", "multiply_by": 0.55},
    {"else_if": "average_slope >= 6", "multiply_by": 0.70},
    {"else_if": "average_slope >= 4", "multiply_by": 0.80},
    {"else_if": "average_slope >= 2", "multiply_by": 0.90},
    {"else_if": "average_slope <= -12", "multiply_by": 0.90},
    {"else_if": "average_slope <= -8", "multiply_by": 1.0},
    {"else_if": "average_slope <= -4", "multiply_by": 1.0},
    {"else_if": "average_slope <= -2", "multiply_by": 1.00},
    
    // Access-Logik
    {"if": "bike_access==false", "limit_to": 0}
  ]
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a profile supports custom models
 * @param {string} profile - Profile name
 * @returns {boolean} True if profile supports custom models
 */
// Minimal foot custom model: no overrides, lets GH use its default foot behaviour.
// Photo coverage priority rules are appended dynamically when avoidance is enabled.
export const defaultFootCustomModel = {
  "distance_influence": 0,
  "priority": [],
  "speed": []
};

export function supportsCustomModel(profile) {
  return profile === 'car_customizable' || profile === 'bike_customizable' || profile === 'foot';
}

/**
 * Get the actual GraphHopper profile name
 * @param {string} profile - Profile name (car_customizable or bike_customizable)
 * @returns {string} GraphHopper profile name (car or bike)
 */
export function getGraphHopperProfile(profile) {
  if (profile === 'car_customizable') return 'car';
  if (profile === 'bike_customizable') return 'bike';
  if (profile === 'foot') return 'foot';
  return profile;
}

/**
 * Initialize custom model if needed
 * @param {Object|null} customModel - Existing custom model or null
 * @param {string} profile - Profile name
 * @returns {Object} Custom model (default or existing)
 */
export function ensureCustomModel(customModel, profile = 'car_customizable') {
  if (!customModel) {
    if (profile === 'bike_customizable') {
      return JSON.parse(JSON.stringify(defaultBikeCustomModel));
    }
    if (profile === 'foot') {
      return JSON.parse(JSON.stringify(defaultFootCustomModel));
    }
    return JSON.parse(JSON.stringify(defaultCarCustomModel));
  }
  return customModel;
}

/**
 * Check if custom model differs from default
 * @param {Object} customModel - Custom model to check
 * @param {string} profile - Profile name
 * @returns {boolean} True if model differs from default
 */
export function isDefaultCustomModel(customModel, profile = 'car_customizable') {
  if (!customModel) return false;
  const defaultModel = profile === 'bike_customizable' ? defaultBikeCustomModel : defaultCarCustomModel;
  return JSON.stringify(customModel) === JSON.stringify(defaultModel);
}

/**
 * Build POST request body with custom model
 * @param {Array<Array<number>>} points - Array of [lng, lat] coordinates
 * @param {string} profile - Profile name
 * @param {Object} customModel - Custom model configuration
 * @returns {Object} Request body for GraphHopper API
 */
export function buildPostRequestBodyWithCustomModel(points, profile, customModel) {
  const graphHopperProfile = getGraphHopperProfile(profile);
  const requestBody = {
    points: points,
    profile: graphHopperProfile,
    points_encoded: false,
    elevation: true,
    details: ['photo_coverage', 'photo_coverage_only360', 'road_class'],
    custom_model: customModel
  };
  
  // ch.disable is required for custom model routing on all profiles
  requestBody['ch.disable'] = true;
  
  return requestBody;
}

// ============================================================================
// MAPILLARY PRIORITY FUNCTIONS
// ============================================================================

/**
 * Update mapillary_coverage multiply_by value in custom model
 * @param {Object} customModel - Custom model to update
 * @param {number} multiplyBy - New multiply_by value
 * @returns {Object} Updated custom model
 */
export function updateMapillaryPriority(customModel, multiplyBy) {
  // Mapillary handling removed to avoid GraphHopper custom model errors for unavailable property.
  // This function remains for compatibility and does nothing now.
  return customModel;
}

/**
 * Get mapillary_coverage multiply_by value from custom model
 * @param {Object} customModel - Custom model to read from
 * @returns {number|null} Current multiply_by value or null if not used
 */
export function getMapillaryPriority(customModel) {
  return null;
}

// ============================================================================
// PHOTO COVERAGE RULES (Panoramax / custom GraphHopper fork)
// ============================================================================

/**
 * Convert a YYYY-MM-DD date string to integer days since 1970-01-01.
 * Used to build date-aware custom model conditions for photo_date_min/max EVs.
 */
export function dateToDaysEpoch(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(1970, 0, 1)) / 86400000);
}

/**
 * Build a photo_coverage condition string, optionally restricted to a date range.
 * minDate/maxDate are YYYY-MM-DD strings or null.
 */
function buildPhotoCoverageCondition(baseCondition, dateMin, dateMax) {
  let cond = baseCondition;
  if (dateMin) cond += ` && photo_date_max >= ${dateToDaysEpoch(dateMin)}`;
  if (dateMax) cond += ` && photo_date_min <= ${dateToDaysEpoch(dateMax)}`;
  return cond;
}

/**
 * Set or remove photo_coverage avoidance rule, with optional date range filter.
 * @param {Object} customModel
 * @param {boolean} enabled
 * @param {number} multiplier
 * @param {string|null} dateMin  YYYY-MM-DD or null
 * @param {string|null} dateMax  YYYY-MM-DD or null
 * @returns {Object}
 */
export function updatePhotoCoverageRule(customModel, enabled, multiplier = 0.1, dateMin = null, dateMax = null) {
  if (!customModel || !customModel.priority) return customModel;

  const ruleIndex = customModel.priority.findIndex(
    r => r.if && r.if.startsWith('photo_coverage') && !r.if.includes('only360')
  );

  if (enabled) {
    const condition = buildPhotoCoverageCondition('photo_coverage', dateMin, dateMax);
    const newRule = {"if": condition, "multiply_by": multiplier};
    if (ruleIndex !== -1) {
      customModel.priority[ruleIndex] = newRule;
    } else {
      customModel.priority.push(newRule);
    }
  } else {
    if (ruleIndex !== -1) {
      customModel.priority.splice(ruleIndex, 1);
    }
  }

  return customModel;
}

/**
 * Set or remove photo_coverage_only360 avoidance rule, with optional date range filter.
 * @param {Object} customModel
 * @param {boolean} enabled
 * @param {number} multiplier
 * @param {string|null} dateMin  YYYY-MM-DD or null
 * @param {string|null} dateMax  YYYY-MM-DD or null
 * @returns {Object}
 */
export function updatePhotoCoverageOnly360Rule(customModel, enabled, multiplier = 0.05, dateMin = null, dateMax = null) {
  if (!customModel || !customModel.priority) return customModel;

  const ruleIndex = customModel.priority.findIndex(r => r.if && r.if.includes('photo_coverage_only360'));

  if (enabled) {
    const condition = buildPhotoCoverageCondition('photo_coverage_only360', dateMin, dateMax);
    const newRule = {"if": condition, "multiply_by": multiplier};
    if (ruleIndex !== -1) {
      customModel.priority[ruleIndex] = newRule;
    } else {
      const photoRuleIndex = customModel.priority.findIndex(
        r => r.if && r.if.startsWith('photo_coverage') && !r.if.includes('only360')
      );
      if (photoRuleIndex !== -1) {
        customModel.priority.splice(photoRuleIndex + 1, 0, newRule);
      } else {
        customModel.priority.push(newRule);
      }
    }
  } else {
    if (ruleIndex !== -1) {
      customModel.priority.splice(ruleIndex, 1);
    }
  }

  return customModel;
}

/**
 * Get photo_coverage multiplier from custom model
 * @param {Object} customModel
 * @returns {number|null}
 */
export function getPhotoCoverageMultiplier(customModel) {
  if (!customModel || !customModel.priority) return null;
  const rule = customModel.priority.find(r => r.if && r.if === 'photo_coverage');
  if (!rule || rule.multiply_by === undefined) return null;
  const value = typeof rule.multiply_by === 'string' ? parseFloat(rule.multiply_by) : rule.multiply_by;
  return isNaN(value) ? null : value;
}

/**
 * Get photo_coverage_only360 multiplier from custom model
 * @param {Object} customModel
 * @returns {number|null}
 */
export function getPhotoCoverageOnly360Multiplier(customModel) {
  if (!customModel || !customModel.priority) return null;
  const rule = customModel.priority.find(r => r.if && r.if === 'photo_coverage_only360');
  if (!rule || rule.multiply_by === undefined) return null;
  const value = typeof rule.multiply_by === 'string' ? parseFloat(rule.multiply_by) : rule.multiply_by;
  return isNaN(value) ? null : value;
}

// ============================================================================
// UNPAVED ROADS RULE FUNCTIONS (for car_customizable profile)
// ============================================================================

/**
 * Update unpaved roads rule in custom model
 * Controls how strongly unpaved roads are avoided
 * @param {Object} customModel - Custom model to update
 * @param {boolean} avoidUnpavedRoads - True = strongly avoid (0.2-0.3), false = slightly reduce (0.7-0.8, default)
 * @returns {Object} Updated custom model
 */
export function updateUnpavedRoadsRule(customModel, avoidUnpavedRoads) {
  // Surface-based routing is not supported by this router; ignore unpaved toggles.
  // This avoids invalid GraphHopper expressions if 'surface' is unknown.
  return customModel;
}

/**
 * Get unpaved roads rule state from custom model
 * @param {Object} customModel - Custom model to read from
 * @returns {boolean} True if unpaved roads are strongly avoided, false if slightly reduced
 */
export function getUnpavedRoadsRule(customModel) {
  if (!customModel || !customModel.priority) {
    return false; // Default: slightly reduce
  }
  
  const unpavedRule = customModel.priority.find(
    r => r.if && (r.if.includes('GRAVEL') || r.if.includes('DIRT') || 
                  r.if.includes('GROUND') || r.if.includes('SAND'))
  );
  
  if (unpavedRule && unpavedRule.multiply_by !== undefined) {
    return unpavedRule.multiply_by <= 0.3;
  }
  
  return false; // Default: slightly reduce
}

// ============================================================================
// AVOID PUSHING RULE FUNCTIONS (for bike_customizable profile)
// ============================================================================

/**
 * Update avoid pushing rule in custom model.
 * Controls how strongly routes requiring pushing against bike direction are penalized.
 * Only adjusts the against-direction penalty (no bicycle_infra conditions).
 * @param {Object} customModel - Custom model to update
 * @param {boolean} avoidPushing - True = strongly penalize (0.01), false = slightly penalize (0.2, default)
 * @returns {Object} Updated custom model
 */
export function updateAvoidPushingRule(customModel, avoidPushing) {
  if (!customModel || !customModel.priority) {
    return customModel;
  }

  // Find the against-direction rule
  const againstDirectionIndex = customModel.priority.findIndex(
    r => r.if && r.if.includes('!bike_access && backward_bike_access')
  );

  if (againstDirectionIndex !== -1) {
    customModel.priority[againstDirectionIndex] = {
      "if": "!bike_access && backward_bike_access && !roundabout",
      "multiply_by": avoidPushing ? 0.01 : 0.2
    };
  }

  return customModel;
}

/**
 * Get avoid pushing rule state from custom model.
 * @param {Object} customModel - Custom model to read from
 * @returns {boolean} True if pushing is strongly avoided, false if slightly penalized
 */
export function getAvoidPushingRule(customModel) {
  if (!customModel || !customModel.priority) {
    return false;
  }

  const againstDirectionRule = customModel.priority.find(
    r => r.if && r.if.includes('!bike_access && backward_bike_access')
  );

  return !!(againstDirectionRule &&
    againstDirectionRule.multiply_by !== undefined &&
    againstDirectionRule.multiply_by <= 0.01);
}
