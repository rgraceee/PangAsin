import React, { useEffect, useMemo, useRef } from 'react';
import { Card } from 'react-bootstrap';
import L from 'leaflet';
import geojson from '../data/pangasinan_municipalities.json';
import geojsonAll from '../data/pangasinan_municipalities_all.json';
import { getMunicipalityProduction, getDemographicsByMunicipality } from '../services/dataService';
import { buildMapDetailCard, clampMapDetailTooltip } from '../utils/mapDetailCard';
import { oceanScale, OCEAN_LIGHT, BRAND } from '../theme/colors';
import { addBasemap, buildProvinceMaskRings, addProvinceMask } from '../utils/mapLayers';

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

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const mapSorted = getMunicipalityProduction();
    const byName = Object.fromEntries(mapSorted.map((m) => [normName(m.name), m]));
    const scaledFor = (value) => oceanScale(value, min, max);
    const producingNames = new Set(mapSorted.map((m) => normName(m.name)));

    const allFeatures = [...geojsonAll.features, ...geojson.features];
    const provinceBounds = L.geoJSON(allFeatures).getBounds();

    const map = L.map(mapRef.current, {
        minZoom: 7,
        maxZoom: 15,
        maxBoundsViscosity: 1.0,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        touchZoom: false,
      }).setView(provinceBounds.getCenter(), 8);
    mapInstanceRef.current = map;

    addBasemap(map);
    addProvinceMask(map, buildProvinceMaskRings([geojsonAll, geojson], provinceBounds));

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
        fillColor: '#E2E8F0',
        fillOpacity: 0.65,
        weight: 1.2,
        opacity: 0.85,
        color: '#94A3B8',
      },
      onEachFeature: (feature, layer) => {
        const label = prettyName(feature.properties.shapeName || feature.properties.name || '');
        layer.bindTooltip(
          `<div style="min-width:170px"><strong>${label}</strong><br/><span style="font-size:0.85rem;color:#6B7280">No production data recorded yet</span></div>`,
          { sticky: true, direction: 'right', offset: [12, 0] }
        );
        L.marker(layer.getBounds().getCenter(), {
          icon: L.divIcon({ className: 'muni-name-label', html: label, iconSize: null }),
          interactive: false,
        }).addTo(map);
      },
    }).addTo(map);

    geoJsonLayerRef.current = L.geoJSON(geojson, {
      style: (feature) => {
        const m = byName[normName(feature.properties.name)];
        return {
          fillColor: m ? scaledFor(m.productionMT) : '#cbd5e1',
          weight: 1.5,
          opacity: 0.9,
          color: '#ffffff',
          fillOpacity: 0.72,
        };
      },
      onEachFeature: (feature, layer) => {
        const m = byName[normName(feature.properties.name)];
        layer.on({
          mouseover: (e) => {
            const target = e.target;
            if (!m || detailOpenRef.current) return;
            target.setStyle({ fillOpacity: 0.9, weight: 2.5 });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              target.bringToFront();
            }
            const trendSymbol = m.productionChangePercent >= 0 ? '↑' : '↓';
            const trendClass = m.productionChangePercent >= 0 ? 'text-success' : 'text-danger';
            const changeText = m.productionChangePercent != null ? `${trendSymbol} ${Math.abs(m.productionChangePercent)}%` : '—';
            const tooltipContent = `
              <div style="min-width:160px">
                <strong>${m.name}</strong><br/>
                <span style="font-size:0.85rem">Production: ${m.productionMT.toLocaleString()} MT</span><br/>
                <span class="${trendClass}" style="font-size:0.85rem">${changeText}</span><br/>
                <span style="font-size:0.85rem;color:#495057">Method: ${m.dominantMethod.charAt(0).toUpperCase() + m.dominantMethod.slice(1)}</span>
              </div>
            `;
            target.bindTooltip(tooltipContent, { sticky: true, direction: 'right', offset: [12, 0], className: 'muni-hover-tooltip' }).openTooltip();
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
            const kgPerBed = m.saltBeds > 0 ? `${Math.round((m.productionMT * 1000) / m.saltBeds).toLocaleString()} kg` : '—';
            const html = buildMapDetailCard({
              name: m.name,
              rows: [
                ['Current Production', `${m.productionMT.toLocaleString()} MT`],
                ['Change', changeText],
                ['Production Area', `${(m.productionAreaSqm || 0).toLocaleString()} m²`],
                ['Salt Beds', (m.saltBeds || 0).toLocaleString()],
                ['Dominant Method', m.dominantMethod.charAt(0).toUpperCase() + m.dominantMethod.slice(1)],
                ['Male / Female', genderText],
                ['Kg per Bed', kgPerBed],
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

        L.marker(layer.getBounds().getCenter(), {
          icon: L.divIcon({ className: 'muni-name-label', html: m ? prettyName(m.name) : prettyName(feature.properties.name), iconSize: null }),
          interactive: false,
        }).addTo(map);
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
      <Card className="encoder-card">
        <Card.Header>
          <div className="admin-card-head">
            <h5 className="admin-card-head-title">Salt Production Across Pangasinan</h5>
            <span className="fw-normal text-muted small ms-1">Distribution by municipality</span>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="map-wrapper">
            <div className="map-container" ref={mapRef}></div>
          </div>
          <div className="map-legend" aria-label="Map legend">
            <div className="map-gradient-caption">
              <span className="map-legend-label">Lower production</span>
              <span className="map-legend-label">Higher production</span>
            </div>
            <div
              className="map-gradient-legend"
              style={{ backgroundImage: `linear-gradient(90deg, ${OCEAN_LIGHT} 0%, ${BRAND.ocean} 100%)` }}
            ></div>
            <p className="map-range-note">
              {min.toLocaleString()} MT → {max.toLocaleString()} MT across the {sorted.length} producing municipalities
            </p>
          </div>
          <p className="text-muted small mb-0 mt-2">
            Select a municipality on the map to view its detailed summary. Shaded gray municipalities have no
            recorded production yet. Municipal boundaries referenced from NAMRIA / PSA administrative data.
            &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.
          </p>
        </Card.Body>
      </Card>
    </section>
  );
}