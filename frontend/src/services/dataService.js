let dashboardCache = { municipalities: [], production: { provinceTotalMT: 0, records: [] }, demographics: { provinceWide: {}, byMunicipality: {} }, supplyDemand: null };

async function apiNoAuth(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function loadAllMockData() {
  const data = await apiNoAuth('/api/public/dashboard');
  dashboardCache = data;
  return data;
}

export function getMunicipalityProduction() {
  const sorted = [...(dashboardCache.municipalities || [])].sort((a, b) => b.productionMT - a.productionMT);
  const total = sorted.reduce((sum, m) => sum + (m.productionMT || 0), 0);
  return sorted.map((m) => ({
    ...m,
    percentageOfTotal: total > 0 ? (m.productionMT / total) * 100 : 0,
  }));
}

export function getProductionSummary() {
  const munis = dashboardCache.municipalities || [];
  const totalProduction = munis.reduce((sum, m) => sum + (m.productionMT || 0), 0);
  const totalArea = munis.reduce((sum, m) => sum + (m.productionAreaSqm || 0), 0);
  const gender = (dashboardCache.demographics?.provinceWide?.genderDistribution) || {};
  const producerEntries = Object.values(gender).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const sd = dashboardCache.supplyDemand || { philippines: {}, pangasinan: {} };
  const demand = sd.philippines?.demand || 0;
  const domesticSupply = sd.philippines?.domesticSupply || 0;
  const sufficiency = demand > 0 ? (domesticSupply / demand) * 100 : 0;
  return {
    totalProduction,
    totalArea,
    producerEntries,
    sufficiency,
    municipalityCount: munis.length,
  };
}

export function getSupplyDemand(scope) {
  const sd = dashboardCache.supplyDemand || {};
  if (scope === 'philippines') {
    const ph = sd.philippines || {};
    return {
      labels: ['National Demand', 'Domestic Supply', 'Imported Salt'],
      values: [ph.demand || 0, ph.domesticSupply || 0, ph.imports || 0],
      unit: 'MT',
      note: 'Compiled from database demand benchmarks',
    };
  }
  const pa = sd.pangasinan || {};
  return {
    labels: ['Pangasinan Supply', 'Demand Benchmark'],
    values: [pa.localSupply || 0, pa.demandBenchmark || 0],
    unit: 'MT',
    note: 'Compiled from database demand benchmarks',
  };
}

export function getSectorDemand() {
  const sector = (dashboardCache.supplyDemand && dashboardCache.supplyDemand.sectorDemand) || {};
  const total = Object.values(sector).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return Object.entries(sector).map(([key, value]) => ({
    sector: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
    value,
    percentage: total > 0 ? (value / total) * 100 : 0,
  }));
}

export function getProducerDemographics() {
  return (dashboardCache.demographics && dashboardCache.demographics.provinceWide) || { ageGroups: {}, genderDistribution: {} };
}

export function getMunicipalityDetail(id) {
  return (dashboardCache.municipalities || []).find((m) => m.id === id) || null;
}

export function getIndustryInsight(id) {
  const muni = (dashboardCache.municipalities || []).find((m) => m.id === id);
  return muni ? muni.insightSnippet : null;
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.errors?.join(', ') || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function loginAPI(email, password) {
  return api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function logoutAPI() {
  return api('/auth/logout', { method: 'POST' });
}

export function getMe() {
  return api('/encoder/me');
}

export function getEncoderBarangays() {
  return api('/encoder/barangays');
}

export function getRecords(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/encoder/records${qs ? `?${qs}` : ''}`);
}

export function getRecord(id) {
  return api(`/encoder/records/${id}`);
}

export function createRecord(payload) {
  return api('/encoder/records', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateRecord(id, payload) {
  return api(`/encoder/records/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteRecord(id) {
  return api(`/encoder/records/${id}`, { method: 'DELETE' });
}

export function getStats(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/encoder/stats${qs ? `?${qs}` : ''}`);
}

export function submitRecord(id) {
  return api(`/encoder/records/${id}/submit`, { method: 'PATCH' });
}

export function getAdminMe() {
  return api('/admin/me');
}

export function getAdminMunicipalities() {
  return api('/admin/municipalities');
}

export function getAdminUsers(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/users${qs ? `?${qs}` : ''}`);
}

export function createAdminUser(payload) {
  return api('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateAdminUser(id, payload) {
  return api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function getAdminRecords(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/records${qs ? `?${qs}` : ''}`);
}

export function getAdminRecord(id) {
  return api(`/admin/records/${id}`);
}

export function reviewAdminRecord(id, payload) {
  return api(`/admin/records/${id}/review`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function getAdminStats() {
  return api('/admin/stats');
}

export function getDataQuality() {
  return api('/admin/data-quality');
}

export function getAdminSupplyDemand() {
  return api('/admin/supply-demand');
}

export function getAdminTrends() {
  return api('/admin/trends');
}

export function createReport(payload) {
  return api('/admin/reports', { method: 'POST', body: JSON.stringify(payload) });
}

export function getReports(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/reports${qs ? `?${qs}` : ''}`);
}

export function getReport(id) {
  return api(`/admin/reports/${id}`);
}

export function getReportDownloadUrl(id) {
  return `/api/admin/reports/${id}/download`;
}

export function deleteReport(id) {
  return api(`/admin/reports/${id}`, { method: 'DELETE' });
}

export function getInsight() {
  return api('/admin/insight');
}

export function runForecast(payload) {
  return api('/admin/forecast/run', { method: 'POST', body: JSON.stringify(payload) });
}

export function getForecastRuns(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/forecast/runs${qs ? `?${qs}` : ''}`);
}

export function getForecastResult(runId) {
  return api(`/admin/forecast/runs/${runId}`);
}

export function getMunicipalityOutlook() {
  return api('/admin/forecast/municipality-outlook');
}
