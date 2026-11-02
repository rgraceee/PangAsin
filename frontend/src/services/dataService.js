// WHAT: Lahat ng API calls at dashboard cache sa isang lugar.
// WHY: Para hindi paulit-ulit ang fetch logic sa bawat component, at may cache
//      ang public dashboard data kaya hindi nagre-request tuwing may render.
let dashboardCache = { municipalities: [], production: { provinceTotalMT: 0, records: [] }, demographics: { provinceWide: {}, byMunicipality: {} }, supplyDemand: null };

async function apiNoAuth(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(path, { ...options, headers, credentials: 'include' });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {};
  if (!res.ok) {
    const err = new Error(
      data.error || (res.status >= 500 ? 'Server error. Please try again later.' : 'Request failed')
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function loadPublicDashboardData() {
  const data = await apiNoAuth('/api/public/dashboard');
  dashboardCache = data;
  return data;
}

export function invalidateDashboardCache() {
  dashboardCache = {
    municipalities: [],
    production: { provinceTotalMT: 0, records: [] },
    demographics: { provinceWide: {}, byMunicipality: {} },
    supplyDemand: null,
  };
}

export function getMunicipalityProduction() {
  /* WHAT: Number() coercion dahil string ang productionMT mula sa API.
     WHY: kung hindi, nagko-concatenate ang reduce at NaN ang percentageOfTotal. */
  const sorted = [...(dashboardCache.municipalities || [])].sort((a, b) => Number(b.productionMT) - Number(a.productionMT));
  const total = sorted.reduce((sum, m) => sum + Number(m.productionMT || 0), 0);
  return sorted.map((m) => ({
    ...m,
    percentageOfTotal: total > 0 ? (Number(m.productionMT) / total) * 100 : 0,
  }));
}

export function getSupplyDemand(scope) {
  const sd = dashboardCache.supplyDemand || {};
  if (scope === 'philippines') {
    const ph = sd.philippines || {};
    return {
      labels: ['National Demand', 'Domestic Supply', 'Imported Salt'],
      values: [ph.demand || 0, ph.domesticSupply || 0, ph.imports || 0],
      unit: 'Metric Tons (MT)',
      note: 'Compiled from database demand benchmarks',
    };
  }
  const pa = sd.pangasinan || {};
  return {
    labels: ['Pangasinan Supply', 'Demand Benchmark'],
    values: [pa.localSupply || 0, pa.demandBenchmark || 0],
    unit: 'Metric Tons (MT)',
    period: pa.localSupplyPeriod || null,
    note: pa.localSupplyPeriod
      ? `Workbook-derived production data for ${pa.localSupplyPeriod.start} through ${pa.localSupplyPeriod.end}; compared with an annual demand benchmark.`
      : 'No municipality production period is available.',
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

export function getDemographicsByMunicipality() {
  return (dashboardCache.demographics && dashboardCache.demographics.byMunicipality) || {};
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(`/api${path}`, { ...options, headers, credentials: 'include' });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {};
  if (!res.ok) {
    const err = new Error(
      data.error || data.errors?.join(', ') || (res.status >= 500 ? 'Server error. Please try again later.' : 'Request failed')
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function loginAPI(email, password) {
  return api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

/* WHAT: Humihingi ng password reset link sa email.
   WHY: Generic ang response ng backend para hindi malaman kung registered
        ang email; dito lang din dumadaan ang validate at confirm steps. */
export function requestPasswordReset(email) {
  return apiNoAuth('/api/auth/password-reset-request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function validatePasswordResetToken(token) {
  return apiNoAuth(
    `/api/auth/password-reset/validate?token=${encodeURIComponent(token)}`,
  );
}

export function resetPassword(token, newPassword, confirmPassword) {
  return apiNoAuth('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({
      token,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
}

export function logoutAPI() {
  return api('/auth/logout', { method: 'POST' });
}

export function getMe() {
  return api('/auth/me');
}

export function changePassword(currentPassword, newPassword) {
  return api('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export function getEncoderBarangays() {
  return api('/encoder/barangays');
}

export function createEncoderBarangay(name) {
  return api('/encoder/barangays', { method: 'POST', body: JSON.stringify({ name }) });
}

export function getEncoderEnvironmentReports() {
  return api('/encoder/environment-reports');
}

export function createEncoderEnvironmentReport(payload) {
  return api('/encoder/environment-reports', { method: 'POST', body: JSON.stringify(payload) });
}

export function getEncoderProducerReports() {
  return api('/encoder/producer-reports');
}

export function createEncoderProducerReport(payload) {
  return api('/encoder/producer-reports', { method: 'POST', body: JSON.stringify(payload) });
}

export function getProducers(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/producers${qs ? `?${qs}` : ''}`);
}

export function createProducer(payload) {
  return api('/producers', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateProducer(id, payload) {
  return api(`/producers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteProducer(id) {
  return api(`/producers/${id}`, { method: 'DELETE' });
}

export function getEncoderMonths() {
  return api('/encoder/months');
}

export function getAdminMonths(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/months${qs ? `?${qs}` : ''}`);
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

export function getAdminMe() {
  return api('/admin/me');
}

export function getAdminMunicipalities() {
  return api('/admin/municipalities');
}

/* WHAT: Shared, cached active-municipality directory for filters and maps.
   WHY: Every page must read the same database-managed list, so one cache keeps
        the labels, counts and map highlights in sync and avoids refetching. */
let municipalityDirectoryCache = null;
let municipalityDirectoryPromise = null;

export function getPublicMunicipalities({ force = false } = {}) {
  if (!force && municipalityDirectoryCache) {
    return Promise.resolve(municipalityDirectoryCache);
  }
  if (!force && municipalityDirectoryPromise) {
    return municipalityDirectoryPromise;
  }
  municipalityDirectoryPromise = apiNoAuth('/api/public/municipalities')
    .then((data) => {
      municipalityDirectoryCache = data;
      return data;
    })
    .finally(() => {
      municipalityDirectoryPromise = null;
    });
  return municipalityDirectoryPromise;
}

export function invalidateMunicipalityDirectory() {
  municipalityDirectoryCache = null;
  municipalityDirectoryPromise = null;
}

export function createAdminMunicipality(payload) {
  return api('/admin/municipalities', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateAdminMunicipality(id, payload) {
  return api(`/admin/municipalities/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteAdminMunicipality(id, payload) {
  return api(`/admin/municipalities/${id}`, { method: 'DELETE', body: JSON.stringify(payload) });
}

async function apiUpload(path, formData) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.errors?.join(', ') || 'Upload failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function uploadAdminMunicipalityGeojson(id, file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload(`/admin/municipalities/${id}/geojson`, formData);
}

export function deleteAdminMunicipalityGeojson(id) {
  return api(`/admin/municipalities/${id}/geojson`, { method: 'DELETE' });
}

export function renameAdminBarangay(id, name) {
  return api(`/admin/barangays/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export function deleteAdminBarangay(id) {
  return api(`/admin/barangays/${id}`, { method: 'DELETE' });
}

export function getAdminAuditLogs(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
}

export function getAdminBarangays() {
  return api('/admin/barangays');
}

export function getAdminUsers(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/users${qs ? `?${qs}` : ''}`);
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

export function getAdminEnvironmentReports(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/environment-reports${qs ? `?${qs}` : ''}`);
}

export function reviewAdminEnvironmentReport(id, payload) {
  return api(`/admin/environment-reports/${id}/review`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function getAdminProducerReports(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/producer-reports${qs ? `?${qs}` : ''}`);
}

export function reviewAdminProducerReport(id, payload) {
  return api(`/admin/producer-reports/${id}/review`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function getAdminStats(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/stats${qs ? `?${qs}` : ''}`);
}

export function getDataQuality(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/data-quality${qs ? `?${qs}` : ''}`);
}

export function getAdminSupplyDemand() {
  return api('/admin/supply-demand');
}

export function getAdminTrends(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/trends${qs ? `?${qs}` : ''}`);
}

export function getAdminDescriptive(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/analytics/descriptive${qs ? `?${qs}` : ''}`);
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

export function getReportDownloadUrl(id, format) {
  const base = `/api/admin/reports/${id}/download`;
  return format ? `${base}?format=${format}` : base;
}

export function deleteReport(id) {
  return api(`/admin/reports/${id}`, { method: 'DELETE' });
}

export function getForecastRuns(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/admin/forecast/runs${qs ? `?${qs}` : ''}`);
}

export function getMunicipalityOutlook() {
  return api('/admin/forecast/municipality-outlook');
}

export function evaluateTarget(payload) {
  return api('/admin/forecast/evaluate-target', { method: 'POST', body: JSON.stringify(payload) });
}

// WHAT: SuperAdmin API functions for user management, audit logs, and login events.
// WHY: SuperAdmin needs dedicated endpoints for managing users, viewing audit
//      logs, and viewing login events - all separate from regular admin functions.

export function getSuperAdminUsers(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/superadmin/users${qs ? `?${qs}` : ''}`);
}

export function createSuperAdminUser(data) {
  return api('/superadmin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deactivateUser(userId, reason) {
  return api(`/superadmin/users/${userId}/deactivate`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function reactivateUser(userId, reason) {
  return api(`/superadmin/users/${userId}/reactivate`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function resetSuperAdminPassword(userId, reason) {
  return api(`/superadmin/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function changeUserMunicipality(userId, municipalityId, reason) {
  return api(`/superadmin/users/${userId}/municipality`, {
    method: 'POST',
    body: JSON.stringify({ municipality_id: municipalityId, reason }),
  });
}

export function forceLogoutUser(userId, reason) {
  return api(`/superadmin/users/${userId}/force-logout`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function unlockUser(userId, reason) {
  return api(`/superadmin/users/${userId}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function getAuditLog(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/superadmin/audit-log${qs ? `?${qs}` : ''}`);
}

export function getLoginEvents(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(`/superadmin/login-events${qs ? `?${qs}` : ''}`);
}

/* WHAT: SuperAdmin governance API — content, settings, announcement, records
   soft-delete and CSV export. WHY: SuperAdmin manages editable content,
   runtime settings, the announcement banner, and record retention. */
export function getSuperAdminSettings() {
  return api('/settings');
}
export function putSuperAdminSetting(key, value) {
  return api(`/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}
export function getSuperAdminContent(key) {
  return api(`/content/${key}`);
}
export function getPublicContent(key) {
  return api(`/content/${key}`);
}
export function putSuperAdminContent(key, data) {
  return api(`/content/${key}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
export function resetSuperAdminContent(key) {
  return api(`/content/${key}/reset`, {
    method: 'POST',
  });
}
export function getHelpFaqs(publicOnly = false) {
  return api(`/help-faqs${publicOnly ? '?public=1' : ''}`);
}
export function createHelpFaq(data) {
  return api(`/help-faqs`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
export function updateHelpFaq(id, data) {
  return api(`/help-faqs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
export function deleteHelpFaq(id) {
  return api(`/help-faqs/${id}`, {
    method: 'DELETE',
  });
}
export function reorderHelpFaqs(items) {
  return api(`/help-faqs/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}
export function getSuperAdminAnnouncement() {
  return api('/announcement');
}
export function putSuperAdminAnnouncement(payload) {
  return api('/announcement', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
export function exportRecords(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return downloadBlob(`/superadmin/export/records${qs ? `?${qs}` : ''}`);
}
export function softDeleteRecord(id, reason) {
  return api(`/superadmin/records/${id}/soft-delete`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
export function restoreRecord(id) {
  return api(`/superadmin/records/${id}/restore`, { method: 'POST' });
}

export function editRecord(id, data) {
  return api(`/superadmin/records/${id}/edit`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function permanentDeleteRecord(id, confirmText) {
  return api(`/superadmin/records/${id}/permanent-delete`, {
    method: 'DELETE',
    body: JSON.stringify({ confirm_text: confirmText }),
  });
}

export function exportCsv(type, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return downloadBlob(`/superadmin/export/csv/${type}${qs ? `?${qs}` : ''}`);
}

export function downloadBlob(path) {
  return fetch(`/api${path}`, {
    method: 'GET',
    credentials: 'include',
  }).then(async (res) => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.error || 'Download failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return res.blob();
  });
}

export function downloadBackup() {
  return downloadBlob(`/superadmin/export/backup`);
}

export function getSuperAdminHealth() {
  return api('/superadmin/health');
}

export function runSuperAdminForecast() {
  return api('/superadmin/forecast/run', {
    method: 'POST',
  });
}

export function getSuperAdminSmtp() {
  return api('/superadmin/smtp');
}

export function sendSmtpTest() {
  return api('/superadmin/smtp/test', {
    method: 'POST',
  });
}

