import React, { useEffect, useMemo, useRef } from 'react';
import { Card } from 'react-bootstrap';
import L from 'leaflet';
import geojson from '../data/pangasinan_municipalities.json';
import { getMunicipalityProduction } from '../services/dataService';
import { oceanScale, OCEAN_LIGHT, BRAND } from '../theme/colors';

export default function MunicipalityMapSection({ onSelectMunicipality }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geoJsonLayerRef = useRef(null);
  const clickRef = useRef(onSelectMunicipality);

  useEffect(() => {
    clickRef.current = onSelectMunicipality;
  });

  const sorted = useMemo(() => getMunicipalityProduction(), []);
  const values = sorted.map((m) => m.productionMT);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const mapSorted = getMunicipalityProduction();
    const byName = Object.fromEntries(mapSorted.map((m) => [m.name, m]));
    const scaledFor = (value) => oceanScale(value, min, max);

    const map = L.map(mapRef.current).setView([16.1, 119.95], 9);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    geoJsonLayerRef.current = L.geoJSON(geojson, {
      style: (feature) => {
        const m = byName[feature.properties.name];
        return {
          fillColor: m ? scaledFor(m.productionMT) : '#cbd5e1',
          weight: 1.5,
          opacity: 0.9,
          color: '#ffffff',
          fillOpacity: 0.72,
        };
      },
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: (e) => {
            const target = e.target;
            const m = byName[feature.properties.name];
            if (!m) return;
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
            target.bindTooltip(tooltipContent, { sticky: true, direction: 'top', offset: [0, -10] }).openTooltip();
          },
          mouseout: (e) => {
            geoJsonLayerRef.current.resetStyle(e.target);
            e.target.closeTooltip();
          },
          click: () => {
            const m = byName[feature.properties.name];
            if (m) clickRef.current(m);
          },
        });
      },
    }).addTo(map);

    if (geoJsonLayerRef.current) {
      map.fitBounds(geoJsonLayerRef.current.getBounds(), { padding: [24, 24] });
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
            Select a municipality on the map to view its detailed summary. Municipal boundaries referenced from
            NAMRIA / PSA administrative data; base map &copy; OpenStreetMap contributors.
          </p>
        </Card.Body>
      </Card>
    </section>
  );
}