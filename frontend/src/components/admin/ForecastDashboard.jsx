import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Row, Col, Card, Spinner, Alert, Form, Badge, Button, Table } from 'react-bootstrap';
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
} from 'recharts';
import {
  ChartLine, ChartArea, ChartColumn, TrendingUp, Zap, BoxSelect, Building2,
  CalendarDays, Trophy, ClipboardList, Flag, Globe2, Boxes, ArrowUpRight, Activity, ShieldCheck,
} from 'lucide-react';
import { runForecast, getForecastRuns, getMunicipalityOutlook, getAdminMunicipalities, getAdminSupplyDemand } from '../../services/dataService';
import { BRAND, MUNICIPALITY_COLORS, STATUS } from '../../theme/colors';
import PageHeader from './PageHeader';

function readinessBadge(readiness) {
  const map = {
    ready: { variant: 'success', label: 'READY' },
    limited: { variant: 'warning', label: 'LIMITED' },
    not_ready: { variant: 'danger', label: 'NOT READY' },
  };
  const c = map[readiness] || map['not_ready'];
  return <Badge bg={c.variant} className="forecast-readiness-badge">{c.label}</Badge>;
}

function readinessReason(readiness) {
  if (readiness === 'ready') return 'Sufficient validated historical production records are available.';
  if (readiness === 'limited') return 'Only 12 months of validated production records are available. Forecast results should be interpreted with caution.';
  return 'Insufficient validated historical production records are available.';
}

function readinessAccent(readiness) {
  const map = {
    ready: STATUS.ready,
    limited: STATUS.warning,
    not_ready: STATUS.not_ready,
  };
  return map[readiness] || STATUS.not_ready;
}

function trendPill(direction) {
  const cls = direction === 'increasing' ? 'fc-trend-pill-up' : direction === 'declining' ? 'fc-trend-pill-down' : 'fc-trend-pill-flat';
  const icon = direction === 'increasing' ? '\u2191' : direction === 'declining' ? '\u2193' : '\u2192';
  const label = direction === 'increasing' ? 'Increasing' : direction === 'declining' ? 'Declining' : 'Stable';
  return <span className={`fc-trend-pill ${cls}`}><span style={{ fontSize: 13 }}>{icon}</span>{label}</span>;
}

function formatKg(val) {
  if (val === null || val === undefined) return '\u2014';
  return `${Math.round(val).toLocaleString()} kg`;
}

function formatMT(val) {
  if (val === null || val === undefined) return '\u2014';
  return `${Math.round(val).toLocaleString()} MT`;
}

function formatPct(val) {
  if (val === null || val === undefined) return '\u2014';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

function useCountUp(target, duration = 700) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const frameRef = useRef();

  useEffect(() => {
    const from = prevRef.current;
    const to = target || 0;
    if (from === to) return;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = from + (to - from) * eased;
      setDisplay(val);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}

function StatShell({ icon: Icon, title, children, support, accent }) {
  return (
    <Col md={3} sm={6}>
      <div className={`fc-stat fc-stat-accent-${accent}`}>
        <div className={`fc-stat-icon fc-stat-icon-${accent}`}><Icon size={19} strokeWidth={2} /></div>
        <div className="fc-stat-title">{title}</div>
        <div>{children}</div>
        <div className="fc-stat-support">{support}</div>
      </div>
    </Col>
  );
}

function AnimatedStat({ icon, title, value, support, accent, format }) {
  const raw = useCountUp(value);
  const formatted = format ? format(raw) : raw;
  return (
    <StatShell icon={icon} title={title} support={support} accent={accent}>
      <div className="fc-stat-value">{formatted}</div>
    </StatShell>
  );
}

function PlainStat({ icon, title, value, support, accent, className }) {
  return (
    <StatShell icon={icon} title={title} support={support} accent={accent}>
      <div className={`fc-stat-value ${className || ''}`}>{value}</div>
    </StatShell>
  );
}

function InsightCard({ title, icon: Icon, children, chip }) {
  return (
    <Col md={4}>
      <Card className="fc-card h-100" style={{ borderLeft: 'none' }}>
        <Card.Body className="fc-card-pad">
          <div className="fc-insight-head mb-3">
            <span className={`fc-insight-chip fc-insight-chip-${chip}`}><Icon size={16} strokeWidth={2} /></span>
            <h6 className="fc-insight-title">{title}</h6>
          </div>
          {children}
        </Card.Body>
      </Card>
    </Col>
  );
}

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined && p.name !== 'Previous forecast');
  const prev = payload.find((p) => p.name === 'Previous forecast');
  return (
    <div className="fc-tooltip">
      <div className="fc-tooltip-label">{label}</div>
      {rows.map((p, i) => (
        <div className="fc-tooltip-row" key={i}>
          <span>{p.name}</span>
          <b>{Math.round(p.value).toLocaleString()} kg</b>
        </div>
      ))}
      {prev && (
        <div className="fc-tooltip-row" style={{ color: '#b6c6e2' }}>
          <span>Prev forecast</span>
          <b>{Math.round(prev.value).toLocaleString()} kg</b>
        </div>
      )}
    </div>
  );
}

function computeInsights(currentRun, outlook, demandBenchmark) {
  const insights = {
    perMuni: [],
    seasonal: { peak: '\u2014', low: '\u2014', pattern: 'No forecast data available.' },
    ranking: { top: null, bottom: null },
    supplyDemand: { gap: 0, label: '\u2014', detail: 'No forecast data available.' },
    flags: { declining: [], growing: [] },
    regional: { total: '\u2014', detail: 'No forecast data available.' },
  };

  if (!currentRun) return insights;

  if (currentRun.points && currentRun.points.length > 0) {
    const forecastPoints = currentRun.points.filter((p) => p.is_forecast);

    const monthlyTotals = {};
    forecastPoints.forEach((p) => {
      const ym = p.period_label;
      if (!monthlyTotals[ym]) monthlyTotals[ym] = 0;
      monthlyTotals[ym] += p.predicted_value || 0;
    });

    const sortedMonths = Object.entries(monthlyTotals).sort((a, b) => b[1] - a[1]);
    if (sortedMonths.length > 0) {
      const peakMonth = sortedMonths[0][0];
      const lowMonth = sortedMonths[sortedMonths.length - 1][0];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const peakIdx = parseInt(peakMonth.split('-')[1], 10) - 1;
      const lowIdx = parseInt(lowMonth.split('-')[1], 10) - 1;
      insights.seasonal.peak = monthNames[peakIdx] || peakMonth;
      insights.seasonal.low = monthNames[lowIdx] || lowMonth;

      const dryMonths = [1, 2, 3, 4, 5, 6];
      const rainyMonths = [7, 8, 9, 10, 11, 12];
      const dryTotal = forecastPoints
        .filter((p) => dryMonths.includes(parseInt(p.period_label.split('-')[1], 10)))
        .reduce((s, p) => s + (p.predicted_value || 0), 0);
      const rainyTotal = forecastPoints
        .filter((p) => rainyMonths.includes(parseInt(p.period_label.split('-')[1], 10)))
        .reduce((s, p) => s + (p.predicted_value || 0), 0);
      if (dryTotal > rainyTotal) {
        insights.seasonal.pattern = `Dry season (Mar\u2013Jun) is expected to produce ${Math.round(dryTotal).toLocaleString()} kg vs ${Math.round(rainyTotal).toLocaleString()} kg in rainy season (Jul\u2013Dec).`;
      } else {
        insights.seasonal.pattern = `Rainy season (Jul\u2013Dec) is expected to produce ${Math.round(rainyTotal).toLocaleString()} kg vs ${Math.round(dryTotal).toLocaleString()} kg in dry season (Mar\u2013Jun).`;
      }
    }
  }

  if (currentRun.projected_total !== null && currentRun.projected_total !== undefined) {
    const projectedMT = currentRun.projected_total / 1000;
    if (demandBenchmark !== null && demandBenchmark !== undefined) {
      const gap = Math.round(projectedMT - demandBenchmark);
      const sign = gap >= 0 ? '+' : '';
      insights.supplyDemand.gap = gap;
      insights.supplyDemand.label = `${sign}${gap.toLocaleString()} MT`;
      insights.supplyDemand.detail = `Projected: ${Math.round(projectedMT).toLocaleString()} MT vs demand benchmark: ${demandBenchmark.toLocaleString()} MT.`;
    }
  }

  if (outlook && outlook.length > 0) {
    const withChange = outlook.filter((o) => o.expected_change_pct !== null && o.expected_change_pct !== undefined);
    if (withChange.length > 0) {
      const sorted = [...withChange].sort((a, b) => b.expected_change_pct - a.expected_change_pct);
      insights.ranking.top = sorted[0];
      insights.ranking.bottom = sorted[sorted.length - 1];
    }

    insights.flags.declining = outlook.filter((o) => o.trend_direction === 'declining' || (o.expected_change_pct !== null && o.expected_change_pct < -10));
    insights.flags.growing = outlook.filter((o) => o.expected_change_pct !== null && o.expected_change_pct > 15);

    insights.perMuni = outlook.map((o) => ({
      name: o.municipality_name,
      trend: o.trend_direction,
      change: o.expected_change_pct,
      readiness: o.readiness,
    }));
  }

  if (currentRun.projected_total !== null && currentRun.projected_total !== undefined) {
    insights.regional.total = `${Math.round(currentRun.projected_total / 1000).toLocaleString()} MT`;
    const demandGap = currentRun.projected_total / 1000 - demandBenchmark;
    if (demandGap >= 0) {
      insights.regional.detail = `Combined projected supply across all municipalities is expected to exceed the demand benchmark by ${Math.abs(Math.round(demandGap)).toLocaleString()} MT.`;
    } else {
      insights.regional.detail = `Combined projected supply across all municipalities falls short of the demand benchmark by ${Math.abs(Math.round(demandGap)).toLocaleString()} MT.`;
    }
  }

  return insights;
}

export default function ForecastDashboard() {
  const [municipalities, setMunicipalities] = useState([]);
  const [selectedMuni, setSelectedMuni] = useState('all');
  const [runs, setRuns] = useState([]);
  const [currentRun, setCurrentRun] = useState(null);
  const [outlook, setOutlook] = useState([]);
  const [demandBenchmark, setDemandBenchmark] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('line');
  const [showBand, setShowBand] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState(null);

  useEffect(() => {
    getAdminMunicipalities()
      .then((res) => setMunicipalities(res.municipalities || []))
      .catch(() => {});
    getMunicipalityOutlook()
      .then((res) => setOutlook(res.municipalities || []))
      .catch(() => {});
    getAdminSupplyDemand()
      .then((res) => setDemandBenchmark(res?.pangasinan?.demand_volume ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setCurrentRun(null);
    setSelectedRunId(null);
    setRuns([]);
    const params = selectedMuni !== 'all' ? { municipality_id: selectedMuni } : {};
    getForecastRuns(params)
      .then((res) => {
        const runsList = res.runs || [];
        setRuns(runsList);
        if (runsList.length > 0) {
          setCurrentRun(runsList[0]);
        } else {
          setCurrentRun(null);
        }
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [selectedMuni]);

  const handleRun = () => {
    setRunning(true);
    setError(null);
    const payload = {
      municipality_id: selectedMuni !== 'all' ? Number(selectedMuni) : null,
      forecast_horizon: 12,
    };
    runForecast(payload)
      .then((res) => {
        setCurrentRun(res.run);
        return getForecastRuns(selectedMuni !== 'all' ? { municipality_id: selectedMuni } : {});
      })
      .then((res) => setRuns(res.runs || []))
      .catch((err) => setError(err.message))
      .finally(() => setRunning(false));
  };

  const handleRunSelect = (id) => {
    const run = runs.find((r) => String(r.id) === String(id));
    if (run) {
      setCurrentRun(run);
      setSelectedRunId(String(run.id));
    }
  };

  const selectedRun = useMemo(() => runs.find((r) => String(r.id) === String(selectedRunId)) || runs[0] || null, [runs, selectedRunId]);
  const prevRun = useMemo(() => {
    if (!selectedRun) return null;
    const idx = runs.findIndex((r) => String(r.id) === String(selectedRun.id));
    return idx > 0 ? runs[idx - 1] : null;
  }, [runs, selectedRun]);

  const chartData = useMemo(() => {
    if (!currentRun || !currentRun.points) return [];
    return currentRun.points.map((p) => ({
      label: p.period_label,
      production: p.predicted_value,
      historical: p.is_forecast ? null : p.predicted_value,
      forecast: p.is_forecast ? p.predicted_value : null,
      lower: p.lower_bound,
      upper: p.upper_bound,
      isForecast: p.is_forecast,
    }));
  }, [currentRun]);

  const prevChartData = useMemo(() => {
    if (view === 'muni') return chartData;
    if (!prevRun || !prevRun.points) return chartData;
    const byLabel = {};
    prevRun.points.forEach((p) => {
      byLabel[p.period_label] = p;
    });
    return chartData.map((d) => {
      const pp = byLabel[d.label];
      return { ...d, prev_forecast: pp && pp.is_forecast ? pp.predicted_value : null };
    });
  }, [prevRun, chartData, view]);

  const muniChartData = useMemo(() => {
    return [...outlook]
      .map((o) => ({
        name: o.municipality_name,
        change: o.expected_change_pct ?? 0,
        trend: o.trend_direction || 'stable',
        readiness: o.readiness,
      }))
      .sort((a, b) => b.change - a.change);
  }, [outlook]);

  const muniBarColor = useCallback((trend) => {
    if (trend === 'increasing') return BRAND.green;
    if (trend === 'declining') return STATUS.not_ready;
    return BRAND.gold;
  }, []);

  const insights = useMemo(() => computeInsights(currentRun, outlook, demandBenchmark), [currentRun, outlook, demandBenchmark]);

  const muniName = useMemo(() => {
    if (selectedMuni === 'all') return 'All Municipalities';
    const m = municipalities.find((x) => String(x.id) === String(selectedMuni));
    return m ? m.name : 'Selected';
  }, [selectedMuni, municipalities]);

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const readiness = currentRun?.readiness || 'not_ready';
  const projectedKg = currentRun?.projected_total ?? 0;
  const projectedMT = projectedKg / 1000;

  return (
    <div>
      <PageHeader
        id="admin-forecast"
        variant="sub"
        title="Forecasting &amp; Production Outlook"
        subtitle="Province-wide and municipality-level production projections anchored to validated historical records."
        action={
          <Button className="admin-page-hero-btn" onClick={handleRun} disabled={running}>
            {running ? (
              <><Spinner as="span" animation="border" size="sm" className="me-2" />Forecasting&hellip;</>
            ) : (
              <><Zap size={16} strokeWidth={2.5} className="me-2" />Run Forecast</>
            )}
          </Button>
        }
      >
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="fc-muni">Municipality</label>
          <Form.Select id="fc-muni" className="admin-page-hero-select" value={selectedMuni} onChange={(e) => setSelectedMuni(e.target.value)}>
            <option value="all">All Municipalities</option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Form.Select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="fc-run">Forecast Run</label>
          <Form.Select id="fc-run" className="admin-page-hero-select" value={selectedRunId || ''} onChange={(e) => handleRunSelect(e.target.value)}>
            {!selectedRunId && <option value="">Latest run</option>}
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.municipality_name || 'All'} &middot; {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                {r.projected_total != null ? ` (${formatMT(r.projected_total / 1000)})` : ''}
              </option>
            ))}
          </Form.Select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="fc-period">Forecast Period</label>
          <Form.Control id="fc-period" className="admin-page-hero-input" value="12 months from latest record" readOnly disabled />
        </div>
      </PageHeader>

      <Card className="mb-3 fc-card" style={{ borderLeft: `4px solid ${readinessAccent(readiness)}` }}>
        <Card.Body className="d-flex align-items-center gap-3 flex-wrap">
          {readinessBadge(readiness)}
          <div>
            <div className="fw-bold">Forecast Readiness</div>
            <div className="text-muted small">{readinessReason(readiness)}</div>
          </div>
          <div className="ms-auto d-none d-md-flex align-items-center gap-2 text-muted small">
            <TrendingUp size={15} strokeWidth={2} /> <span>{muniName}</span>
          </div>
        </Card.Body>
      </Card>

      <Row className="g-3 mb-3">
        <AnimatedStat
          icon={Boxes}
          title="Projected Production"
          value={projectedMT}
          accent="ocean"
          support="in metric tons across the forecast period"
          format={(v) => formatMT(v)}
        />
        <AnimatedStat
          icon={ArrowUpRight}
          title="Expected Change"
          value={currentRun?.expected_change_pct ?? 0}
          accent="gold"
          support="vs the previous period"
          format={(v) => {
            const sign = v > 0 ? '+' : '';
            return `${sign}${v.toFixed(1)}%`;
          }}
        />
        <PlainStat
          icon={Activity}
          title="Trend Direction"
          accent="green"
          support={currentRun?.trend_direction ? `Trajectory: ${currentRun.trend_direction}` : 'Based on validated historical data'}
          value={currentRun ? trendIconLarge(currentRun.trend_direction) : '\u2014'}
          className="text-capitalize"
        />
        <PlainStat
          icon={ShieldCheck}
          title="Forecast Reliability"
          accent="purple"
          support="linked to available validated data"
          value={currentRun?.reliability || '\u2014'}
          className="text-capitalize"
        />
      </Row>

      {currentRun?.incomplete_tail && (
        <Alert variant="warning" className="mb-3">
          <strong>Partial current-year reporting.</strong>{' '}
          {currentRun.note || 'Recent months may be under-reported because the current year is still in progress. The forecast is anchored to the established seasonal pattern.'}
        </Alert>
      )}

      <Card className="fc-card mb-3">
        <Card.Body className="fc-card-pad">
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3">
            <div className="fc-card-title mb-0">
              <TrendingUp size={16} strokeWidth={2} />
              Historical vs Forecast Production
            </div>
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {view !== 'muni' && prevRun && (
                <span className="fc-prev-chip">
                  <span className="fc-prev-swatch" />
                  Prev run ({prevRun.created_at ? new Date(prevRun.created_at).toLocaleDateString() : '—'})
                </span>
              )}
              <div className="fc-segmented">
                <button className={`fc-segmented-btn ${view === 'line' ? 'active' : ''}`} onClick={() => setView('line')}>
                  <ChartLine size={14} strokeWidth={2} /> Line
                </button>
                <button className={`fc-segmented-btn ${view === 'area' ? 'active' : ''}`} onClick={() => setView('area')}>
                  <ChartArea size={14} strokeWidth={2} /> Area
                </button>
                <button className={`fc-segmented-btn ${view === 'muni' ? 'active' : ''}`} onClick={() => setView('muni')}>
                  <ChartColumn size={14} strokeWidth={2} /> Municipality
                </button>
              </div>
              {view !== 'muni' && (
                <button
                  className={`fc-segmented-btn ${showBand ? 'active' : ''}`}
                  style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: '0.35rem 0.7rem', background: showBand ? 'var(--gray-100)' : 'transparent' }}
                  onClick={() => setShowBand(!showBand)}
                  title="Toggle confidence band"
                >
                  <BoxSelect size={14} strokeWidth={2} /> Band
                </button>
              )}
            </div>
          </div>

          {!currentRun && (
            <div className="fc-empty">
              <Zap size={22} strokeWidth={2} />
              No forecast generated yet. Click <strong>Run Forecast</strong> to create one.
            </div>
          )}

          {currentRun && view !== 'muni' && (
            <div style={{ height: 420 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={prevChartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <defs>
                    <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND.ocean} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={BRAND.ocean} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fcAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND.ocean} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={BRAND.ocean} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ForecastTooltip />} />
                  <Legend />
                  {showBand && view === 'line' && (
                    <>
                      <Area type="monotone" dataKey="upper" stroke="none" fill="url(#forecastBand)" name="Upper bound" connectNulls />
                      <Area type="monotone" dataKey="lower" stroke="none" fill="url(#forecastBand)" name="Lower bound" connectNulls />
                    </>
                  )}
                  <Line type="monotone" dataKey="historical" stroke={BRAND.ocean} strokeWidth={3} dot={false} name="Historical" connectNulls isAnimationActive />
                  {view === 'line' && (
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke={BRAND.gold}
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      dot={false}
                      name="Forecast"
                      connectNulls
                      isAnimationActive
                    />
                  )}
                  {view === 'area' && (
                    <Area
                      type="monotone"
                      dataKey="forecast"
                      stroke={BRAND.gold}
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      fill="url(#fcAreaFill)"
                      dot={false}
                      name="Forecast"
                      connectNulls
                      isAnimationActive
                    />
                  )}
                  {prevRun && (
                    <Line
                      type="monotone"
                      dataKey="prev_forecast"
                      stroke="var(--gray-400)"
                      strokeWidth={2}
                      strokeDasharray="2 3"
                      dot={false}
                      name="Previous forecast"
                      connectNulls
                      isAnimationActive
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {currentRun && view === 'muni' && (
            <div style={{ height: 420 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={muniChartData} margin={{ top: 10, right: 20, bottom: 50, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-28} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} label={{ value: 'Expected change %', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="fc-tooltip">
                        <div className="fc-tooltip-label">{label}</div>
                        <div className="fc-tooltip-row"><span>Expected change</span><b>{formatPct(d.change)}</b></div>
                        <div className="fc-tooltip-row"><span>Trend</span><b>{trendPill(d.trend)}</b></div>
                        <div className="fc-tooltip-row"><span>Readiness</span><b><span className="text-capitalize">{d.readiness}</span></b></div>
                      </div>
                    );
                  }} />
                  <Legend />
                  <Bar dataKey="change" name="Expected change (%)" radius={[6, 6, 0, 0]} isAnimationActive>
                    {muniChartData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={muniBarColor(entry.trend)} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
              <div className="text-center text-muted small mt-2">
                Expected change in projected production by municipality. Bars shaded by forecast trend.
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      <h5 className="fw-bold mb-3">Forecast Insights &amp; Decision Support</h5>
      <Row className="g-3 mb-3">
        <InsightCard title="1 · Forecast per Municipality" icon={Building2} chip="ocean">
          {insights.perMuni.length === 0 ? (
            <p className="text-muted mb-0">No forecast data available. Run a forecast to see projected volumes per municipality.</p>
          ) : (
            <div className="small">
              {insights.perMuni.map((m) => (
                <div key={m.name} className="d-flex justify-content-between align-items-center mb-1 py-1 border-bottom">
                  <span className="fw-semibold">{m.name}</span>
                  <span className="d-flex align-items-center gap-2">{trendPill(m.trend)} {formatPct(m.change)}</span>
                </div>
              ))}
              {currentRun?.projected_total && (
                <p className="mt-2 mb-0 fw-semibold">Total projected: {formatKg(currentRun.projected_total)}</p>
              )}
            </div>
          )}
        </InsightCard>

        <InsightCard title="2 · Seasonal Trend" icon={CalendarDays} chip="gold">
          <div className="small">
            <div className="d-flex justify-content-between mb-1">
              <span className="text-muted">Peak production month</span>
              <strong>{insights.seasonal.peak}</strong>
            </div>
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">Lowest production month</span>
              <strong>{insights.seasonal.low}</strong>
            </div>
            <p className="mb-0 text-muted">{insights.seasonal.pattern}</p>
          </div>
        </InsightCard>

        <InsightCard title="3 · Municipality Ranking" icon={Trophy} chip="green">
          {insights.ranking.top ? (
            <div className="small">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted">Top performer</span>
                <strong className="text-success">{insights.ranking.top.municipality_name}</strong>
              </div>
              {insights.ranking.bottom && insights.ranking.bottom.municipality_id !== insights.ranking.top.municipality_id && (
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted">Needs attention</span>
                  <strong className="text-danger">{insights.ranking.bottom.municipality_name}</strong>
                </div>
              )}
              <p className="mb-0 mt-2 text-muted">
                Top {formatPct(insights.ranking.top.expected_change_pct)}
                {insights.ranking.bottom && insights.ranking.bottom.municipality_id !== insights.ranking.top.municipality_id ? ` \u00b7 Bottom ${formatPct(insights.ranking.bottom.expected_change_pct)}` : ''}
              </p>
            </div>
          ) : (
            <p className="text-muted mb-0">No ranking data available.</p>
          )}
        </InsightCard>

        <InsightCard
          title={`4 · Supply-Demand Gap${insights.supplyDemand.gap < 0 ? ' (shortfall)' : ''}`}
          icon={ClipboardList}
          chip={insights.supplyDemand.gap < 0 ? 'orange' : 'teal'}
        >
          <div className="small">
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">Projected gap</span>
              <strong style={{ color: insights.supplyDemand.gap < 0 ? STATUS.not_ready : BRAND.green }}>
                {insights.supplyDemand.label}
              </strong>
            </div>
            <p className="mb-0 text-muted">{insights.supplyDemand.detail}</p>
          </div>
        </InsightCard>

        <InsightCard title="5 · Growth / Decline Flags" icon={Flag} chip="purple">
          {insights.flags.declining.length === 0 && insights.flags.growing.length === 0 ? (
            <p className="text-muted mb-0">No early warning flags at this time.</p>
          ) : (
            <div className="small">
              {insights.flags.growing.length > 0 && (
                <div className="mb-2">
                  <strong className="text-success">Strong growth:</strong>
                  {insights.flags.growing.map((m) => (
                    <div key={m.municipality_id} className="ms-2 mt-1 d-flex justify-content-between border-bottom py-1">
                      <span>{m.municipality_name}</span>
                      <strong className="text-success">{formatPct(m.expected_change_pct)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {insights.flags.declining.length > 0 && (
                <div>
                  <strong className="text-danger">Declining:</strong>
                  {insights.flags.declining.map((m) => (
                    <div key={m.municipality_id} className="ms-2 mt-1 d-flex justify-content-between border-bottom py-1">
                      <span>{m.municipality_name}</span>
                      <strong className="text-danger">{formatPct(m.expected_change_pct)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </InsightCard>

        <InsightCard title="6 · Regional Outlook" icon={Globe2} chip="teal">
          <div className="small">
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">Total projected supply</span>
              <strong>{insights.regional.total}</strong>
            </div>
            <p className="mb-0 text-muted">{insights.regional.detail}</p>
          </div>
        </InsightCard>
      </Row>
    </div>
  );
}

function trendIconLarge(direction) {
  if (direction === 'increasing') return <><span style={{ color: BRAND.green }}>{'\u2191'}</span> Increasing</>;
  if (direction === 'declining') return <><span style={{ color: STATUS.not_ready }}>{'\u2193'}</span> Declining</>;
  return <>{'\u2192'} Stable</>;
}
