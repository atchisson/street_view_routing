// Map data sources configuration

import { envConfig } from '../config/envConfig.js';

export function addBasicSources(map) {
  // Raster: OSM Standard
  if (!map.getSource("osm")) {
    map.addSource("osm", {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
    });
  }

  // Raster: Satellite ESRI
  if (!map.getSource("satellite")) {
    map.addSource("satellite", {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256,
      attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
    });
  }

  // Raster: Tracestrack Topo (requires API key from https://console.tracestrack.com)
  const tracestrackKey = envConfig.TRACESTRACK_API_KEY;
  if (tracestrackKey && !map.getSource("topo")) {
    map.addSource("topo", {
      type: "raster",
      tiles: [
        `https://tile.tracestrack.com/topo__/{z}/{x}/{y}.png?key=${tracestrackKey}`
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>, © <a href="https://www.tracestrack.com/" target="_blank">Tracestrack</a>'
    });
  }

  // Raster-DEM: Terrain (Mapterhorn)
  if (!map.getSource("terrain")) {
    map.addSource("terrain", {
      type: "raster-dem",
      url: "https://tiles.mapterhorn.com/tilejson.json",
      tileSize: 512,
      encoding: "terrarium",
      attribution: "© Mapterhorn - https://mapterhorn.com"
    });
  }
  
  // Raster-DEM: Hillshade (Mapterhorn)
  if (!map.getSource("hillshade")) {
    map.addSource("hillshade", {
      type: "raster-dem",
      url: "https://tiles.mapterhorn.com/tilejson.json",
      tileSize: 512,
      encoding: "terrarium",
      attribution: "© Mapterhorn - https://mapterhorn.com"
    });
  }

  // Raster overlay: Waymarked Trails (hiking routes)
  if (!map.getSource("waymarked-hiking")) {
    map.addSource("waymarked-hiking", {
      type: "raster",
      tiles: [
        "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: '© <a href="https://waymarkedtrails.org" target="_blank">Waymarked Trails</a> (CC-BY-SA)'
    });
  }

  // Raster overlay: Waymarked Trails (cycling routes)
  if (!map.getSource("waymarked-cycling")) {
    map.addSource("waymarked-cycling", {
      type: "raster",
      tiles: [
        "https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: '© <a href="https://waymarkedtrails.org" target="_blank">Waymarked Trails</a> (CC-BY-SA)'
    });
  }

  // Bike lanes source
  if (!map.getSource("bike-lanes")) {
    map.addSource("bike-lanes", {
      type: "vector",
      tiles: [
        "https://tiles.tilda-geo.de/atlas_generalized_bikelanes/{z}/{x}/{y}"
      ],
      minzoom: 9,
      maxzoom: 22
    });
  }

  // Panoramax photo coverage vector tiles (official API)
  if (!map.getSource("panoramax")) {
    map.addSource("panoramax", {
      type: "vector",
      tiles: ["https://api.panoramax.xyz/api/map/{z}/{x}/{y}.mvt"],
      minzoom: 0,
      maxzoom: 15,
      attribution: '© <a href="https://panoramax.xyz" target="_blank">Panoramax</a>'
    });
  }

  // Mapillary missing streets sources (3 sources combined)
  // Source 1: Roads
  if (!map.getSource("mapillary-roads")) {
    map.addSource("mapillary-roads", {
      type: "vector",
      tiles: [
        "https://tiles.tilda-geo.de/atlas_generalized_roads/{z}/{x}/{y}"
      ],
      minzoom: 9,
      maxzoom: 22
    });
  }
  
  // Source 2: Bike lanes (reused from bike-lanes, but with different styling)
  // Note: bike-lanes source is already added above
  
  // Source 3: Road path classes
  if (!map.getSource("mapillary-roadspathclasses")) {
    map.addSource("mapillary-roadspathclasses", {
      type: "vector",
      tiles: [
        "https://tiles.tilda-geo.de/atlas_generalized_roadspathclasses/{z}/{x}/{y}"
      ],
      minzoom: 11,
      maxzoom: 22
    });
  }
}


