// Route State Management
// Centralized state management for routing functionality

import { defaultCarCustomModel, defaultBikeCustomModel } from './customModel.js';

export const routeState = {
  // Map instance
  mapInstance: null,
  
  // Markers
  startMarker: null,
  endMarker: null,
  waypointMarkers: [],
  
  // Points
  startPoint: null,
  endPoint: null,
  waypoints: [], // Array of {lng, lat, svgId} objects
  
  // Cached addresses for reverse geocoding
  startAddress: null,
  endAddress: null,
  waypointAddresses: [], // Array of addresses corresponding to waypoints
  
  // Selection state
  isSelectingStart: false,
  isSelectingEnd: false,
  isSelectingWaypoint: false,
  
  // Profile
  selectedProfile: 'bike_customizable',
  
  // Custom model for car_customizable and bike_customizable profiles
  customModel: null,
  
  // Unpaved roads setting — applies to every profile, but the default differs.
  // The car model already bars footways and paths, so blocking tracks costs it
  // nothing; on bike and foot, TRACK and PATH carry most of the usable network,
  // so the block stays opt-in there.
  // Always read and written through the accessor below, which targets the
  // currently selected profile.
  avoidUnpavedRoadsByProfile: {
    car_customizable: true,
    bike_customizable: false,
    foot: false
  },
  get avoidUnpavedRoads() {
    return this.avoidUnpavedRoadsByProfile[this.selectedProfile] === true;
  },
  set avoidUnpavedRoads(value) {
    this.avoidUnpavedRoadsByProfile[this.selectedProfile] = !!value;
  },
  
  // Avoid pushing setting (for bike_customizable profile only)
  // false = no additional penalty, true = strongly avoid routes that require pushing (< 6 km/h)
  // Default: false (no additional penalty)
  avoidPushing: false,

  // Photo coverage avoidance options (from custom GraphHopper fork)
  // false = no avoidance (default), true = apply custom model penalty rule
  avoidPhotoCoverage: false,
  avoidPhotoCoverageOnly360: false,
  photoCoverageStrength: 50, // 0 (weak) to 100 (strong), continuous exponential scale

  // Avoid roads already used by earlier legs of the route (custom GraphHopper
  // fork: avoid_traversed_edges). Only bites from three points up — with a
  // single leg there is nothing already travelled to avoid.
  avoidTraversedEdges: false,
  traversedEdgeStrength: 50, // 0 (weak) to 100 (strong), logarithmic scale

  // Toll avoidance. Needs the 'toll' encoded value in the router graph, which is
  // baked in at import time — tollSupported is filled from /info at startup and
  // gates the pill, so sending a model the graph cannot compile is impossible.
  avoidToll: false,
  tollSupported: false,

  // Date range filter for Panoramax coverage (YYYY-MM-DD strings or null = no filter)
  photoDateMin: null,
  photoDateMax: null,

  // Data freshness ceiling from /info endpoint (YYYY-MM-DD string or null)
  // The Panoramax parquet used for routing is updated weekly; this is the latest available date.
  panoramaxDataDate: null,
  
  // Default custom model (imported from customModel.js)
  // Returns the appropriate default model based on selected profile
  get defaultCustomModel() {
    return this.selectedProfile === 'bike_customizable' 
      ? defaultBikeCustomModel 
      : defaultCarCustomModel;
  },
  
  // Route data
  currentRouteData: null,
  currentEncodedType: 'surface',
  
  // Waypoint optimization settings
  waypointOptimizationEnabled: true, // Enable/disable waypoint optimization
  waypointOptimizationAlgorithm: 'nearest_neighbor', // 'nearest_neighbor' or 'greedy_insertion'
  waypointsManuallySorted: false, // Flag to indicate if waypoints were manually sorted (disables auto-optimization)
  
  // Initialize state
  init(map) {
    this.mapInstance = map;
  },
  
  // Reset state
  reset() {
    this.startPoint = null;
    this.endPoint = null;
    this.waypoints = [];
    this.startAddress = null;
    this.endAddress = null;
    this.waypointAddresses = [];
    this.isSelectingStart = false;
    this.isSelectingEnd = false;
    this.isSelectingWaypoint = false;
    this.currentRouteData = null;
    this.waypointsManuallySorted = false;
    
    if (this.startMarker) {
      this.startMarker.remove();
      this.startMarker = null;
    }
    if (this.endMarker) {
      this.endMarker.remove();
      this.endMarker = null;
    }
    // Remove all waypoint markers
    this.waypointMarkers.forEach(marker => {
      if (marker) marker.remove();
    });
    this.waypointMarkers = [];
  },
  
  // Get all points in order: [start, ...waypoints, end]
  getAllPoints() {
    const points = [];
    if (this.startPoint) points.push(this.startPoint);
    this.waypoints.forEach(wp => points.push(wp));
    if (this.endPoint) points.push(this.endPoint);
    return points;
  }
};

