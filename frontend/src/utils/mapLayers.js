// WHAT: Leaflet helpers para sa basemap at province mask.
// WHY: Nilalagay ang protected-area overlay ng buong Pangasinan sa likod ng
//      municipal boundary polygons para malinaw ang lugar ng bawat bayan.
import L from 'leaflet';

export const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function addBasemap(map) {
  L.tileLayer(OSM_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
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

export function addProvinceMask(map, rings) {
  L.polygon(rings, {
    interactive: false,
    stroke: false,
    fillColor: '#334155',
    fillOpacity: 0.75,
  }).addTo(map);
}