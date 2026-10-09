// WHAT: Projection + name matching helpers para sa maliit na SVG na mapa ng Pangasinan.
// WHY: Reuse lang ang naka-bundle nang GeoJSON (walang bagong data source o fetch) at
//      i-render ito bilang inline SVG na equirectangular fit na may cos(lat) correction.
import allMunicipalities from '../data/pangasinan_municipalities_all.json';
import saltMunicipalities from '../data/pangasinan_municipalities.json';

// WHAT: Isang beses lang kino-compute ang projection (module-level cache).
// WHY: Static naman ang boundaries, kaya walang sayang na re-project sa bawat render.
/* WHAT: Wide na target width; tight ang viewBox sa projected bounds.
   WHY: para hindi ma-letterbox ang lalawigan at lumabas na ~1.76:1 (mukhang Pangasinan). */
const VIEW_W = 420;
const PAD = 10;

export function normalizeMunicipalityName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(city|of|municipality)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// WHAT: Normalized names ng 7 salt-producing municipalities.
// WHY: Para malaman kung alin sa buong Pangasinan ang neutral (may produksyon) vs pinakamaga.
export const SALT_MUNICIPALITY_NAMES = new Set(
  (saltMunicipalities.features || []).map((f) => normalizeMunicipalityName(f.properties?.name || '')),
);

function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

let cached = null;

export function buildMunicipalityArt() {
  if (cached) return cached;

  const features = allMunicipalities.features || [];

  // WHAT: Province bounds mula sa lahat ng coordinates.
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  features.forEach((f) => {
    ringsOf(f.geometry).forEach((poly) => poly.forEach((ring) => ring.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    })));
  });

  const midLat = (minLat + maxLat) / 2;
  const cosMid = Math.cos((midLat * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * cosMid, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = (VIEW_W - PAD * 2) / spanX;
  const VIEW_H = Math.round(spanY * scale + PAD * 2);
  const offsetX = PAD;
  const offsetY = PAD;

  const project = ([lng, lat]) => [
    Math.round((offsetX + (lng - minLng) * cosMid * scale) * 100) / 100,
    Math.round((offsetY + (maxLat - lat) * scale) * 100) / 100,
  ];

  const ringToPath = (ring) => {
    if (!ring || ring.length < 3) return '';
    let d = '';
    for (let i = 0; i < ring.length; i += 1) {
      const [x, y] = project(ring[i]);
      d += `${i === 0 ? 'M' : 'L'}${x} ${y}`;
    }
    return `${d}Z`;
  };

  const shapes = features
    .map((f, i) => {
      const name = f.properties?.shapeName || '';
      const d = ringsOf(f.geometry)
        .map((poly) => poly.map(ringToPath).join(' '))
        .join(' ');
      return { key: `${normalizeMunicipalityName(name) || 'feature'}-${i}`, name, d };
    })
    .filter((s) => s.d);

  // WHAT: Centroid (projected bbox center) per municipality para sa label at pulse ring.
  const centroids = {};
  features.forEach((f) => {
    const name = f.properties?.shapeName || '';
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    ringsOf(f.geometry).forEach((poly) => poly.forEach((ring) => ring.forEach(([lng, lat]) => {
      const [x, y] = project([lng, lat]);
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    })));
    if (Number.isFinite(bx0)) {
      centroids[normalizeMunicipalityName(name)] = { x: (bx0 + bx1) / 2, y: (by0 + by1) / 2, name };
    }
  });

  cached = { viewBox: `0 0 ${VIEW_W} ${VIEW_H}`, width: VIEW_W, height: VIEW_H, shapes, centroids };
  return cached;
}
