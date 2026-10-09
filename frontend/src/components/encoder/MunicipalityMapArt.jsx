import React, { useId, useMemo } from 'react';
import { buildMunicipalityArt, normalizeMunicipalityName, SALT_MUNICIPALITY_NAMES } from '../../utils/municipalityGeo';

/* WHAT: Static na inline SVG na mapa ng Pangasinan (hindi Leaflet, walang tiles).
   WHY: Magaan at hindi interactive na decorasyon para sa clean page header; ang
        highlightName ay kayang string o array para suportahan ang admin (7 munis) sa hinaharap. */
export default function MunicipalityMapArt({ highlightName, className = '', showLabel = true }) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const { viewBox, width, height, shapes, centroids } = useMemo(() => buildMunicipalityArt(), []);

  const highlightSet = useMemo(() => {
    const list = Array.isArray(highlightName) ? highlightName : [highlightName];
    return new Set(list.filter(Boolean).map(normalizeMunicipalityName));
  }, [highlightName]);

  const baseShapes = shapes.filter((s) => !highlightSet.has(normalizeMunicipalityName(s.name)));
  const activeShapes = shapes.filter((s) => highlightSet.has(normalizeMunicipalityName(s.name)));

  return (
    <div className={`munimap ${className}`.trim()} aria-hidden="true">
      <svg className="munimap-svg" viewBox={viewBox} role="presentation" focusable="false">
        <defs>
          <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow className="munimap-glow" dx="0" dy="1" stdDeviation="2.5" />
          </filter>
          <pattern id={`${uid}-waves`} width="42" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 7 Q 10.5 1 21 7 T 42 7" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>

        {/* WHAT: Buong lalawigan (pinakamaga) + ang 7 salt-producing (neutral).
            WHY: Para kitang-kita ang hugis ng Pangasinan bago ang highlight. */}
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

        {/* WHAT: Faint wave lines sa ilalim. WHY: hint ng baybayin at salt beds. */}
        <rect
          className="munimap-waves"
          x="0"
          y={height - 52}
          width={width}
          height="52"
          fill={`url(#${uid}-waves)`}
        />

        {/* WHAT: Label pill at pulsing ring sa centroid ng highlight. */}
        {activeShapes.map((s) => {
          const c = centroids[normalizeMunicipalityName(s.name)];
          if (!c) return null;
          const width = c.name.length * 6.2 + 18;
          return (
            <g key={`flag-${s.key}`} className="munimap-flag" transform={`translate(${c.x} ${c.y})`}>
              <circle className="munimap-pulse" r="6" />
              <circle className="munimap-dot" r="3" />
              {showLabel ? (
                <g className="munimap-pill" transform="translate(0 -17)">
                  <rect x={-width / 2} y="-9" width={width} height="18" rx="9" />
                  <text x="0" y="0" textAnchor="middle" dominantBaseline="central">{c.name}</text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
