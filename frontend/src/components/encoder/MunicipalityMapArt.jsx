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

/* WHAT: Static na inline SVG na mapa ng Pangasinan (hindi Leaflet, walang tiles).
   WHY: Magaan na decorasyon para sa clean page header. Encoder (single) ay naka-ZOOM
        (focus) sa sariling munisipyo; admin (province) ay buong lalawigan. Parehong
        pwesto pa rin sa right panel; ang viewBox/zoom lang ang pagbabago.
   WHY: default ay 'single' pa rin — ang AdminDashboard lang ang nagpasa ng explicit
        mode="province"; kung 'province' ang default ay nagbago ang /encoder at
        ProducerMasterList na walang mode mula sa pag-focus sa sariling bayan. */
export default function MunicipalityMapArt({ highlightName, mode = 'single', className = '', showLabel = true, selectedName = '' }) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  /* WHAT: buildMunicipalityArt is module-level cached and never null, but guard anyway
     WHY: if the cached projection somehow returns a partial shape, we must not crash. */
  const art = useMemo(() => buildMunicipalityArt() || { width: 0, height: 0, shapes: [], centroids: {}, bounds: {} }, []);
  const { width = 0, height = 0, shapes = [], centroids = {}, bounds = {} } = art;
  const isProvince = mode === 'province';

  /* WHAT: Selected municipality ng /admin filter ('' = Pangasinan / walang highlight).
     WHY: province mode — ang napiling bayan ay solid accent + pangalan + kuat na pulse;
          ang ibang 6 ay light green na walang pill (hindi na value labels). */
  const selectedKey = selectedName ? normalizeMunicipalityName(selectedName) : '';

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
             WHY: title child para sa hover tooltip na pangalan ng munisipyo.
             Ang napiling bayan (selectedKey) ay solid accent + glow; ang iba ay light green. */
          shapes.map((s) => {
            const norm = normalizeMunicipalityName(s.name);
            const salt = SALT_MUNICIPALITY_NAMES.has(norm);
            const selected = salt && selectedKey === norm;
            return (
              <path
                key={s.key}
                d={s.d}
                className={`munimap-shape${salt ? (selected ? ' munimap-shape--active' : ' munimap-shape--province') : ''}`}
                filter={selected ? `url(#${uid}-glow)` : undefined}
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
            const selected = selectedKey === key;
            return (
              <g key={`dot-${key}`} transform={`translate(${c.x} ${c.y})`}>
                <circle
                  className={`munimap-pulse${selected ? ' munimap-pulse--strong' : ''}`}
                  r={selected ? 8 : 6}
                  style={selected ? undefined : { animationDelay: `${i * 150}ms` }}
                />
                <circle className="munimap-dot" r={selected ? 3.5 : 3} />
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

        {/* WHAT: Pangalan pill ng napiling municipality sa province mode ('' = wala).
           WHY: naka-anchor sa centroid nito na walang overlap; nagbibigay ng konteksto
                kung aling bayan ang kasalukuyang naka-filter sa dashboard. */}
        {isProvince && selectedKey && centroids[selectedKey]
          ? (() => {
            const c = centroids[selectedKey];
            const place = computeLabelPlacement(c.x, c.y, c.name, frameBox);
            return (
              <g className="munimap-pill" transform={`translate(${place.px} ${place.py})`}>
                <rect x={-place.pillW / 2} y={-place.pillH / 2} width={place.pillW} height={place.pillH} rx="9" />
                <text x="0" y="0" textAnchor="middle" dominantBaseline="central">{c.name}</text>
              </g>
            );
          })()
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
