import React, { useEffect, useMemo, useState } from 'react';
import { Form, Modal } from 'react-bootstrap';
import { BarChart3, Download, LineChart as LineIcon, PieChart as PieIcon, RefreshCw, Search, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getAdminMunicipalities, previewReport } from '../../services/dataService';
import { displayHeader } from '../../constants/labels';
import PageHeader from './PageHeader';

const COLORS = ['#16803c', '#2878b8', '#e58a23', '#8956b3', '#d04f58', '#16a6a1', '#6c757d'];

const PERIODS = [
  ['all', 'All records'],
  ['q1', 'Q1 (Jan-Mar)'],
  ['q2', 'Q2 (Apr-Jun)'],
  ['q3', 'Q3 (Jul-Sep)'],
  ['q4', 'Q4 (Oct-Dec)'],
  ['monthly', 'Monthly trend'],
  ['custom', 'Custom date range'],
];

const METRIC_OPTIONS = [
  ['production_volume_mt', 'Salt production (metric tons)'],
  ['area_per_salt_bed', 'Area per salt bed'],
  ['num_salt_beds', 'Salt beds'],
  ['registered_salt_farmers', 'Registered salt farmers'],
  ['male_salt_farmers', 'Male salt farmers'],
  ['female_salt_farmers', 'Female salt farmers'],
  ['record_count', 'Production records'],
];

const CATEGORY_OPTIONS = [
  ['municipality', 'Municipality'],
  ['barangay', 'Barangay'],
  ['production_method', 'Production method'],
  ['status', 'Record status'],
];

const DISTRIBUTION_OPTIONS = [
  ['production_method', 'Production method'],
  ['sex', 'Sex'],
  ['municipality', 'Municipality'],
  ['barangay', 'Barangay'],
  ['status', 'Record status'],
];

const CONTENT_DISTRIBUTION_OPTIONS = {
  production: [
    ['production_method', 'Production method'],
    ['municipality', 'Municipality'],
    ['barangay', 'Barangay'],
    ['status', 'Record status'],
  ],
  producers: [
    ['sex', 'Sex'],
    ['municipality', 'Municipality'],
    ['barangay', 'Barangay'],
    ['production_method', 'Production method'],
  ],
  environment: [
    ['municipality', 'Municipality'],
    ['barangay', 'Barangay'],
    ['facility_type', 'Facility type'],
    ['status', 'Status'],
  ],
};

const CONTENT_METRIC_OPTIONS = {
  production: METRIC_OPTIONS,
  producers: [
    ['record_count', 'Salt farmer records'],
    ['age', 'Age'],
  ],
  environment: [
    ['record_count', 'Environment records'],
    ['salt_farm_count', 'Salt farms'],
    ['facility_count', 'Facilities'],
  ],
};

function rowsFromPreview(data) {
  if (Array.isArray(data?.production_records)) return data.production_records;
  if (Array.isArray(data?.by_municipality)) return data.by_municipality;
  if (Array.isArray(data?.producers)) return data.producers;
  return [];
}

function dateValue(row) {
  const value = row.record_date || row.created_at || row.submitted_at || '';
  return String(value).slice(0, 10);
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function quarterForDate(value) {
  const month = Number(String(value).slice(5, 7));
  if (month >= 1 && month <= 3) return 'q1';
  if (month >= 4 && month <= 6) return 'q2';
  if (month >= 7 && month <= 9) return 'q3';
  if (month >= 10 && month <= 12) return 'q4';
  return '';
}

function escapeSvgText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function graphSvg(graph) {
  const dataLength = (graph.chartData || []).length;
  const width = dataLength > 8 ? 1200 : 960;
  const height = 620;
  const margin = { top: 72, right: 35, bottom: 130, left: 75 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const data = graph.chartData || [];
  const maxValue = Math.max(...data.map((item) => Number(item.value) || 0), 1);
  const legend = data.map((item) => escapeSvgText(item.name)).join(' | ');
  const scopeLabel = escapeSvgText(`${graph.municipalityName || 'All municipalities'} | ${String(graph.period || '').toUpperCase()} ${graph.year || ''}`);

  if (graph.chartType === 'pie') {
    const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const cx = 470;
    const cy = 270;
    const radius = 155;
    let angle = -Math.PI / 2;
    const slices = data.map((item, index) => {
      const value = Number(item.value || 0);
      const next = angle + (total ? (value / total) * Math.PI * 2 : 0);
      const x1 = cx + radius * Math.cos(angle);
      const y1 = cy + radius * Math.sin(angle);
      const x2 = cx + radius * Math.cos(next);
      const y2 = cy + radius * Math.sin(next);
      const large = next - angle > Math.PI ? 1 : 0;
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
      angle = next;
      return `<path d="${path}" fill="${COLORS[index % COLORS.length]}" stroke="#fff" stroke-width="2"/>`;
    }).join('');
    const labels = data.map((item, index) => `<rect x="${700}" y="${155 + index * 24}" width="12" height="12" fill="${COLORS[index % COLORS.length]}"/><text x="${720}" y="${166 + index * 24}" font-size="13">${escapeSvgText(item.name)}: ${Number(item.value).toLocaleString()}</text>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><text x="35" y="38" font-size="22" font-weight="700" fill="#20362a">${escapeSvgText(graph.title)}</text><text x="35" y="58" font-size="13" fill="#66756c">${scopeLabel}</text>${slices}${labels}</svg>`;
  }

  const yTicks = Array.from({ length: 5 }, (_, index) => maxValue * index / 4);
  const grid = yTicks.map((tick) => {
    const y = margin.top + plotHeight - (tick / maxValue) * plotHeight;
    return `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#dfe7e2"/><text x="${margin.left - 12}" y="${y + 4}" text-anchor="end" font-size="12" fill="#66756c">${Number(tick).toLocaleString(undefined, { maximumFractionDigits: 1 })}</text>`;
  }).join('');
  const points = data.map((item, index) => ({
    x: margin.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth),
    value: Number(item.value || 0),
  }));
  const coordinates = points.map((point, index) => `${point.x},${margin.top + plotHeight - (point.value / maxValue) * plotHeight}`).join(' ');
  const labels = data.map((item, index) => {
    const slot = data.length ? plotWidth / data.length : plotWidth;
    const x = graph.chartType === 'bar'
      ? margin.left + slot * index + slot / 2
      : data.length === 1 ? margin.left + plotWidth / 2 : margin.left + (index / (data.length - 1)) * plotWidth;
    return `<text x="${x}" y="${height - 64}" text-anchor="end" transform="rotate(-35 ${x} ${height - 64})" font-size="11" fill="#66756c">${escapeSvgText(item.name)}</text>`;
  }).join('');
  if (graph.chartType === 'bar') {
    const slot = data.length ? plotWidth / data.length : plotWidth;
    const bars = data.map((item, index) => {
      const barWidth = Math.min(52, slot * 0.62);
      const barHeight = ((Number(item.value) || 0) / maxValue) * plotHeight;
      const x = margin.left + slot * index + (slot - barWidth) / 2;
      const y = margin.top + plotHeight - barHeight;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="#16803c"/>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><text x="35" y="38" font-size="22" font-weight="700" fill="#20362a">${escapeSvgText(graph.title)}</text><text x="35" y="58" font-size="13" fill="#66756c">${scopeLabel}</text>${grid}<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#64748b"/><line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#64748b"/>${bars}</svg>`;
  }
  const linePoints = points.map((point) => {
    const y = margin.top + plotHeight - (point.value / maxValue) * plotHeight;
    return `<circle cx="${point.x}" cy="${y}" r="4" fill="#16803c"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><text x="35" y="38" font-size="22" font-weight="700" fill="#20362a">${escapeSvgText(graph.title)}</text><text x="35" y="58" font-size="13" fill="#66756c">${scopeLabel}</text>${grid}<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#64748b"/><line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#64748b"/><polyline points="${coordinates}" fill="none" stroke="#16803c" stroke-width="4"/>${linePoints}${labels}</svg>`;
}

export default function GenerateGraphs({ encoderMode = false, user = null }) {
  const [chartType, setChartType] = useState('line');
  const [content, setContent] = useState('production');
  const [period, setPeriod] = useState('monthly');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [metric, setMetric] = useState('production_volume_mt');
  const [category, setCategory] = useState('municipality');
  const [distribution, setDistribution] = useState('production_method');
  const [municipalities, setMunicipalities] = useState([]);
  const [municipalityId, setMunicipalityId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const storageKey = encoderMode ? 'pangasin.generatedGraphs.encoder' : 'pangasin.generatedGraphs.admin';
  const [savedGraphs, setSavedGraphs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch {
      return [];
    }
  });
  const [graphSearch, setGraphSearch] = useState('');
  const [saveGraphModal, setSaveGraphModal] = useState(false);
  const [graphName, setGraphName] = useState('');
  const [previewGraph, setPreviewGraph] = useState(null);

  useEffect(() => {
    if (encoderMode) return undefined;
    let cancelled = false;
    getAdminMunicipalities()
      .then((response) => {
        if (!cancelled) setMunicipalities(response?.municipalities || response || []);
      })
      .catch(() => {
        if (!cancelled) setMunicipalities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [encoderMode]);

  useEffect(() => {
    const validMetrics = CONTENT_METRIC_OPTIONS[content] || METRIC_OPTIONS;
    if (!validMetrics.some(([value]) => value === metric)) setMetric(validMetrics[0][0]);
    const validDistributions = CONTENT_DISTRIBUTION_OPTIONS[content] || DISTRIBUTION_OPTIONS;
    if (!validDistributions.some(([value]) => value === distribution)) setDistribution(validDistributions[0][0]);
  }, [content, metric, distribution]);

  const loadGraph = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        report_type: content,
        filters: content === 'producers' ? { view: 'farmers' } : {},
      };
      if (encoderMode && user?.municipality_id) payload.municipality_id = Number(user.municipality_id);
      if (!encoderMode && municipalityId) payload.municipality_id = Number(municipalityId);
      const result = await previewReport(payload);
      setRows(rowsFromPreview(result.data || {}));
    } catch (err) {
      setError(err.message || 'Could not load graph data.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => rows.filter((row) => {
    const value = dateValue(row);
    if (period === 'all') return true;
    if (period === 'custom') {
      return (!startDate || value >= startDate) && (!endDate || value <= endDate);
    }
    if (period.startsWith('q')) return quarterForDate(value) === period && (!value || value.slice(0, 4) === year);
    return !value || value.slice(0, 4) === year;
  }), [rows, period, startDate, endDate, year]);

  const chartData = useMemo(() => {
    if (chartType === 'line') {
      const grouped = {};
      filteredRows.forEach((row) => {
        const date = dateValue(row);
        const key = period === 'monthly' && date ? date.slice(0, 7) : (date ? date : 'No date');
        if (!grouped[key]) grouped[key] = { name: key, value: 0, records: 0 };
        grouped[key].value += metric === 'record_count' ? 1 : numericValue(row[metric]);
        grouped[key].records += 1;
      });
      return Object.values(grouped).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    const field = chartType === 'bar' ? category : distribution;
    const grouped = {};
    filteredRows.forEach((row) => {
      const raw = row[field];
      const key = raw === null || raw === undefined || raw === '' ? 'Not specified' : String(raw);
      if (!grouped[key]) grouped[key] = { name: key, value: 0 };
      grouped[key].value += chartType === 'pie' ? 1 : (metric === 'record_count' ? 1 : numericValue(row[metric]));
    });
    return Object.values(grouped).sort((a, b) => b.value - a.value);
  }, [filteredRows, chartType, metric, category, distribution, period]);

  const total = chartData.reduce((sum, item) => sum + numericValue(item.value), 0);
  const strongest = chartData.reduce((best, item) => (!best || item.value > best.value ? item : best), null);

  const saveGraph = () => {
    if (!chartData.length) return;
    const saved = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      chartType,
      content,
      period,
      year,
      municipalityId,
      municipalityName: municipalities.find((item) => String(item.id) === String(municipalityId))?.name || 'All municipalities',
      chartData,
      total,
      title: graphName.trim() || `${chartType === 'line' ? 'Line' : chartType === 'bar' ? 'Bar' : 'Pie'} - ${content === 'production' ? 'Salt production' : content === 'producers' ? 'Salt farmers' : 'Environment & facilities'}`,
    };
    const next = [saved, ...savedGraphs];
    setSavedGraphs(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSaveGraphModal(false);
  };

  const downloadGraph = (graph) => {
    const svg = graphSvg(graph);
    const filename = `${graph.title || 'salt-analytics-graph'}`
      .trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'salt-analytics-graph';
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = image.naturalWidth * scale;
      canvas.height = image.naturalHeight * scale;
      const context = canvas.getContext('2d');
      context.scale(scale, scale);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, image.naturalWidth, image.naturalHeight);
      context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      }, 'image/png', 1);
    };
    image.onerror = () => URL.revokeObjectURL(svgUrl);
    image.src = svgUrl;
  };

  const deleteSavedGraph = (id) => {
    const next = savedGraphs.filter((item) => item.id !== id);
    setSavedGraphs(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const filteredSavedGraphs = savedGraphs.filter((graph) => {
    const haystack = `${graph.title} ${graph.municipalityName} ${graph.period} ${graph.year}`.toLowerCase();
    return haystack.includes(graphSearch.trim().toLowerCase());
  });

  return (
    <div className="generate-graphs-page">
      <PageHeader
        id={encoderMode ? 'encoder-graphs' : 'admin-graphs'}
        variant="clean"
        className="ui-pageheader--admin ui-pageheader--no-map"
        eyebrow="Analytics"
        title="Generate Graphs"
        subtitle="Turn salt production, farmer, and location data into clear visual insights."
      />

      <section className="analytics-builder-card" aria-labelledby="analytics-builder-title">
        <div className="analytics-card-heading">
          <div>
            <span className="analytics-kicker">Graph setup</span>
            <h2 id="analytics-builder-title">Choose a useful view</h2>
          </div>
          <button type="button" className="analytics-refresh-btn" onClick={loadGraph} disabled={loading}>
            <RefreshCw size={17} className={loading ? 'is-spinning' : ''} />
            {loading ? 'Loading...' : 'Load data'}
          </button>
        </div>

        <div className="analytics-type-grid" role="group" aria-label="Graph type">
          {[
            ['line', 'Line', 'Track production over time', LineIcon],
            ['bar', 'Bar', 'Compare municipalities or categories', BarChart3],
            ['pie', 'Pie', 'Show distributions and share', PieIcon],
          ].map(([id, label, help, Icon]) => (
            <button
              key={id}
              type="button"
              className={`analytics-type-card${chartType === id ? ' is-active' : ''}`}
              aria-pressed={chartType === id}
              onClick={() => setChartType(id)}
            >
              <Icon size={22} />
              <span><strong>{label}</strong><small>{help}</small></span>
            </button>
          ))}
        </div>

        <div className="analytics-filter-grid">
          {!encoderMode && (
            <label>
              Municipality
              <select value={municipalityId} onChange={(event) => setMunicipityId(event.target.value)}>
                <option value="">All municipalities</option>
                {municipalities.map((municipality) => (
                  <option key={municipality.id} value={municipality.id}>{municipality.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Data
            <select value={content} onChange={(event) => setContent(event.target.value)}>
              <option value="production">Salt production</option>
              <option value="producers">Salt farmers</option>
              <option value="environment">Environment & facilities</option>
            </select>
          </label>
          <label>
            Reporting period
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {period !== 'all' && period !== 'custom' && (
            <label>
              Year
              <input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />
            </label>
          )}
          {chartType !== 'pie' && (
            <label>
              {chartType === 'line' ? 'Y value / measure' : 'Measure'}
              <select value={metric} onChange={(event) => setMetric(event.target.value)}>
                {(CONTENT_METRIC_OPTIONS[content] || METRIC_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          )}
          {chartType === 'bar' && (
            <label>
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          )}
          {chartType === 'pie' && (
            <label>
              Distribution column
              <select value={distribution} onChange={(event) => setDistribution(event.target.value)}>
                {(CONTENT_DISTRIBUTION_OPTIONS[content] || DISTRIBUTION_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          )}
        </div>

        {period === 'custom' && (
          <div className="analytics-custom-range">
            <label>From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <span>to</span>
            <label>To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          </div>
        )}
        {error && <div className="analytics-error" role="alert">{error}</div>}
      </section>

      <section className="analytics-result-card" aria-label="Generated graph">
        <div className="analytics-result-heading">
          <div>
            <span className="analytics-kicker">Visual result</span>
            <h2>{chartType === 'line' ? 'Production trend' : chartType === 'bar' ? 'Category comparison' : 'Data distribution'}</h2>
          </div>
          <div className="analytics-result-actions">
            <button
              type="button"
              className="analytics-print-btn"
              onClick={() => {
                setGraphName(`${chartType === 'line' ? 'Line' : chartType === 'bar' ? 'Bar' : 'Pie'} graph`);
                setSaveGraphModal(true);
              }}
              disabled={!chartData.length}
            >
              Save graph
            </button>
            <button
              type="button"
              className="analytics-print-btn"
              onClick={() => downloadGraph({
                title: graphName.trim() || `${chartType === 'line' ? 'Line' : chartType === 'bar' ? 'Bar' : 'Pie'} graph`,
                municipalityName: municipalities.find((item) => String(item.id) === String(municipalityId))?.name || 'All municipalities',
                period,
                year,
                chartType,
                chartData,
              })}
              disabled={!chartData.length}
            >
              <Download size={17} /> Download PNG
            </button>
          </div>
        </div>

        {chartData.length ? (
          <>
            <div className="analytics-chart-summary">
              <div><span>Total</span><strong>{total.toLocaleString()}</strong></div>
              <div><span>Highest category</span><strong>{strongest?.name || '-'}</strong></div>
              <div><span>Records analyzed</span><strong>{filteredRows.length}</strong></div>
              <div><span>Trend direction</span><strong>{chartData.length > 1 && chartData.at(-1).value >= chartData[0].value ? 'Increasing' : 'Review needed'}</strong></div>
            </div>
            <div className="analytics-chart print-area">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 20, right: 24, bottom: 20, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" name={displayHeader(metric)} stroke="#16803c" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={chartData} margin={{ top: 20, right: 24, bottom: 35, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-25} textAnchor="end" interval="preserveStartEnd" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" name={displayHeader(metric)} fill="#16803c" radius={[5, 5, 0, 0]} />
                  </BarChart>
                ) : (
                  <PieChart>
                    <Tooltip />
                    <Legend />
                    <Pie data={chartData} dataKey="value" nameKey="name" outerRadius="72%" label>
                      {chartData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="analytics-empty">
            <TrendingUp size={34} />
            <strong>No graph data loaded yet</strong>
            <p>Select the graph options and choose Load data.</p>
          </div>
        )}
      </section>

      <section className="analytics-saved-card" aria-label="Generated graphs">
        <div className="analytics-saved-heading">
          <div>
            <span className="analytics-kicker">Saved files</span>
            <h2>Generated graphs</h2>
          </div>
          <div className="analytics-saved-count">{savedGraphs.length} saved</div>
        </div>
        <div className="analytics-saved-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={graphSearch}
            onChange={(event) => setGraphSearch(event.target.value)}
            placeholder="Search saved graphs by name, municipality, period, or year"
            aria-label="Search generated graphs"
          />
        </div>
        {filteredSavedGraphs.length ? (
          <div className="analytics-saved-list">
            {filteredSavedGraphs.map((graph) => (
              <article className="analytics-saved-item" key={graph.id}>
                <div>
                  <strong>{graph.title}</strong>
                  <span>{graph.municipalityName} · {graph.period.toUpperCase()} {graph.year}</span>
                  <small>{new Date(graph.createdAt).toLocaleString()}</small>
                </div>
                <div className="analytics-saved-actions">
                  <button type="button" onClick={() => setPreviewGraph(graph)}>Preview</button>
                  <button type="button" onClick={() => downloadGraph(graph)}><Download size={16} /> Download</button>
                  <button type="button" className="analytics-delete-btn" onClick={() => deleteSavedGraph(graph.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="analytics-saved-empty">{savedGraphs.length ? 'No saved graphs match your search.' : 'Saved graphs will appear here.'}</div>
        )}
      </section>

      <Modal show={saveGraphModal} onHide={() => setSaveGraphModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Name this graph</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Label htmlFor="saved-graph-name">Graph name</Form.Label>
          <Form.Control id="saved-graph-name" value={graphName} onChange={(event) => setGraphName(event.target.value)} autoFocus />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="ui-btn-outline" onClick={() => setSaveGraphModal(false)}>Cancel</button>
          <button type="button" className="ui-btn-primary" disabled={!graphName.trim()} onClick={saveGraph}>Save graph</button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(previewGraph)} onHide={() => setPreviewGraph(null)} centered size="lg">
        {previewGraph && (
          <>
            <Modal.Header closeButton><Modal.Title>{previewGraph.title}</Modal.Title></Modal.Header>
            <Modal.Body>
              <p>{previewGraph.municipalityName} · {previewGraph.period.toUpperCase()} {previewGraph.year}</p>
              <div className="saved-graph-svg-preview" dangerouslySetInnerHTML={{ __html: graphSvg(previewGraph) }} />
            </Modal.Body>
            <Modal.Footer>
              <button type="button" className="ui-btn-outline" onClick={() => setPreviewGraph(null)}>Close</button>
              <button type="button" className="ui-btn-primary" onClick={() => downloadGraph(previewGraph)}>Download PNG</button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  );
}
