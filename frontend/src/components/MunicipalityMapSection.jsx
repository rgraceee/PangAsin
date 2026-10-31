import React, { useEffect, useMemo, useRef } from 'react';
import { Card } from 'react-bootstrap';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import geojson from '../data/pangasinan_municipalities.json';
import geojsonAll from '../data/pangasinan_municipalities_all.json';
import { getMunicipalityProduction, getDemographicsByMunicipality } from '../services/dataService';
import { greenScale, GREEN_LIGHT, GREEN_DARK } from '../theme/colors';
import { buildMapDetailCard, createMapDetailPopup, openMapDetailPopup } from '../utils/mapDetailCard';
import { addLightBasemap, buildProvinceMaskRings, addProvinceMask, getProductionTier, computeTierThresholds, NON_PRODUCING_FILL, NON_PRODUCING_BORDER } from '../utils/mapLayers';

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
  const total = values.reduce((s, v) => s + (v || 0), 0);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
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
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        touchZoom: false,
      }).setView(provinceBounds.getCenter(), 8);
    mapInstanceRef.current = map;

    addLightBasemap(map);
    addProvinceMask(map, buildProvinceMaskRings([geojsonAll, geojson], provinceBounds), {
      fillColor: '#ffffff',
      fillOpacity: 1,
    });

    const demographics = getDemographicsByMunicipality();

    const detailPopup = createMapDetailPopup({
      onClose: () => {
        detailOpenRef.current = false;
      },
    });
    map.on('click', (e) => {
      const target = e.originalEvent && e.originalEvent.target;
      if (target && target.classList && target.classList.contains('leaflet-interactive')) return;
      if (detailPopup.isOpen()) detailPopup.close();
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
        if (m) {
          const rank = mapSorted.findIndex((x) => normName(x.name) === normName(m.name)) + 1;
          const share = total > 0 ? (m.productionMT / total) * 100 : 0;
          const tooltipContent = `
            <div style="min-width:160px">
              <strong>${m.name}</strong><br/>
              <span style="font-size:0.85rem">Production: ${m.productionMT.toLocaleString()} Metric Tons (MT)</span><br/>
              <span style="font-size:0.85rem">Rank: ${rank} of ${mapSorted.length}</span><br/>
              <span style="font-size:0.85rem">Share: ${share.toFixed(1)}%</span>
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
                ['Current Production', `${m.productionMT.toLocaleString()} MT`],
                ['Change', changeText],
                ['Salt Beds', bedEstimateLabel],
                ['Dominant Method', methodLabel],
                ['Male/Female', genderText],
              ],
            });
            const b = layer.getBounds();
            const anchor = L.latLng(
              b.getCenter().lat,
              b.getCenter().lng + (b.getEast() - b.getCenter().lng) * 0.6
            );
            openMapDetailPopup(map, detailPopup, { latlng: anchor, html });
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

  const periodLabel = 'All time';

  return (
    <section className="public-section">
      <Card className="encoder-card fc-card">
        <Card.Header className="fc-card-head">
          <div className="fc-card-head-left">
            <span className="fc-card-head-icon">
              <MapPin size={16} strokeWidth={1.75} />
            </span>
            <div className="fc-card-head-text">
              <h5 className="fc-card-title">Salt Production Across Pangasinan</h5>
              <p className="fc-card-sub">Darker municipalities produce more salt; hover a municipality for details.</p>
            </div>
          </div>
        </Card.Header>
        <Card.Body className="fc-card-body">
          <div
            className="map-wrapper"
            role="region"
            aria-label="Choropleth map of Pangasinan showing source-labeled salt production per municipality."
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
            source data. Municipal boundaries referenced from NAMRIA / PSA administrative data.
            &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.
          </p>
        </Card.Body>
      </Card>
    </section>
  );
}