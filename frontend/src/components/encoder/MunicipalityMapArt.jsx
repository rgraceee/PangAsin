import React, { useId, useMemo } from 'react';
import {
  buildMunicipalityArt,
  clampBoxToProvince,
  computeLabelPlacement,
  focusBoxCentered,
  normalizeMunicipalityName,
  SALT_MUNICIPALITY_NAMES,
  uniformFocusWidth,
} from '../../utils/municipalityGeo';

/* WHAT: Ayos ng 7 salt-producing municipalities para sa province mode dots/legend. */
const SALT_LIST = ['Alaminos City', 'Anda', 'Bani', 'Bolinao', 'Dasol', 'Infanta', 'San Fabian'];

/* WHAT: Format MT value for compact province labels (e.g. "1.2k MT").
   WHY: reuse the same rounding as formatMT but shorten for tight SVG pills. */
function formatMTCompact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000) return `${(Math.round(n / 100) / 10).toFixed(1).replace(/\.0$/, '')}k`;
  if (abs >= 100) return `${Math.round(n / 10) / 100}`.replace(/\.0$/, '');
  return String(Math.round(n));
}

/* WHAT: Static na inline SVG na mapa ng Pangasinan (hindi Leaflet, walang tiles).
   WHY: Magaan na decorasyon para sa clean page header. Encoder (single) ay naka-ZOOM
        (focus) sa sariling munisipyo; admin (province) ay buong lalawigan. Parehong
        pwesto pa rin sa right panel; ang viewBox/zoom lang ang pagbabago.
   WHY: default ay 'single' pa rin — ang AdminDashboard lang ang nagpasa ng explicit
        mode="province"; kung 'province' ang default ay nagbago ang /encoder at
        ProducerMasterList na walang mode mula sa pag-focus sa sariling bayan. */
export default function MunicipalityMapArt({ highlightName, mode = 'single', className = '', showLabel = true, muniData = null }) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  /* WHAT: buildMunicipalityArt is module-level cached and never null, but guard anyway
     WHY: if the cached projection somehow returns a partial shape, we must not crash. */
  const art = useMemo(() => buildMunicipalityArt() || { width: 0, height: 0, shapes: [], centroids: {}, bounds: {} }, []);
  const { width = 0, height = 0, shapes = [], centroids = {}, bounds = {} } = art;
  const isProvince = mode === 'province';

  /* WHAT: Map of normalized municipality name -> production value for province labels.
     WHY: only render a value label when production is already loaded (muniData). */
  const prodByNorm = useMemo(() => {
    const m = {};
    if (Array.isArray(muniData)) {
      muniData.forEach((d) => {
        if (!d || !d.name) return;
        m[normalizeMunicipalityName(d.name)] = d.volumeMT;
      });
    }
    return m;
  }, [muniData]);

  /* WHAT: Collision-aware label placement for province mode.
     WHY: hide labels that overlap; show full name in a title tooltip.
     Guarded: only runs when the projected geometry exists (width/height > 0). */
  const labelPlacements = useMemo(() => {
    if (!isProvince || !width || !height) return [];
    const placed = [];
    const frameBox = { x: 0, y: 0, w: width, h: height };
    const pad = 4;
    const sorted = SALT_LIST.map((n) => normalizeMunicipalityName(n))
      .filter((k) => centroids[k])
      .sort((a, b) => (centroids[a]?.x ?? 0) - (centroids[b]?.x ?? 0));
    for (const key of sorted) {
      const c = centroids[key];
      if (!c) continue;
      const name = c.name;
      const pillW = name.length * 6.2 + 18;
      const pillH = 18;
      let best = null;
      for (const side of ['above', 'below', 'left', 'right']) {
        const px = side === 'left' ? c.x - pillW / 2 - 6 : side === 'right' ? c.x + pillW / 2 + 6 : c.x;
        const py = side === 'above' ? c.y - 16 : side === 'below' ? c.y + 16 : c.y;
        const x0 = px - pillW / 2;
        const y0 = py - pillH / 2;
        const x1 = px + pillW / 2;
        const y1 = py + pillH / 2;
        if (x0 < pad || y0 < pad || x1 > width - pad || y1 > height - pad) continue;
        const overlap = placed.some((p) => !(x1 <= p.x0 || x0 >= p.x1 || y1 <= p.y0 || y0 >= p.y1));
        if (overlap) continue;
        best = { px, py, pillW, pillH, x0, y0, x1, y1, side };
        break;
      }
      if (best) {
        best.name = name;
        best.key = key;
        best.value = prodByNorm[key];
        placed.push(best);
      }
    }
    return placed;
  }, [isProvince, centroids, width, height, prodByNorm]);

  const highlightSet = useMemo(() => {
    if (isProvince) return SALT_MUNICIPALITY_NAMES;
    const list = Array.isArray(highlightName) ? highlightName : [highlightName];
    return new Set(list.filter(Boolean).map(normalizeMunicipalityName));
  }, [highlightName, isProvince]);

  /* WHAT: Guard the shape filters — shapes is always an array from buildMunicipalityArt,
     but we never trust it blindly. */
  const baseShapes = Array.isArray(shapes)
    ? shapes.filter((s) => s && !highlightSet.has(normalizeMunicipalityName(s.name)))
    : [];
  const activeShapes = Array.isArray(shapes)
    ? shapes.filter((s) => s && highlightSet.has(normalizeMunicipalityName(s.name)))
    : [];

  /* WHAT: Iisang focus width (scale) para sa lahat ng encoder. WHY: pantay ang zoom. */
  const focusWidth = useMemo(
    () => uniformFocusWidth(SALT_LIST.map((n) => bounds[normalizeMunicipalityName(n)]), width, height),
    [bounds, width, height],
  );

  /* WHAT: Focus box (zoom) na naka-center sa encoder municipality, naka-lock sa loob ng lalawigan.
     WHY: Nakikita ng encoder kung saan sila nang walang bakanteng dagat sa gilid (coastal munis).
          Buong lalawigan pa rin sa province mode. Ang pwesto sa panel hindi nagbabago. */
  const frameBox = useMemo(() => {
    if (!isProvince && highlightSet.size === 1) {
      const box = focusBoxCentered(bounds[[...highlightSet][0]], focusWidth, width, height);
      if (box) return clampBoxToProvince(box, width, height);
    }
    return { x: 0, y: 0, w: width, h: height };
  }, [isProvince, highlightSet, bounds, focusWidth, width, height]);

  const activeViewBox = `${frameBox.x.toFixed(1)} ${frameBox.y.toFixed(1)} ${frameBox.w.toFixed(1)} ${frameBox.h.toFixed(1)}`;

  /* WHAT: Fixed na ayos ng 7 salt municipality para sa staggered pulse. */
  const saltOrder = useMemo(() => SALT_LIST.map((n) => normalizeMunicipalityName(n)), []);

  /* WHAT: Never render the SVG if the projected geometry is missing — fallback to a
     plain div so a projection error can never white-screen the page. */
  if (!width || !height) {
    return (
      <div className={`munimap${isProvince ? ' munimap--province' : ''}${className ? ` ${className}` : ''}`}>
        <div className="munimap-empty" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={`munimap${isProvince ? ' munimap--province' : ''}${className ? ` ${className}` : ''}`}>
      <svg
        className="munimap-svg"
        viewBox={activeViewBox}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        role="presentation"
        focusable="false"
      >
        <defs>
          <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow className="munimap-glow" dx="0" dy="1" stdDeviation="2.5" />
          </filter>
          <pattern id={`${uid}-waves`} width="42" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 7 Q 10.5 1 21 7 T 42 7" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>

        {isProvince ? (
          /* WHAT: Buong lalawigan; ang 7 salt ay accent (mas maliwanag) para mag-mukhang set.
             WHY: title child para sa hover tooltip na pangalan ng munisipyo. */
          shapes.map((s) => {
            const salt = SALT_MUNICIPALITY_NAMES.has(normalizeMunicipalityName(s.name));
            return (
              <path
                key={s.key}
                d={s.d}
                className={`munimap-shape${salt ? ' munimap-shape--province' : ''}`}
              >
                <title>{s.name}</title>
              </path>
            );
          })
        ) : (
          <>
            {/* WHAT: Buong lalawigan (pinakamaga) + ang 7 salt-producing (neutral). */}
            {baseShapes.map((s) => {
              const salt = SALT_MUNICIPALITY_NAMES.has(normalizeMunicipalityName(s.name));
              return (
                <path
                  key={s.key}
                  d={s.d}
                  className={`munimap-shape${salt ? ' munimap-shape--salt' : ''}`}
                />
              );
            })}
            {/* WHAT: Highlight ng encoder municipality (accent fill + glow). */}
            {activeShapes.map((s) => (
              <path
                key={s.key}
                d={s.d}
                className="munimap-shape munimap-shape--active"
                filter={`url(#${uid}-glow)`}
              />
            ))}
          </>
        )}

        {/* WHAT: Faint wave lines sa ilalim. WHY: hint ng baybayin at salt beds. */}
        <rect
          className="munimap-waves"
          x="0"
          y={height - 52}
          width={width}
          height="52"
          fill={`url(#${uid}-waves)`}
        />

        {isProvince
          ? saltOrder.map((key, i) => {
            const c = centroids[key];
            if (!c) return null;
            return (
              <g key={`dot-${key}`} transform={`translate(${c.x} ${c.y})`}>
                <circle className="munimap-pulse" r="6" style={{ animationDelay: `${i * 150}ms` }} />
                <circle className="munimap-dot" r="3" />
              </g>
            );
          })
          : activeShapes.map((s) => {
            const c = centroids[normalizeMunicipalityName(s.name)];
            if (!c) return null;
            const place = computeLabelPlacement(c.x, c.y, c.name, frameBox);
            return (
              <g key={`flag-${s.key}`}>
                <g transform={`translate(${c.x} ${c.y})`}>
                  <circle className="munimap-pulse" r="6" />
                  <circle className="munimap-dot" r="3" />
                </g>
                {showLabel ? (
                  <g className="munimap-pill" transform={`translate(${place.px} ${place.py})`}>
                    <rect x={-place.pillW / 2} y={-place.pillH / 2} width={place.pillW} height={place.pillH} rx="9" />
                    <text x="0" y="0" textAnchor="middle" dominantBaseline="central">{c.name}</text>
                  </g>
                ) : null}
              </g>
            );
          })}

        {/* WHAT: Province-mode value labels (e.g. "Bolinao 1.2k MT") with collision avoidance.
           WHY: only show when production is already loaded; overlapping labels are hidden;
           full name is exposed via <title> tooltip. */}
        {isProvince
          ? labelPlacements.map((p) => {
            const label = p.value != null ? `${p.name} ${formatMTCompact(p.value)} MT` : p.name;
            return (
              <g key={`lbl-${p.key}`} className="munimap-valuelabel">
                <title>{p.name}</title>
                <rect
                  x={p.px - p.pillW / 2}
                  y={p.py - p.pillH / 2}
                  width={p.pillW}
                  height={p.pillH}
                  rx="9"
                />
                <text x={p.px} y={p.py} textAnchor="middle" dominantBaseline="central">{label}</text>
              </g>
            );
          })
          : null}
      </svg>

      {isProvince ? (
        /* WHAT: Compact na legend. WHY: ipinapaliwanag ang kulay ng mga munisipyo. */
        <div className="munimap-legend">
          <span className="munimap-legend__item">
            <span className="munimap-legend__dot munimap-legend__dot--salt" aria-hidden="true" />
            Salt-producing municipality
          </span>
          <span className="munimap-legend__item">
            <span className="munimap-legend__dot munimap-legend__dot--other" aria-hidden="true" />
            Other municipalities
          </span>
        </div>
      ) : null}
    </div>
  );
}
