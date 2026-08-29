import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import MunicipalityDetailPanel from './MunicipalityDetailPanel';
import { getMunicipalityProduction } from '../services/dataService';

export default function MunicipalityMapSection({ municipalities, onSelectMunicipality }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geoJsonLayerRef = useRef(null);

  const sorted = getMunicipalityProduction();
  const values = sorted.map((m) => m.productionMT);
  const q1 = values[Math.floor(values.length * 0.33)];
  const q2 = values[Math.floor(values.length * 0.66)];

  function classify(value) {
    if (value >= q2) return 'high';
    if (value >= q1) return 'medium';
    return 'low';
  }

  function buildSyntheticGeoJSON(municipalities) {
    const features = municipalities.map((m) => {
      const lat = parseFloat(m.latitude);
      const lng = parseFloat(m.longitude);
      const offset = 0.08;
      const coordinates = [
        [
          [lng - offset, lat + offset],
          [lng + offset, lat + offset],
          [lng + offset, lat - offset],
          [lng - offset, lat - offset],
          [lng - offset, lat + offset],
        ],
      ];
      return {
        type: 'Feature',
        properties: { id: m.id, name: m.name, productionMT: m.productionMT },
        geometry: { type: 'Polygon', coordinates },
      };
    });
    return { type: 'FeatureCollection', features };
  }

  function styleFeature(feature) {
    const value = feature.properties.productionMT;
    const cls = classify(value);
    const colors = { high: '#198754', medium: '#ffc107', low: '#dc3545' };
    return {
      fillColor: colors[cls] || '#6c757d',
      weight: 1.5,
      opacity: 0.9,
      color: '#ffffff',
      fillOpacity: 0.55,
    };
  }

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([16.1, 119.95], 9);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    const geoJsonData = buildSyntheticGeoJSON(sorted);
    geoJsonLayerRef.current = L.geoJSON(geoJsonData, {
      style: styleFeature,
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: (e) => {
            const layer = e.target;
            layer.setStyle({ fillOpacity: 0.8, weight: 2.5 });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              layer.bringToFront();
            }
            const m = sorted.find((x) => x.id === feature.properties.id);
            if (!m) return;
            const trendSymbol = m.productionChangePercent >= 0 ? '↑' : '↓';
            const trendClass = m.productionChangePercent >= 0 ? 'text-success' : 'text-danger';
            const tooltipContent = `
              <div style="min-width:160px">
                <strong>${m.name}</strong><br/>
                <span style="font-size:0.85rem">Production: ${m.productionMT.toLocaleString()} MT</span><br/>
                <span class="${trendClass}" style="font-size:0.85rem">${trendSymbol} ${Math.abs(m.productionChangePercent)}%</span><br/>
                <span style="font-size:0.85rem;color:#495057">Method: ${m.dominantMethod.charAt(0).toUpperCase() + m.dominantMethod.slice(1)}</span>
              </div>
            `;
            layer.bindTooltip(tooltipContent, { sticky: true, direction: 'top', offset: [0, -10] }).openTooltip();
          },
          mouseout: (e) => {
            geoJsonLayerRef.current.resetStyle(e.target);
            e.target.closeTooltip();
          },
          click: (e) => {
            const id = feature.properties.id;
            onSelectMunicipality(id);
          },
        });
      },
    }).addTo(map);

    if (geoJsonLayerRef.current) {
      map.fitBounds(geoJsonLayerRef.current.getBounds(), { padding: [24, 24] });
    }
  }, [sorted, onSelectMunicipality]);

  return (
    <section className="mb-5">
      <div className="section-card">
        <div className="card-body">
          <h2 className="section-title">Salt Production Across Pangasinan</h2>
          <p className="text-muted small">Explore the distribution of salt production across Pangasinan's salt-producing municipalities.</p>
          <div className="map-container" ref={mapRef}></div>
          <div className="map-legend" aria-label="Map legend">
            <span className="map-legend-item"><span className="map-legend-swatch" style={{ background: '#198754' }}></span> High</span>
            <span className="map-legend-item"><span className="map-legend-swatch" style={{ background: '#ffc107' }}></span> Medium</span>
            <span className="map-legend-item"><span className="map-legend-swatch" style={{ background: '#dc3545' }}></span> Low</span>
          </div>
        </div>
      </div>
    </section>
  );
}
