const Dashboard = (function () {
  const MOCK_BASE = "/static/data/mock";
  let mockData = {};

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [municipalities, production, demographics, supplyDemand] = await Promise.all([
        fetch(`${MOCK_BASE}/municipalities.json`).then((r) => {
          if (!r.ok) throw new Error(`municipalities.json failed: ${r.status}`);
          return r.json();
        }),
        fetch(`${MOCK_BASE}/production.json`).then((r) => {
          if (!r.ok) throw new Error(`production.json failed: ${r.status}`);
          return r.json();
        }),
        fetch(`${MOCK_BASE}/demographics.json`).then((r) => {
          if (!r.ok) throw new Error(`demographics.json failed: ${r.status}`);
          return r.json();
        }),
        fetch(`${MOCK_BASE}/supply_demand.json`).then((r) => {
          if (!r.ok) throw new Error(`supply_demand.json failed: ${r.status}`);
          return r.json();
        }),
      ]);
      mockData = { municipalities, production, demographics, supplyDemand };
      renderKPIs();
      renderDataIndicators();
      Map.init(mockData.municipalities);
      Charts.renderAll(mockData);
    } catch (err) {
      console.error("Dashboard data load failed:", err);
      setError("Unable to load dashboard data. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function retryLoad() {
    setError(null);
    loadAll();
  }

  function setLoading(isLoading) {
    const kpis = document.getElementById("kpi-container");
    if (!kpis) return;
    kpis.style.opacity = isLoading ? "0.6" : "1";
    kpis.style.pointerEvents = isLoading ? "none" : "auto";
  }

  function setError(message) {
    const el = document.getElementById("dashboard-error");
    const retryBtn = document.getElementById("dashboard-retry");
    if (!el) return;
    if (message) {
      el.innerHTML = `${message} <button type="button" class="btn btn-sm btn-outline-danger ms-2" id="dashboard-retry">Retry</button>`;
      el.style.display = "block";
      const btn = document.getElementById("dashboard-retry");
      if (btn) {
        btn.addEventListener("click", retryLoad);
      }
    } else {
      el.style.display = "none";
      el.innerHTML = "";
    }
  }

  function renderKPIs() {
    const data = mockData.supplyDemand || {};
    const totalProduction = data.pangasinanSupplyMT || 0;
    const totalArea = mockData.municipalities?.reduce((sum, m) => sum + (m.productionAreaHa || 0), 0) || 0;
    const producerEntries = mockData.demographics?.provinceWide?.genderDistribution
      ? Object.values(mockData.demographics.provinceWide.genderDistribution).reduce((a, b) => a + b, 0)
      : 0;
    const sufficiency = data.sufficiencyRate || 0;

    const formatNum = (n) => n.toLocaleString("en-US");
    const formatDec = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    setText("kpi-production", formatNum(Math.round(totalProduction)) + " MT");
    setText("kpi-area", formatNum(Math.round(totalArea)) + " ha");
    setText("kpi-producers", formatNum(producerEntries));
    setText("kpi-sufficiency", formatDec(sufficiency) + "%");
  }

  function renderDataIndicators() {
    const asOfEl = document.getElementById("data-as-of");
    if (asOfEl && mockData.supplyDemand?.asOfDate) {
      asOfEl.textContent = mockData.supplyDemand.asOfDate;
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function openMunicipalityDetail(id) {
    const muni = mockData.municipalities?.find((m) => m.id === id);
    if (!muni) return;
    Map.highlightFeature(id);
    Charts.renderMethodDistribution(muni);
    Charts.renderHistoricalTrend(muni);
    Charts.renderDemographics(id);
    DetailPanel.populate(muni);
    const offcanvas = document.getElementById("municipalityDetail");
    if (offcanvas && typeof offcanvas.show === "function") {
      offcanvas.show();
    }
  }

  function getMunicipalities() {
    return mockData.municipalities || [];
  }

  function getSupplyDemand() {
    return mockData.supplyDemand || {};
  }

  function getDemographics() {
    return mockData.demographics || {};
  }

  function getProduction() {
    return mockData.production || {};
  }

  return {
    loadAll,
    retryLoad,
    openMunicipalityDetail,
    getMunicipalities,
    getSupplyDemand,
    getDemographics,
    getProduction,
  };
})();

const DetailPanel = (function () {
  function populate(m) {
    const container = document.getElementById("detail-content");
    if (!container) return;
    const trendSymbol = m.productionChangePercent >= 0 ? "↑" : "↓";
    const trendClass = m.productionChangePercent >= 0 ? "text-success" : "text-danger";
    container.innerHTML = `
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h3 class="h5 mb-1">${m.name}</h3>
            <span class="text-muted small">${m.productionRank} of 7 municipalities</span>
          </div>
          <span class="synthetic-badge" style="font-size:0.7rem">Synthetic Data</span>
        </div>
      </div>
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title text-uppercase text-muted small">Production Summary</h6>
          <div class="detail-metric">
            <span class="detail-metric-label">Current Production</span>
            <span class="detail-metric-value">${m.productionMT.toLocaleString()} MT</span>
          </div>
          <div class="detail-metric">
            <span class="detail-metric-label">Previous Production</span>
            <span class="detail-metric-value">${m.previousProductionMT.toLocaleString()} MT</span>
          </div>
          <div class="detail-metric">
            <span class="detail-metric-label">Change</span>
            <span class="detail-metric-value ${trendClass}">${trendSymbol} ${Math.abs(m.productionChangePercent)}%</span>
          </div>
          <div class="detail-metric">
            <span class="detail-metric-label">Production Rank</span>
            <span class="detail-metric-value">${m.productionRank} of 7</span>
          </div>
        </div>
      </div>
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title text-uppercase text-muted small">Production Area & Facilities</h6>
          <div class="detail-metric">
            <span class="detail-metric-label">Production Area</span>
            <span class="detail-metric-value">${m.productionAreaHa.toLocaleString()} ha</span>
          </div>
          <div class="detail-metric">
            <span class="detail-metric-label">Salt Beds</span>
            <span class="detail-metric-value">${m.saltBeds}</span>
          </div>
          <div class="detail-metric">
            <span class="detail-metric-label">Dominant Method</span>
            <span class="detail-metric-value">${m.dominantMethod.charAt(0).toUpperCase() + m.dominantMethod.slice(1)}</span>
          </div>
        </div>
      </div>
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title text-uppercase text-muted small">Method Distribution</h6>
          <div class="chart-container" style="height: 260px;">
            <canvas id="methodDistributionChart" aria-label="Method distribution chart" role="img"></canvas>
          </div>
        </div>
      </div>
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title text-uppercase text-muted small">Historical Trend</h6>
          <div class="chart-container" style="height: 260px;">
            <canvas id="historicalTrendChart" aria-label="Historical production trend chart" role="img"></canvas>
          </div>
        </div>
      </div>
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title text-uppercase text-muted small">Aggregated Demographics</h6>
          <div id="detail-age-empty" class="text-muted small" style="display:none">Age data not available</div>
          <div class="chart-container" style="height: 240px;">
            <canvas id="detailAgeChart" aria-label="Municipality age distribution chart" role="img"></canvas>
          </div>
          <hr class="my-3">
          <div id="detail-gender-empty" class="text-muted small" style="display:none">Gender data not available</div>
          <div class="chart-container" style="height: 240px;">
            <canvas id="detailGenderChart" aria-label="Municipality gender distribution chart" role="img"></canvas>
          </div>
        </div>
      </div>
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title text-uppercase text-muted small">Industry Insight</h6>
          <p class="mb-0">${m.insightSnippet || "No insight available."}</p>
        </div>
      </div>
    `;
  }
  return { populate };
})();
