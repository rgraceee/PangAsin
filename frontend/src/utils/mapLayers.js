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
  L.tileLayer(ESRI_LIGHT_URL, {
    attribution: ESRI_LIGHT_ATTRIBUTION,
    maxZoom: 16,
  }).addTo(map);
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

// WHAT: Gray na mask sa labas ng lalawigan (parehas sa admin map).
export function addProvinceMask(map, rings) {
  L.polygon(rings, {
    interactive: false,
    stroke: false,
    fillColor: '#94A3B8',
    fillOpacity: 0.35,
  }).addTo(map);
}
