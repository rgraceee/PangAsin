// WHAT: Boundary retrieval utilities para sa Add Municipality modal.
// WHY: Ang boundary ay automatically na-retrieve mula sa bundled GeoJSON
//      kapag napili ang munisipyo; walang manual lat/lng entry o file upload
//      ang kinakailangan sa normal flow.
import allMunicipalitiesGeoJson from '../data/pangasinan_municipalities_all.json';

// WHAT: CRS ng bundled data ay CRS84 (WGS84, lon/lat order).
// WHY: Leaflet at ang backend ay nag-expect ng lat/lng, kailangang i-swap.
const CRS84 = 'urn:ogc:def:crs:OGC:1.3:CRS84';

// WHAT: Cache ng parsed features keyed ng normalized name.
// WHY: Hindi ulit-ulitin ang parse at search sa bawat selection change.
let featureIndex = null;

function normalizeKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(city|of|municipality)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureIndex() {
  if (featureIndex) return featureIndex;
  const index = new Map();
  (allMunicipalitiesGeoJson.features || []).forEach((feature) => {
    const name = feature.properties?.shapeName || '';
    const key = normalizeKey(name);
    if (key && feature.geometry) {
      index.set(key, {
        name,
        geometry: feature.geometry,
        properties: feature.properties,
      });
    }
  });
  featureIndex = index;
  return index;
}

// WHAT: Ray-casting point-in-polygon test para sa isang ring.
// WHY: Kailangang matiyak na ang representative point ay talagang loob ng
//      polygon, hindi blind centroid na maaaring lumabas sa boundary.
function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// WHAT: Point-in-polygon test na tumanggap ng Polygon o MultiPolygon.
// WHY: Ang bundled data ay may Polygon at MultiPolygon geometry types.
function pointInGeometry(point, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.some((ring, i) => {
      if (i === 0) return pointInRing(point, ring);
      // Holes: point inside outer ring but inside a hole = outside
      return !pointInRing(point, ring);
    });
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) => {
      if (!poly || poly.length === 0) return false;
      const inOuter = pointInRing(point, poly[0]);
      if (!inOuter) return false;
      return !poly.slice(1).some((hole) => pointInRing(point, hole));
    });
  }
  return false;
}

// WHAT: Kumuha ng representative point na guarantee nasa loob ng polygon.
// WHY: Hindi pwedeng blind centroid dahil maaari itong lumabas sa
//      boundary (e.g., C-shape or donut polygon). Una sinusubukan ang
//      centroid ng lahat ng vertices; kung labas, hinahanap ang vertex na
//      pinakapitapit sa centroid na nasa loob; kung wala, fallback sa
//      midpoint ng pinakamahaba na diagonal na nasa loob.
function getRepresentativePoint(geometry) {
  if (!geometry) return null;

  const rings = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates;

  // Collect all vertices across all outer rings (ring[0] of each polygon).
  const vertices = [];
  rings.forEach((poly) => {
    if (!poly || poly.length === 0) return;
    poly[0].forEach(([lng, lat]) => vertices.push([lng, lat]));
  });

  if (vertices.length === 0) return null;

  // Candidate 1: average of all vertices (centroid of points).
  const avgLng = vertices.reduce((s, v) => s + v[0], 0) / vertices.length;
  const avgLat = vertices.reduce((s, v) => s + v[1], 0) / vertices.length;
  const centroid = [avgLng, avgLat];

  if (pointInGeometry(centroid, geometry)) {
    return { lat: avgLat, lng: avgLng };
  }

  // Candidate 2: vertex closest to centroid that is inside the polygon.
  let best = null;
  let bestDist = Infinity;
  vertices.forEach(([lng, lat]) => {
    const d = Math.hypot(lng - avgLng, lat - avgLat);
    if (d < bestDist && pointInGeometry([lng, lat], geometry)) {
      bestDist = d;
      best = [lng, lat];
    }
  });
  if (best) {
    return { lat: best[1], lng: best[0] };
  }

  // Candidate 3: midpoint of each outer ring, pick first inside.
  rings.forEach((poly) => {
    if (best || !poly || poly.length === 0) return;
    const ring = poly[0];
    if (ring.length < 3) return;
    const midIdx = Math.floor(ring.length / 2);
    const [mlng, mlat] = ring[midIdx];
    if (pointInGeometry([mlng, mlat], geometry)) {
      best = [mlng, mlat];
    }
  });
  if (best) {
    return { lat: best[1], lng: best[0] };
  }

  // Candidate 4: bbox centroid (last resort, may be outside but better than nothing).
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  vertices.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };
}

// WHAT: Kumuha ng bounds ng geometry para sa map fitBounds.
// WHY: Kailangang i-fit ang map sa boundary ng napiling munisipyo.
function getGeometryBounds(geometry) {
  if (!geometry) return null;
  const rings = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates;

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  rings.forEach((poly) => {
    if (!poly || poly.length === 0) return;
    poly[0].forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  });

  if (minLng === Infinity) return null;
  // Leaflet fitBounds expects [[southWestLat, southWestLng], [northEastLat, northEastLng]]
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

// WHAT: Hanapin ang municipality boundary sa pamamagitan ng pangalan.
// WHY: Stable name matching (case-insensitive, normalized) para hindi magkamali
//      sa pag-resolve ng munisipyo.
export function findMunicipalityBoundary(name) {
  if (!name) return null;
  const index = ensureIndex();
  const key = normalizeKey(name);
  return index.get(key) || null;
}

// WHAT: Kumuha ng lahat ng municipalities para sa combobox options.
// WHY: Dapat ma-list lahat ng available municipalities sa selector,
//      hindi limitado sa pitong salt-producing.
export function listAllMunicipalities() {
  const index = ensureIndex();
  return Array.from(index.values()).map((entry) => ({
    name: entry.name,
    key: normalizeKey(entry.name),
  }));
}

// WHAT: Buuin ang representative coordinates mula sa boundary.
// WHY: Auto-fill lat/lng mula sa polygon, hindi manual na type ng admin.
export function boundaryToCoordinates(boundary) {
  if (!boundary || !boundary.geometry) return null;
  const point = getRepresentativePoint(boundary.geometry);
  if (!point) return null;
  const round6 = (value) => Math.round(value * 1e6) / 1e6;
  return {
    latitude: String(round6(point.lat)),
    longitude: String(round6(point.lng)),
  };
}

// WHAT: Kumuha ng bounds para sa map fitBounds.
// WHY: I-fit ang map sa boundary pagkatapos i-retrieve.
export function boundaryToBounds(boundary) {
  if (!boundary || !boundary.geometry) return null;
  return getGeometryBounds(boundary.geometry);
}
