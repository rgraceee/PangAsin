// Minimal leaflet mock for jsdom-based vitest smoke tests.
export const Map = function () {
  this._container = null;
  this._layers = [];
};
Map.prototype.setView = function () { return this; };
Map.prototype.addLayer = function () { return this; };
Map.prototype.removeLayer = function () { return this; };
Map.prototype.invalidateSize = function () { return this; };
Map.prototype.on = function () { return this; };
Map.prototype.off = function () { return this; };
Map.prototype.addTo = function () { return this; };

export const tileLayer = function () {
  return { addTo: () => {} };
};

export const marker = function () {
  return { addTo: () => {}, setLatLng: () => {}, bindPopup: () => {} };
};

export const circle = function () {
  return { addTo: () => {}, setLatLng: () => {}, setRadius: () => {} };
};

export const polygon = function () {
  return { addTo: () => {}, setLatLngs: () => {}, bindPopup: () => {} };
};

export const geoJSON = function () {
  return {
    addTo: () => {},
    clearLayers: () => {},
    getBounds: () => ({ getSouthWest: () => ({ lat: () => 0, lng: () => 0 }), getNorthEast: () => ({ lat: () => 0, lng: () => 0 }) }),
    eachLayer: (cb) => {},
  };
};

export const divIcon = function () {
  return { options: { html: '' } };
};

export const latLng = function (lat, lng) {
  return { lat, lng, distanceTo: () => 0 };
};

export const layerGroup = function () {
  return { addTo: () => {}, clearLayers: () => {}, addLayer: () => {} };
};

export const DomEvent = {
  on: () => {},
  off: () => {},
  disableClickPropagation: () => {},
};

export const DomUtil = {
  get: () => null,
  getStyle: () => '',
  create: () => document.createElement('div'),
  setPosition: () => {},
  getPosition: () => ({ x: 0, y: 0 }),
  getViewportOffset: () => ({ x: 0, y: 0 }),
};

export const Browser = { ie: false, ielt9: false, webkit: false };

export default {
  map: () => new Map(),
  tileLayer,
  marker,
  circle,
  polygon,
  geoJSON,
  divIcon,
  latLng,
  layerGroup,
  DomEvent,
  DomUtil,
  Browser,
  version: '1.9.4',
};
