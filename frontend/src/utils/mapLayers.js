// WHAT: Leaflet helpers para sa basemap at province mask.
// WHY: Nilalagay ang protected-area overlay ng buong Pangasinan sa likod ng
//      municipal boundary polygons para malinaw ang lugar ng bawat bayan.
import L from 'leaflet';

export const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// WHAT: Default tile basemap para sa lahat ng mapa (admin at public).
// WHY: Tugma sa admin map — OSM, walang API key, walang watermark.
export function addBasemap(map) {
  L.tileLayer(OSM_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  }).addTo(map);
}

export const ESRI_LIGHT_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';

export const ESRI_LIGHT_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Garmin, FAO, NOAA, USGS';

// WHAT: Mapagkakatiwalaang light basemap para sa admin map.
// WHY: Positron ng CARTO ay nangangailangan na ng API key (kunwaring may
//      "API key required" na watermark per tile kung wala), kaya ang Esri
//      World Light Gray ang gamit — magaan ang tone, libre, walang key.
export function addLightBasemap(map) {
  const layer = L.tileLayer(ESRI_LIGHT_URL, {
    attribution: ESRI_LIGHT_ATTRIBUTION,
    maxZoom: 16,
  }).addTo(map);
  // WHAT: Ibalik ang layer para makapag-listen ang picker sa tile errors.
  // WHY: Kapag offline, may graceful notice kaysa blangkong gray na mapa.
  return layer;
}

export function buildProvinceMaskRings(geoJsons, bounds) {
  const outer = bounds.pad(2.0);
  const outerRing = [
    [outer.getSouth(), outer.getWest()],
    [outer.getNorth(), outer.getWest()],
    [outer.getNorth(), outer.getEast()],
    [outer.getSouth(), outer.getEast()],
    [outer.getSouth(), outer.getWest()],
  ];
  const rings = [outerRing];

  const pushRings = (geoJson) => {
    (geoJson.features || []).forEach((feature) => {
      const g = feature.geometry;
      if (!g) return;
      if (g.type === 'Polygon') {
        const ring = (g.coordinates[0] || []).map(([lng, lat]) => [lat, lng]);
        if (ring.length >= 3) rings.push(ring);
      } else if (g.type === 'MultiPolygon') {
        (g.coordinates || []).forEach((poly) => {
          const ring = (poly[0] || []).map(([lng, lat]) => [lat, lng]);
          if (ring.length >= 3) rings.push(ring);
        });
      }
    });
  };

  (Array.isArray(geoJsons) ? geoJsons : [geoJsons]).forEach(pushRings);

  return rings;
}

// WHAT: Mask sa labas ng lalawigan.
// WHY: default = white fill para sa labas ng lalawigan (magkatulad sa page
//      background); ang admin at public map ay nagpapasa ng sariling style.
export function addProvinceMask(map, rings, style = {}) {
  L.polygon(rings, {
    interactive: false,
    stroke: false,
    fillColor: '#ffffff',
    fillOpacity: 1,
    ...style,
  }).addTo(map);
}


// WHAT: Kategorikal 3-tier (Low/Medium/High) choropleth scale.
// WHY: Discrete teal tiers para sa production map (admin at public).
export const TIER_COLORS = {
  low: '#5eead4',
  medium: '#14b8a6',
  high: '#0f766e',
};

export const NON_PRODUCING_FILL = '#e5e7eb';
export const NON_PRODUCING_BORDER = '#cbd5e1';

// WHAT: Kinakalkula ang thresholds (quantile) para sa producing municipalities
//       na nahahati ~2/3/2 (Low/Medium/High).
// WHY: Dynamic thresholds, hindi hardcoded, para sumunod sa data.
export function computeTierThresholds(values) {
  const sorted = [...values].filter((v) => v != null).sort((a, b) => a - b);
  if (sorted.length === 0) return [0, 0];
  const n = sorted.length;
  const lowCount = Math.floor(n / 3) || 1;
  const highCount = Math.floor(n / 3) || 1;
  const lowIdx = Math.max(0, lowCount - 1);
  const highIdx = Math.max(lowIdx, n - highCount - 1);
  return [sorted[lowIdx], sorted[highIdx]];
}

// WHAT: Ibinabalik ang tier name ('low'|'medium'|'high') base sa thresholds.
// WHY: Shared helper para magamit ng admin at public maps.
export function getProductionTier(value, thresholds) {
  if (value == null) return null;
  const [low, high] = thresholds || [0, 0];
  if (value <= low) return 'low';
  if (value > high) return 'high';
  return 'medium';
}
