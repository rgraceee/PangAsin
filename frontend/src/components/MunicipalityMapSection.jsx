import React, { useEffect, useMemo, useRef } from 'react';
import { Card } from 'react-bootstrap';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import geojson from '../data/pangasinan_municipalities.json';
import geojsonAll from '../data/pangasinan_municipalities_all.json';
import { getMunicipalityProduction, getDemographicsByMunicipality } from '../services/dataService';
import { greenScale, GREEN_LIGHT, GREEN_DARK, BRAND } from '../theme/colors';
import { buildMapDetailCard, clampMapDetailTooltip, protectMapDetailCard } from '../utils/mapDetailCard';
import { addLightBasemap, buildProvinceMaskRings, addProvinceMask, getProductionTier, computeTierThresholds, TIER_COLORS, NON_PRODUCING_FILL, NON_PRODUCING_BORDER } from '../utils/mapLayers';

// WHAT: Leaflet map na kumukulay sa bawat bayan base sa produksyon.
// WHY: Ang normName() ay nagba-normalize ng pangalan para kahit magkaiba ang
//      lakbay ng pangalan (e.g. "City of Alaminos" vs "Alaminos City") ay
//      mag-match pa rin sa municipalities data.
const normName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(city|of|municipality)\b/g, ' ').replace(/\s+/g, ' ').trim();

const prettyName = (raw) => raw.replace(/^City of (.+)$/, '$1 City');

export default function MunicipalityMapSection() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geoJsonLayerRef = useRef(null);
  const detailOpenRef = useRef(false);

  const sorted = useMemo(() => getMunicipalityProduction(), []);
  const values = sorted.map((m) => m.productionMT);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  // WHAT: Midpoint para sa legend ticks (min / mid / max).
  // WHY: mas madaling basahin ang sequential color scale kung may gitnang tick.
  const mid = Math.round((min + max) / 2);
const tierThresholds = computeTierThresholds(values);
const sortedVals = [...values].filter((v) => v != null).sort((a, b) => a - b);
const lowMax = sortedVals[Math.max(0, Math.floor(sortedVals.length / 3) - 1)] ?? tierThresholds[0];
const mediumMin = sortedVals[Math.floor(sortedVals.length / 3)] ?? tierThresholds[0];
const mediumMax = sortedVals[Math.max(0, sortedVals.length - Math.floor(sortedVals.length / 3) - 1)] ?? tierThresholds[1];
const highMin = sortedVals[Math.max(0, sortedVals.length - Math.floor(sortedVals.length / 3))] ?? tierThresholds[1];

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const mapSorted = getMunicipalityProduction();
    const byName = Object.fromEntries(mapSorted.map((m) => [normName(m.name), m]));
    const tierFor = (value) => getProductionTier(value, tierThresholds);
    const producingNames = new Set(mapSorted.map((m) => normName(m.name)));

    const allFeatures = [...geojsonAll.features, ...geojson.features];
    const provinceBounds = L.geoJSON(allFeatures).getBounds();

    const map = L.map(mapRef.current, {
        minZoom: 7,
        maxZoom: 15,
        maxBoundsViscosity: 1.0,
        /* WHAT: Zoom +/- (top-left) at draggable ang mapa — pareho sa admin map.
           WHY: parehong itsura at parehong gamit ng dalawang mapa; scroll-wheel
                ay naka-off para hindi mahuli ang page scroll sa ibabaw ng mapa. */
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        touchZoom: false,
      }).setView(provinceBounds.getCenter(), 8);
    mapInstanceRef.current = map;

    // WHAT: Parehas sa admin map — OSM basemap + default province mask.
    // WHY: para mag-identikal ang public at admin na hitsura (walang API key/watermark).
    addLightBasemap(map);
    addProvinceMask(map, buildProvinceMaskRings([geojsonAll, geojson], provinceBounds), {
      fillColor: '#ffffff',
      fillOpacity: 1,
    });

    const demographics = getDemographicsByMunicipality();

    const detailAnchor = L.marker([0, 0], {
      icon: L.divIcon({ className: 'detail-anchor', html: '', iconSize: [0, 0] }),
      interactive: false,
    }).addTo(map);
    detailAnchor.bindTooltip('', {
      direction: 'right',
      sticky: false,
      interactive: true,
      className: 'admin-map-detail',
      opacity: 1,
      offset: [14, 30],
    });
    /* WHAT: Parehong proteksyon ng card sa admin map (shared helper).
       WHY: kapag interactive na ang mapa, kapag umalis ang mouse sa card
            (halimbawa papunta sa +/- zoom button) nagsasa-fire ang DOM
            'mouseout' -> Leaflet -> anchor marker -> closeTooltip -> nawawala
            ang card. Itinatago natin ang event sa loob ng card sa mapa. */
    protectMapDetailCard(detailAnchor, { onClose: () => { detailOpenRef.current = false; } });
    map.on('click', (e) => {
      const target = e.originalEvent && e.originalEvent.target;
      if (target && target.classList && target.classList.contains('leaflet-interactive')) return;
      detailOpenRef.current = false;
      if (detailAnchor.isTooltipOpen()) detailAnchor.closeTooltip();
    });
    map.on('moveend zoomend', () => {
      if (detailAnchor.isTooltipOpen()) {
        window.requestAnimationFrame(() => clampMapDetailTooltip(map, detailAnchor, mapRef.current));
      }
    });

    const contextFeatures = geojsonAll.features.filter(
      (f) => !producingNames.has(normName(f.properties.shapeName || f.properties.name || ''))
    );

    L.geoJSON(contextFeatures, {
      style: {
        fillColor: NON_PRODUCING_FILL,
        fillOpacity: 0.6,
        weight: 1.2,
        opacity: 0.85,
        color: NON_PRODUCING_BORDER,
      },
      onEachFeature: (feature, layer) => {
        const label = prettyName(feature.properties.shapeName || feature.properties.name || '');
        layer.bindTooltip(
          `<div style="min-width:170px"><strong>${label}</strong><br/><span style="font-size:0.85rem;color:#6B7280">No production data recorded yet</span></div>`,
          { sticky: true, direction: 'right', offset: [12, 0] }
        );
      },
    }).addTo(map);

    geoJsonLayerRef.current = L.geoJSON(geojson, {
      style: (feature) => {
        const m = byName[normName(feature.properties.name)];
        return {
          fillColor: m ? greenScale(m.productionMT, min, max) : NON_PRODUCING_FILL,
          weight: 1.5,
          opacity: 0.9,
          color: '#ffffff',
          fillOpacity: m ? 0.9 : 0.6,
        };
      },
      onEachFeature: (feature, layer) => {
        const m = byName[normName(feature.properties.name)];
        /* WHAT: Isang bind lang ng hover tooltip (pareho sa admin map).
           WHY: kung paulit-ulit ang bind sa bawat hover, nagre-register ito ng
                sariling Leaflet click handler (_openTooltip) NA UNG sa aming
                click handler — kaya binubuksan nito ulit ang hover tooltip
                pagkatapos nito, na nakasapat sa detail card. Isang bind lang:
                una ang Leaflet, saka kami — kaya kami ang nagsasara nito. */
        if (m) {
          const trendSymbol = m.productionChangePercent >= 0 ? '↑' : '↓';
          const trendClass = m.productionChangePercent >= 0 ? 'text-success' : 'text-danger';
          const changeText = m.productionChangePercent != null ? `${trendSymbol} ${Math.abs(m.productionChangePercent)}%` : '—';
          const methodLabel = m.dominantMethod
            ? `${m.dominantMethod.charAt(0).toUpperCase()}${m.dominantMethod.slice(1)}`
            : 'Not included in source data';
          const tooltipContent = `
            <div style="min-width:160px">
              <strong>${m.name}</strong><br/>
              <span style="font-size:0.85rem">Production: ${m.productionMT.toLocaleString()} Metric Tons (MT)</span><br/>
              <span style="font-size:0.85rem">Tier: ${m ? (tierFor(m.productionMT).charAt(0).toUpperCase() + tierFor(m.productionMT).slice(1)) : ''}</span><br/>
              <span class="${trendClass}" style="font-size:0.85rem">${changeText}</span><br/>
              <span style="font-size:0.85rem;color:#495057">Method: ${methodLabel}</span>
            </div>
          `;
          layer.bindTooltip(tooltipContent, { sticky: true, direction: 'right', offset: [12, 0], className: 'muni-hover-tooltip' });
        }
        layer.on({
          mouseover: (e) => {
            const target = e.target;
            if (!m || detailOpenRef.current) return;
            target.setStyle({ fillOpacity: 0.9, weight: 2.5 });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              target.bringToFront();
            }
            target.openTooltip(e.latlng);
          },
          mouseout: (e) => {
            geoJsonLayerRef.current.resetStyle(e.target);
            e.target.closeTooltip();
          },
          click: (e) => {
            L.DomEvent.stopPropagation(e.originalEvent);
            e.target.closeTooltip();
            if (!m) return;
            detailOpenRef.current = true;
            const gender = (demographics[m.id] && demographics[m.id].genderDistribution) || {};
            const genderTotal = ((gender.male || 0) + (gender.female || 0));
            const genderText = genderTotal > 0
              ? `${(gender.male || 0).toLocaleString()} / ${(gender.female || 0).toLocaleString()}`
              : '—';
            const changePct = m.productionChangePercent;
            const trendSymbol = changePct != null ? (changePct >= 0 ? '↑' : '↓') : '';
            const changeText = changePct != null ? `${trendSymbol} ${Math.abs(changePct)}%` : '—';
            const methodLabel = m.dominantMethod
              ? `${m.dominantMethod.charAt(0).toUpperCase()}${m.dominantMethod.slice(1)}`
              : 'Not included in source data';
            const bedEstimateLabel = m.saltBeds
              ? `${m.saltBeds.toLocaleString()}${m.saltBedsYear ? ` (${m.saltBedsYear} dataset)` : ''}`
              : '—';
            const html = buildMapDetailCard({
              name: m.name,
              rows: [
                ['Current Production', `${m.productionMT.toLocaleString()} Metric Tons (MT)`],
                ['Change', changeText],
                ['Production Area', m.productionAreaSqm == null ? 'Not included in source data' : `${m.productionAreaSqm.toLocaleString()} m²`],
                ['Salt Beds', bedEstimateLabel],
                ['Dominant Method', methodLabel],
                ['Male / Female (approved submissions)', genderText],
              ],
            });
            const b = layer.getBounds();
            const anchor = L.latLng(
              b.getCenter().lat,
              b.getCenter().lng + (b.getEast() - b.getCenter().lng) * 0.6
            );
            detailAnchor.setLatLng(anchor);
            detailAnchor.setTooltipContent(html);
            detailAnchor.openTooltip();
            window.requestAnimationFrame(() => clampMapDetailTooltip(map, detailAnchor, mapRef.current));
          },
        });

        if (m) {
          L.marker(layer.getBounds().getCenter(), {
            icon: L.divIcon({ className: 'muni-name-label', html: prettyName(m.name), iconSize: null }),
            interactive: false,
          }).addTo(map);
        }
      },
    }).addTo(map);

    if (geoJsonLayerRef.current) {
      const container = mapRef.current;
      let resizeObserver = null;
      let fitted = false;
      const fitToProvince = () => {
        if (fitted) return;
        fitted = true;
        map.invalidateSize();
        map.setMaxBounds(provinceBounds.pad(0.06));
        map.fitBounds(provinceBounds, { padding: [10, 10] });
        if (resizeObserver) resizeObserver.disconnect();
      };
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (container && container.getBoundingClientRect().height > 0) fitToProvince();
        });
        resizeObserver.observe(container);
      } else {
        window.requestAnimationFrame(fitToProvince);
      }
    }
  }, []);

  return (
    <section className="public-section">
      {/* WHAT: fc-card + fc-card-head para pareho ang card shell ng charts sa
         itaas (14px radius, icon chip, title + subtitle).
         WHY: isang visual language ang buong public page. */}
      <Card className="encoder-card fc-card">
        <Card.Header className="fc-card-head">
          <div className="fc-card-head-left">
            <span className="fc-card-head-icon">
              <MapPin size={16} strokeWidth={1.75} />
            </span>
            <div className="fc-card-head-text">
              <h5 className="fc-card-title">Salt Production Across Pangasinan</h5>
              <p className="fc-card-sub">Workbook-derived production data by municipality</p>
            </div>
          </div>
        </Card.Header>
        <Card.Body className="fc-card-body">
          {/* WHAT: Region na may descriptive label para sa screen readers.
             WHY: ang Leaflet map ay biswal; ang label + sr-only summary ang nagbibigay ng teksto. */}
          <div
            className="map-wrapper"
            role="region"
            aria-label="Choropleth map of Pangasinan showing source-labeled salt production per municipality. Hover or select a shaded municipality to view its data."
          >
            <div className="map-container" ref={mapRef}></div>
          </div>
          <p className="public-sr-only">
            Map summary: the producing municipalities shown are {sorted.map((m) => m.name).join(', ')}, with recorded
            production ranging from {min.toLocaleString()} to {max.toLocaleString()} Metric Tons (MT).
          </p>
<div className="map-legend" aria-label="Map legend">
  <div className="map-gradient-caption">
    <span className="map-legend-label">Lower production</span>
    <span className="map-legend-label">Higher production</span>
  </div>
  <div
    className="map-gradient-legend"
    style={{ backgroundImage: `linear-gradient(90deg, ${GREEN_LIGHT} 0%, ${GREEN_DARK} 100%)` }}
  ></div>
  <div className="map-gradient-ticks" aria-hidden="true">
    <span>{min.toLocaleString()}</span>
    <span>{mid.toLocaleString()}</span>
    <span>{max.toLocaleString()}</span>
  </div>
  <p className="map-range-note">
    {min.toLocaleString()} Metric Tons (MT) → {max.toLocaleString()} Metric Tons (MT) across the {sorted.length} producing municipalities
  </p>
</div>
          <p className="text-muted small mb-0 mt-2">
            Select a municipality on the map to view its detailed summary. Shaded gray municipalities have no
            source data. For salt beds, Alaminos City's count is observed; other values are workbook-derived, and San Fabian's figure is a cooked-salt bed-equivalent, not a physical count. Producer demographics shown in details are from approved submissions. Municipal boundaries referenced from NAMRIA / PSA administrative data.
            &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.
          </p>
        </Card.Body>
      </Card>
    </section>
  );
}