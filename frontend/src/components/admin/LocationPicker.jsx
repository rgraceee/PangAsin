import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { AlertTriangle, LocateFixed, RotateCcw, WifiOff } from 'lucide-react';
import { addLightBasemap } from '../../utils/mapLayers';
import { PANGASINAN_CENTER, isWithinPangasinan } from '../../utils/municipalityGeo';

const DEFAULT_CENTER = PANGASINAN_CENTER;
const round6 = (value) => Math.round(value * 1e6) / 1e6;

function toPoint(latitude, longitude) {
  if (latitude === '' || longitude === '' || latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function markerIcon() {
  return L.divIcon({
    className: 'admin-location-marker',
    html: '<span></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/* WHAT: Click/drag map picker para sa municipality coordinates.
   WHY: Hindi na kailangang mag-type ng latitude/longitude; ang pin ay
        nagbabalik ng 6-decimal values na tugma sa backend validation.
   WHY: May geolocation at offline notice para hindi maging dead-end ang
        picker kapag mahina ang connection. */
export default function LocationPicker({ latitude, longitude, onChange, height = 260 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const [online, setOnline] = useState(
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  );

  const point = toPoint(latitude, longitude);
  const outsideProvince = Boolean(point) && !isWithinPangasinan(point[0], point[1]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const createMarker = useCallback((latlng) => {
    const map = mapRef.current;
    if (!map) return null;
    const marker = L.marker(latlng, {
      draggable: true,
      icon: markerIcon(),
    }).addTo(map);
    marker.on('dragend', () => {
      const next = marker.getLatLng();
      onChangeRef.current?.(round6(next.lat), round6(next.lng));
    });
    markerRef.current = marker;
    return marker;
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const initialPoint = toPoint(latitude, longitude);
    const start = initialPoint || DEFAULT_CENTER;

    const map = L.map(containerRef.current, {
      center: start,
      zoom: initialPoint ? 11 : 9,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    });
    const tiles = addLightBasemap(map);
    tiles.on('tileerror', () => setTilesUnavailable(true));
    tiles.on('tileload', () => setTilesUnavailable(false));

    if (initialPoint) createMarker(initialPoint);

    map.on('click', (event) => {
      const latlng = event.latlng;
      if (markerRef.current) markerRef.current.setLatLng(latlng);
      else createMarker(latlng);
      onChangeRef.current?.(round6(latlng.lat), round6(latlng.lng));
    });

    mapRef.current = map;
    // WHAT: Dalawang timer — modal animation at late layout shifts.
    // WHY: Kung isang beses lang, may chance na half-rendered pa ang mapa.
    const firstTimer = window.setTimeout(() => map.invalidateSize(), 180);
    const secondTimer = window.setTimeout(() => map.invalidateSize(), 420);

    // WHAT: ResizeObserver para sa modal open/close at responsive layout.
    // WHY: Ang scrollable modal ay nagbabago ng height habang nag-a-animate;
    //      kapag hindi na-invalidate, putol o gray ang tiles sa ibaba.
    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);
    }

    return () => {
      window.clearTimeout(firstTimer);
      window.clearTimeout(secondTimer);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // WHAT: Init once; the sync effect below keeps the marker updated afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextPoint = toPoint(latitude, longitude);
    if (!nextPoint) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }
    if (markerRef.current) markerRef.current.setLatLng(nextPoint);
    else createMarker(nextPoint);
    map.panTo(nextPoint);
  }, [latitude, longitude, createMarker]);

  const placePoint = useCallback((lat, lng) => {
    const map = mapRef.current;
    if (!map) return;
    const nextPoint = [lat, lng];
    if (markerRef.current) markerRef.current.setLatLng(nextPoint);
    else createMarker(nextPoint);
    map.panTo(nextPoint);
  }, [createMarker]);

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoError('This browser does not support geolocation.');
      return;
    }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = round6(position.coords.latitude);
        const lng = round6(position.coords.longitude);
        placePoint(lat, lng);
        onChangeRef.current?.(lat, lng);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        if (error.code === 1) {
          setGeoError('Location permission was denied. Click the map to set the pin instead.');
        } else {
          setGeoError('Could not get your location. Click the map to set the pin instead.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo(DEFAULT_CENTER, 9, { duration: 0.4 });
  };

  return (
    <div className="admin-location-picker">
      <div className="admin-location-picker__map">
        <div
          ref={containerRef}
          style={{ height }}
          aria-label="Map coordinate picker"
        />
        <div className="admin-location-picker__tools">
          <button
            type="button"
            className="admin-location-picker__tool"
            onClick={locate}
            disabled={locating}
            title="Use my current location"
            aria-label="Use my current location"
          >
            <LocateFixed size={14} aria-hidden="true" />
            <span className="admin-location-picker__tool-label">
              {locating ? 'Locating…' : 'Use my location'}
            </span>
          </button>
          <button
            type="button"
            className="admin-location-picker__tool admin-location-picker__tool--icon"
            onClick={resetView}
            title="Reset map view to Pangasinan"
            aria-label="Reset map view to Pangasinan"
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {(!online || tilesUnavailable) && (
        <div className="admin-location-picker__notice" role="status">
          <WifiOff size={14} aria-hidden="true" />
          Basemap tiles are unavailable. The pin and coordinates still work.
        </div>
      )}
      {outsideProvince && (
        <div className="admin-location-picker__notice admin-location-picker__notice--warning" role="status">
          <AlertTriangle size={14} aria-hidden="true" />
          These coordinates are outside the Pangasinan bounds. Double-check the pin.
        </div>
      )}
      {geoError && (
        <div className="admin-location-picker__notice admin-location-picker__notice--error" role="status">
          {geoError}
        </div>
      )}

      <p className="admin-location-picker__hint">
        Click the map or drag the pin to set latitude and longitude.
        <span className="admin-location-picker__coords">
          {point
            ? `Selected: ${point[0].toFixed(6)}, ${point[1].toFixed(6)}`
            : 'No point selected yet.'}
        </span>
      </p>
    </div>
  );
}
