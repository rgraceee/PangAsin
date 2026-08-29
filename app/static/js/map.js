const Map = (function () {
  let map = null;
  let geojsonLayer = null;
  let selectedId = null;
  let municipalities = [];

  function init(muniData) {
    municipalities = muniData || [];
    const pangasinanCenter = [16.0, 119.9];
    map = L.map("public-map").setView(pangasinanCenter, 9);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    const geoJsonData = buildSyntheticGeoJSON(municipalities);
    geojsonLayer = L.geoJSON(geoJsonData, {
      style: styleFeature,
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: (e) => onMouseOver(e, feature),
          mouseout: (e) => onMouseOut(e, feature),
          click: (e) => onClick(e, feature),
        });
      },
    }).addTo(map);

    addLegend();
    fitBounds();
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
        ]
      ];
      return {
        type: "Feature",
        properties: { id: m.id, name: m.name, productionMT: m.productionMT },
        geometry: { type: "Polygon", coordinates: coordinates },
      };
    });
    return { type: "FeatureCollection", features };
  }

  function classify(value) {
    const sorted = municipalities
      .map((m) => m.productionMT)
      .sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.33)];
    const q2 = sorted[Math.floor(sorted.length * 0.66)];
    if (value >= q2) return "high";
    if (value >= q1) return "medium";
    return "low";
  }

  function styleFeature(feature) {
    const value = feature.properties.productionMT;
    const cls = classify(value);
    const colors = { high: "#198754", medium: "#ffc107", low: "#dc3545" };
    return {
      fillColor: colors[cls] || "#6c757d",
      weight: 1.5,
      opacity: 0.9,
      color: "#ffffff",
      fillOpacity: 0.55,
    };
  }

  function onMouseOver(e, feature) {
    const layer = e.target;
    layer.setStyle({ fillOpacity: 0.8, weight: 2.5 });
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
    const m = municipalities.find((x) => x.id === feature.properties.id);
    if (!m) return;
    const trendSymbol = m.productionChangePercent >= 0 ? "↑" : "↓";
    const trendClass = m.productionChangePercent >= 0 ? "text-success" : "text-danger";
    const tooltipContent = `
      <div style="min-width:160px">
        <strong>${m.name}</strong><br/>
        <span style="font-size:0.85rem">Production: ${m.productionMT.toLocaleString()} MT</span><br/>
        <span class="${trendClass}" style="font-size:0.85rem">${trendSymbol} ${Math.abs(m.productionChangePercent)}%</span><br/>
        <span style="font-size:0.85rem;color:#495057">Method: ${m.dominantMethod.charAt(0).toUpperCase() + m.dominantMethod.slice(1)}</span>
      </div>
    `;
    layer.bindTooltip(tooltipContent, { sticky: true, direction: "top", offset: [0, -10] }).openTooltip();
  }

  function onMouseOut(e, feature) {
    geojsonLayer.resetStyle(e.target);
    e.target.closeTooltip();
  }

  function onClick(e, feature) {
    const id = feature.properties.id;
    selectedId = id;
    Dashboard.openMunicipalityDetail(id);
  }

  function highlightFeature(id) {
    selectedId = id;
    geojsonLayer.eachLayer((layer) => {
      const props = layer.feature?.properties || {};
      if (props.id === id) {
        layer.setStyle({ fillOpacity: 0.85, weight: 3, color: "#0d6efd" });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          layer.bringToFront();
        }
      } else {
        geojsonLayer.resetStyle(layer);
      }
    });
  }

  function fitBounds() {
    if (geojsonLayer && map) {
      map.fitBounds(geojsonLayer.getBounds(), { padding: [24, 24] });
    }
  }

  function addLegend() {
    const legend = L.control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "map-legend");
      div.innerHTML = `
        <div style="background:white;padding:0.6rem 0.8rem;border-radius:0.5rem;border:1px solid #dee2e6">
          <strong style="font-size:0.8rem;display:block;margin-bottom:0.4rem">Production Level</strong>
          <div class="map-legend-item"><span class="map-legend-swatch" style="background:#198754"></span> High</div>
          <div class="map-legend-item"><span class="map-legend-swatch" style="background:#ffc107"></span> Medium</div>
          <div class="map-legend-item"><span class="map-legend-swatch" style="background:#dc3545"></span> Low</div>
        </div>
      `;
      return div;
    };
    legend.addTo(map);
  }

  return { init, highlightFeature };
})();
