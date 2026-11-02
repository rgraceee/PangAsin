// WHAT: Leaflet map component na nag-render ng municipality boundary polygon
//      para sa Add Municipality modal. Reuse ang existing Leaflet setup
//      (basemap, invalidateSize, cleanup) galing sa LocationPicker.
// WHY: Kailangang maparaang polygon ang boundary, i-fit ang bounds, at
//      ma-clean up ang map instance kapag na-close ang modal para hindi
//      mag- duplicate ang map instances.
import React, { useCallback, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';
import { addLightBasemap } from '../../utils/mapLayers';
import { PANGASINAN_CENTER } from '../../utils/municipalityGeo';

const DEFAULT_HEIGHT = 320;

function styleForPolygon(isActive) {
  return {
    color: isActive ? '#0d4fa0' : '#1565c8',
    weight: 2,
    opacity: 0.9,
    fillColor: isActive ? '#0d4fa0' : '#1565c8',
    fillOpacity: 0.15,
    interactive: false,
  };
}

export default function MunicipalityBoundaryMap({
  bounds,
  coordinates,
  height = DEFAULT_HEIGHT,
  loading = false,
  error = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const polygonRef = useRef(null);

  const destroyMap = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    polygonRef.current = null;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    if (loading || error) {
      // Don't initialize map while loading or in error state.
      return undefined;
    }

    const map = L.map(containerRef.current, {
      center: PANGASINAN_CENTER,
      zoom: 9,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false,
      zoomControl: false,
    });
    mapRef.current = map;

    addLightBasemap(map);

    return () => {
      destroyMap();
    };
  }, [loading, error, destroyMap]);

  // Render polygon when bounds are available.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bounds) return;

    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }

    const latLngBounds = L.latLngBounds(bounds);
    const polygon = L.polygon(latLngBounds, styleForPolygon(true)).addTo(map);
    polygonRef.current = polygon;

    map.fitBounds(latLngBounds, { padding: [30, 30], maxZoom: 13 });
    map.invalidateSize();
  }, [bounds]);

  // Invalidate size when map is ready (modal opened/resized).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => map.invalidateSize(), 100);
    return () => window.clearTimeout(timer);
  }, [loading, error]);

  if (loading) {
    return (
      <div className="admin-location-picker" style={{ height }}>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
          <Loader2 size={20} aria-hidden="true" />
          <span style={{ marginLeft: 8, fontSize: '0.85rem' }}>Retrieving municipality boundary…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-location-picker" style={{ height }}>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b42318', fontSize: '0.85rem' }}>
          Unable to display boundary.
        </div>
      </div>
    );
  }

  return (
    <div className="admin-location-picker" style={{ height }}>
      <div ref={containerRef} style={{ height: '100%' }} aria-label="Municipality boundary map" />
    </div>
  );
}
