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

  // WHAT: Projected centroid + bbox (bounds) per municipality para sa label, dot, at focus.
  const centroids = {};
  const bounds = {};
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
      const key = normalizeMunicipalityName(name);
      centroids[key] = { x: (bx0 + bx1) / 2, y: (by0 + by1) / 2, name };
      bounds[key] = { minX: bx0, minY: by0, maxX: bx1, maxY: by1 };
    }
  });

  cached = { viewBox: `0 0 ${VIEW_W} ${VIEW_H}`, width: VIEW_W, height: VIEW_H, shapes, centroids, bounds };
  return cached;
}

// WHAT: Pantay na focus width para sa lahat ng encoder (base sa pinakamalaking salt muni).
// WHY: Parehong zoom/scale sa lahat — ang aktibong municipality lang ang naka-center.
export function uniformFocusWidth(boundsList, baseW, baseH, contextFactor = 1.3) {
  const aspect = baseW / baseH;
  let need = 0;
  boundsList.forEach((b) => {
    if (!b) return;
    const bboxW = Math.max(b.maxX - b.minX, baseW * 0.12);
    const bboxH = Math.max(b.maxY - b.minY, baseH * 0.12);
    need = Math.max(need, Math.max(bboxW, bboxH * aspect) * contextFactor);
  });
  if (!need) need = baseW * 0.6;
  return Math.min(need, baseW);
}

// WHAT: Focus box (x,y,w,h) na naka-center sa isang munisipyo gamit ang FIXED (uniform) na lapad.
// WHY: Nakikita ng encoder kung saan sila (naka-center sa kanila), pareho ang scale sa lahat.
export function focusBoxCentered(bound, sizeW, baseW, baseH) {
  if (!bound) return null;
  const aspect = baseW / baseH;
  const cx = (bound.minX + bound.maxX) / 2;
  const cy = (bound.minY + bound.maxY) / 2;
  const w = Math.min(sizeW, baseW);
  const h = w / aspect;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

// WHAT: Limitahin ang focus box gamit ang maliit na "allowance" sa labas ng province bounds.
// WHY: Ang coastal munis ay lumalabas ang frame sa dagat; kung hard-clamp (0 allowance) ay
//      naipit naman sila sa gilid ng frame. Ang maliit na allowance ay nagpapanatiling
//      halos gitna ang munisipyo habang limitado ang bakanteng dagat (~8% ng frame).
export function clampBoxToProvince(box, baseW, baseH, maxOverflowFrac = 0.08) {
  const overX = box.w * maxOverflowFrac;
  const overY = box.h * maxOverflowFrac;
  const minX = -overX;
  const maxX = Math.max(baseW - box.w + overX, minX);
  const minY = -overY;
  const maxY = Math.max(baseH - box.h + overY, minY);
  return {
    ...box,
    x: Math.min(Math.max(box.x, minX), maxX),
    y: Math.min(Math.max(box.y, minY), maxY),
  };
}

// WHAT: Lapad ng label pill base sa haba ng pangalan (tugma sa CSS na 10px/600).
export function labelPillWidth(name) {
  return String(name || '').length * 6.2 + 18;
}

// WHAT: Ilagay ang label pill sa tabi ng centroid at i-flip/clamp sa loob ng aktibong box.
// WHY: Kung malapit sa gilid ang centroid, mahuhulog sa labas ang pill; ang helper na
//      ito ang pipili ng above/below at mag-clamp pabalik sa loob para hindi maputol.
//      Box-aware ito para gumana sa focused viewBox (hindi lang naka-ugat sa 0,0).
export function computeLabelPlacement(cx, cy, name, box, opts = {}) {
  const { x: boxX = 0, y: boxY = 0, w: viewW = 0, h: viewH = 0 } = box || {};
  const pillW = labelPillWidth(name);
  const pillH = opts.pillH ?? 18;
  const pad = opts.pad ?? 3;
  const offset = opts.offset ?? 17;
  const half = pillH / 2;
  const round = (n) => Math.round(n * 100) / 100;

  const minX = boxX + pad;
  const maxX = boxX + viewW - pad;
  const minY = boxY + pad;
  const maxY = boxY + viewH - pad;

  let px = cx;
  if (pillW + pad * 2 >= viewW) {
    px = boxX + viewW / 2;
  } else {
    px = Math.min(Math.max(px, minX + pillW / 2), maxX - pillW / 2);
  }

  let placement = 'above';
  let py = cy - offset;
  if (py - half < minY) {
    const belowPy = cy + offset;
    if (belowPy + half <= maxY) {
      placement = 'below';
      py = belowPy;
    } else {
      py = Math.min(Math.max(py, minY + half), maxY - half);
    }
  } else if (py + half > maxY) {
    py = Math.min(Math.max(py, minY + half), maxY - half);
  }

  const x0 = px - pillW / 2;
  const y0 = py - half;
  const x1 = px + pillW / 2;
  const y1 = py + half;
  return {
    px: round(px),
    py: round(py),
    pillW: round(pillW),
    pillH,
    placement,
    bbox: { x0: round(x0), y0: round(y0), x1: round(x1), y1: round(y1) },
    inside: x0 >= minX - 0.01 && y0 >= minY - 0.01 && x1 <= maxX + 0.01 && y1 <= maxY + 0.01,
  };
}
