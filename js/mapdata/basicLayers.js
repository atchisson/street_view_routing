// Basic map layers (osm, satellite, hillshade)

export function addBasicLayers(map) {
  // Raster layers
  if (!map.getLayer("osm-layer")) {
    map.addLayer({
      id: "osm-layer",
      type: "raster",
      source: "osm",
      layout: { visibility: "none" }
    });
  }

  if (!map.getLayer("satellite-layer")) {
    map.addLayer({
      id: "satellite-layer",
      type: "raster",
      source: "satellite",
      layout: { visibility: "none" }
    });
  }

  // Hillshade layer
  if (map.getSource("hillshade") && !map.getLayer("hillshade-layer")) {
    map.addLayer({
      id: "hillshade-layer",
      type: "hillshade",
      source: "hillshade",
      layout: { visibility: "none" },
      paint: {
        "hillshade-shadow-color": "#000000",
        "hillshade-highlight-color": "#ffffff",
        "hillshade-accent-color": "#000000"
      }
    });
  }

  // Panoramax coverage layers (hidden by default, toggled by #togglePanoramaxCoverage)
  // Each layer is added independently so one failure doesn't block the others.

  // Panoramax coverage layers (all hidden by default).
  // Two separate sequence layers allow independent toggling:
  //   panoramax-sequences-flat  → standard (non-360) photos (type == "flat")
  //   panoramax-sequences-360   → equirectangular/360 photos (type == "equirectangular")
  // Controlled by the "avoid photo coverage" checkboxes in the routing panel.

  const lineBase = {
    type: "line",
    source: "panoramax",
    "source-layer": "sequences",
    layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
  };

  if (map.getSource("panoramax") && !map.getLayer("panoramax-sequences-flat")) {
    try {
      map.addLayer({
        ...lineBase,
        id: "panoramax-sequences-flat",
        minzoom: 6,
        filter: ["==", ["get", "type"], "flat"],
        paint: {
          "line-color": "#f97316",
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.5, 14, 3],
          "line-opacity": 0.85
        }
      });
    } catch (e) {
      console.warn("[Panoramax] Could not add panoramax-sequences-flat:", e);
    }
  }

  if (map.getSource("panoramax") && !map.getLayer("panoramax-sequences-360")) {
    try {
      map.addLayer({
        ...lineBase,
        id: "panoramax-sequences-360",
        minzoom: 6,
        filter: ["==", ["get", "type"], "equirectangular"],
        paint: {
          "line-color": "#c2410c",
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.5, 14, 3],
          "line-opacity": 0.85
        }
      });
    } catch (e) {
      console.warn("[Panoramax] Could not add panoramax-sequences-360:", e);
    }
  }

  // Disable terrain initially
  map.setTerrain(null);
}

