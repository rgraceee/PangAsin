import L from 'leaflet';

export function buildMapDetailCard({ name, rows }) {
  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <div class="map-popup-row">
          <span class="map-popup-label">${label}</span>
          <span class="map-popup-value">${value}</span>
        </div>
      `
    )
    .join('');

  return `
    <div class="map-popup-card">
      <div class="map-popup-header">
        <span class="map-popup-title">${name}</span>
      </div>
      ${rowsHtml}
      <div class="map-popup-foot">Administrative summary</div>
    </div>
  `;
}

/* WHAT: Shared Leaflet popup na may auto-fit, pan, at close button.
   WHY: Tooltip-based card ay lumalabas sa gilid ng mapa kapag malapit sa
        boundary; ang popup fit/pan ang gumagarantiya na buo itong makikita. */
export function createMapDetailPopup({ onClose } = {}) {
  const popup = L.popup({
    className: 'admin-map-popup',
    autoPan: false,
    closeButton: true,
    closeOnClick: true,
    closeOnEscapeKey: true,
    maxWidth: 420,
  });
  if (typeof onClose === 'function') popup.on('remove', onClose);
  return popup;
}

/* WHAT: Itakda ang lapad base sa aktwal na map bago buksan ang popup.
   WHY: Sa mobile, mas maliit ang map kaysa viewport dahil sa page padding;
        kung viewport width ang gagamitin, lalampas ang card sa gilid ng mapa. */
function getPopupOverflow(map, popup, margin) {
  const root = popup.getElement();
  const card = root && root.querySelector('.leaflet-popup-content-wrapper');
  if (!card) return null;
  const mapRect = map.getContainer().getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  return {
    x: cardRect.right + margin > mapRect.right
      ? cardRect.right + margin - mapRect.right
      : Math.min(0, cardRect.left - mapRect.left - margin),
    y: cardRect.bottom + margin > mapRect.bottom
      ? cardRect.bottom + margin - mapRect.bottom
      : Math.min(0, cardRect.top - mapRect.top - margin),
  };
}

/* WHAT: I-pan muna ang mapa, tapos i-shift ang popup kung kulang pa.
   WHY: May maxBounds ang mapa kaya hindi laging kayang i-pan papalabas ng
        gilid; ang fallback shift ay siguradong buo pa rin ang card. */
function fitPopupInMap(map, popup, margin = 10) {
  if (!popup.isOpen()) return;
  const first = getPopupOverflow(map, popup, margin);
  if (!first || (!first.x && !first.y)) return;

  map.panBy([first.x, first.y], { animate: false });

  /* WHAT: I-settle agad ang maxBounds bago mag-measure.
     WHY: Ang panBy ay nag-trigger ng async bounds correction; kung hindi ito
          hihintayin, babalik ang mapa at mananatiling clipped ang popup. */
  map.stop();
  if (map.options.maxBounds) {
    map.panInsideBounds(map.options.maxBounds, { animate: false });
  }

  const remaining = getPopupOverflow(map, popup, margin);
  if (!remaining || (!remaining.x && !remaining.y)) return;

  const current = map.latLngToContainerPoint(popup.getLatLng());
  const shifted = map.containerPointToLatLng(
    L.point(current.x - remaining.x, current.y - remaining.y)
  );
  popup.setLatLng(shifted);
}

export function openMapDetailPopup(map, popup, { latlng, html }) {
  const size = map.getSize();
  const detailWidth = Math.min(420, Math.max(160, size.x - 32));
  const detailMaxHeight = Math.min(560, Math.max(160, size.y - 22));
  const container = map.getContainer();
  container.style.setProperty('--map-detail-width', `${detailWidth}px`);
  container.style.setProperty('--map-detail-max-height', `${detailMaxHeight}px`);
  popup.setLatLng(latlng).setContent(html).openOn(map);
  fitPopupInMap(map, popup);
}
