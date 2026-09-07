import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Row, Col, Card, Spinner, Alert, Form, Button } from 'react-bootstrap';
import {
  ComposedChart, Line, Area, Bar, BarChart, LabelList, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell, ReferenceArea, ReferenceLine, PieChart, Pie, AreaChart,
} from 'recharts';
import {
  ChartLine, ChartArea, ChartColumn, TrendingUp, Zap, BoxSelect,
  CalendarDays, Trophy, ClipboardList, Flag, Globe2, Boxes, ArrowUpRight, ArrowDownRight, Activity, ShieldCheck,
} from 'lucide-react';
import { runForecast, getForecastRuns, getMunicipalityOutlook, getAdminMunicipalities, getAdminSupplyDemand, getAdminTrends } from '../../services/dataService';
import { BRAND, STATUS } from '../../theme/colors';
import PageHeader from './PageHeader';

function trendPill(direction) {
  const cls = direction === 'increasing' ? 'fc-trend-pill-up' : direction === 'declining' ? 'fc-trend-pill-down' : 'fc-trend-pill-flat';
  const icon = direction === 'increasing' ? '\u2191' : direction === 'declining' ? '\u2193' : '\u2192';
  const label = direction === 'increasing' ? 'Increasing' : direction === 'declining' ? 'Declining' : 'Stable';
  return <span className={`fc-trend-pill ${cls}`}><span style={{ fontSize: 13 }}>{icon}</span>{label}</span>;
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

function InsightCard({ title, icon: Icon, children, chip, col }) {
  const colProps = { md: 4, ...(col || {}) };
  return (
    <Col {...colProps}>
      <Card className="fc-card h-100">
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

function SectionHeading({ icon: Icon, title, sub, chip }) {
  return (
    <div className="d-flex align-items-center gap-2 mb-3">
      <span className={`fc-insight-chip fc-insight-chip-${chip}`}><Icon size={16} strokeWidth={2} /></span>
      <div>
        <h6 className="fc-section-title mb-0">{title}</h6>
        {sub && <div className="fc-section-sub">{sub}</div>}
      </div>
    </div>
  );
}

function YoYBarLabel({ x, y, width, height, value }) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  const label = `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
  const pad = 7;
  if (num >= 0) {
    return (
      <text x={x + width + pad} y={y + height / 2} dy="0.35em" textAnchor="start" className="yoy-bar-label">
        {label}
      </text>
    );
  }
  return (
    <text x={x - pad} y={y + height / 2} dy="0.35em" textAnchor="end" className="yoy-bar-label">
      {label}
    </text>
  );
}

function YoyTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="fc-tooltip">
      <div className="fc-tooltip-label">{d.name}</div>
      <div className="fc-tooltip-row"><span>Current year</span><b>{d.current.toLocaleString()} MT</b></div>
      <div className="fc-tooltip-row"><span>Previous year</span><b>{d.previous.toLocaleString()} MT</b></div>
      <div className="fc-tooltip-row">
        <span>YoY change</span>
        <b>{d.changePct === null || d.changePct === undefined ? '\u2014' : formatPct(d.changePct)}</b>
      </div>
    </div>
  );
}

function yoyCaption(rows) {
  const withData = rows.filter((m) => m.changePct !== null && m.changePct !== undefined);
  if (withData.length === 0) return null;
  const top = [...withData].sort((a, b) => b.changePct - a.changePct)[0];
  const bottom = [...withData].sort((a, b) => a.changePct - b.changePct)[0];
  const bottomVerb = bottom.changePct < 0 ? 'declined most at' : 'grew the least at';
  if (bottom.name === top.name) {
    return (
      <div className="chart-caption">
        <b>{top.name}</b> led YoY growth at <b>{formatPct(top.changePct)}</b>.
      </div>
    );
  }
  return (
    <div className="chart-caption">
      <b>{top.name}</b> led YoY change at <b>{formatPct(top.changePct)}</b>
      {' '}· <b>{bottom.name}</b> {bottomVerb} <b>{formatPct(bottom.changePct)}</b>.
    </div>
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

function SeasonTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="fc-tooltip">
      <div className="fc-tooltip-label">{d.label}</div>
      <div className="fc-tooltip-row"><span>Projected</span><b>{Math.round(d.value).toLocaleString()} kg</b></div>
    </div>
  );
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function computeInsights(currentRun, outlook, demandBenchmark) {
  const insights = {
    seasonal: { peak: '\u2014', low: '\u2014', pattern: 'No forecast data available.', series: [] },
    ranking: { top: null, bottom: null },
    supplyDemand: { gap: 0, label: '\u2014', detail: 'No forecast data available.', pct: null },
    flags: { declining: [], growing: [] },
    regional: { total: '\u2014', detail: 'No forecast data available.', pct: null },
  };

  if (!currentRun) return insights;

  if (currentRun.points && currentRun.points.length > 0) {
    const forecastPoints = currentRun.points.filter((p) => p.is_forecast);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
      const peakIdx = parseInt(peakMonth.split('-')[1], 10) - 1;
      const lowIdx = parseInt(lowMonth.split('-')[1], 10) - 1;
      insights.seasonal.peak = monthNames[peakIdx] || peakMonth;
      insights.seasonal.low = monthNames[lowIdx] || lowMonth;
    }

    insights.seasonal.series = forecastPoints
      .map((p) => {
        const month = parseInt(p.period_label.split('-')[1], 10);
        return {
          month,
          label: monthNames[month - 1] || p.period_label,
          value: p.predicted_value || 0,
        };
      })
      .filter((p) => p.month >= 1 && p.month <= 12)
      .sort((a, b) => a.month - b.month);
  }

  if (currentRun.projected_total !== null && currentRun.projected_total !== undefined) {
    const projectedMT = currentRun.projected_total / 1000;
    if (demandBenchmark !== null && demandBenchmark !== undefined && demandBenchmark > 0) {
      const gap = Math.round(projectedMT - demandBenchmark);
      const sign = gap >= 0 ? '+' : '';
      insights.supplyDemand.gap = gap;
      insights.supplyDemand.label = `${sign}${gap.toLocaleString()} MT`;
      insights.supplyDemand.detail = `Projected: ${Math.round(projectedMT).toLocaleString()} MT vs demand benchmark: ${demandBenchmark.toLocaleString()} MT.`;
      insights.supplyDemand.pct = (projectedMT / demandBenchmark) * 100;
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
  }

  if (currentRun.projected_total !== null && currentRun.projected_total !== undefined) {
    insights.regional.total = `${Math.round(currentRun.projected_total / 1000).toLocaleString()} MT`;
    if (demandBenchmark !== null && demandBenchmark !== undefined && demandBenchmark > 0) {
      insights.regional.pct = ((currentRun.projected_total / 1000) / demandBenchmark) * 100;
    }
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
  const [yoyRows, setYoyRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('line');
  const [showBand, setShowBand] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [annualTarget, setAnnualTarget] = useState('');

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
    getAdminTrends()
      .then((res) => setYoyRows(res.municipalities || []))
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
    const monthlyTarget = annualTarget && Number(annualTarget) > 0 ? Number(annualTarget) / 12 : null;
    return currentRun.points.map((p) => ({
      label: p.period_label,
      production: p.predicted_value,
      historical: p.is_forecast ? null : p.predicted_value,
      forecast: p.is_forecast ? p.predicted_value : null,
      lower: p.lower_bound,
      upper: p.upper_bound,
      isForecast: p.is_forecast,
      target: monthlyTarget != null && p.is_forecast ? monthlyTarget : null,
    }));
  }, [currentRun, annualTarget]);

  const prevChartData = useMemo(() => {
    if (!prevRun || !prevRun.points) return chartData;
    const byLabel = {};
    prevRun.points.forEach((p) => {
      byLabel[p.period_label] = p;
    });
    return chartData.map((d) => {
      const pp = byLabel[d.label];
      return { ...d, prev_forecast: pp && pp.is_forecast ? pp.predicted_value : null };
    });
  }, [prevRun, chartData]);

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

  const targetInsight = useMemo(() => {
    const target = annualTarget && Number(annualTarget) > 0 ? Number(annualTarget) : null;
    if (!target || !currentRun) return null;
    const projected = currentRun.projected_total || 0;
    const projectedMT = projected / 1000;
    const monthlyTarget = target / 12;
    const totalForecast = currentRun.points
      ? currentRun.points.filter((p) => p.is_forecast).reduce((s, p) => s + (p.predicted_value || 0), 0)
      : 0;
    const totalForecastMT = totalForecast / 1000;
    const diff = totalForecastMT - target;
    const sign = diff >= 0 ? '+' : '';
    const achievable = diff >= 0;
    const trend = currentRun.trend_direction || 'stable';
    const seasonalNote = insights.seasonal.peak !== '—'
      ? `Seasonally, ${insights.seasonal.low} tends to be the lowest-output month, while ${insights.seasonal.peak} is the peak.`
      : 'Seasonal pattern data is limited.';
    const trendNote = trend === 'declining'
      ? 'The forecast trend is declining, which may make the target harder to reach without intervention.'
      : trend === 'increasing'
      ? 'The forecast trend is increasing, supporting target achievability.'
      : 'The forecast trend is stable.';
    return {
      target,
      monthlyTarget,
      totalForecastMT,
      diff,
      achievable,
      text: `Annual target of ${target.toLocaleString()} MT (${monthlyTarget.toLocaleString()} MT/month). Projected forecast totals ${totalForecastMT.toLocaleString()} MT (${sign}${diff.toLocaleString()} MT vs target). ${trendNote} ${seasonalNote} Target looks ${achievable ? 'achievable' : 'challenging'}.`,
    };
  }, [annualTarget, currentRun, insights]);

  const yoyAbsMax = useMemo(() => {
    const peaks = yoyRows.map((m) => Math.abs(m.changePct || 0));
    return Math.max(1, ...peaks);
  }, [yoyRows]);

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const projectedKg = currentRun?.projected_total ?? 0;
  const projectedMT = projectedKg / 1000;

  const sdPct = insights.supplyDemand.pct;
  const sdBarPct = sdPct == null ? 0 : Math.max(0, Math.min(100, sdPct));
  const sdColor = insights.supplyDemand.gap < 0 ? STATUS.not_ready : BRAND.green;

  const gaugePct = insights.regional.pct == null ? 0 : Math.max(0, Math.min(100, insights.regional.pct));
  const gaugeData = [
    { value: gaugePct },
    { value: 100 - gaugePct },
  ];
  const gaugeFill = gaugePct >= 100 ? BRAND.green : gaugePct >= 80 ? BRAND.gold : STATUS.not_ready;

  return (
    <div>
      <PageHeader
        id="admin-forecast"
        variant="sub"
        title="Forecasting &amp; Production Outlook"
        subtitle="Province-wide and municipality-level production projections anchored to validated historical records."
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
          <label className="admin-page-hero-field" htmlFor="fc-target">Annual Target (MT)</label>
          <Form.Control
            id="fc-target"
            className="admin-page-hero-input"
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 5000"
            value={annualTarget}
            onChange={(e) => setAnnualTarget(e.target.value)}
          />
        </div>
      </PageHeader>

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

      {targetInsight && (
        <Alert variant="info" className="mb-3">
          <strong>Forecast vs. Target</strong>
          <div className="mt-2 small">{targetInsight.text}</div>
        </Alert>
      )}

      <div className="fc-province-band mb-3">
        <SectionHeading
          icon={Globe2}
          title="Province-wide outlook"
          sub="Independent of the municipality filter above."
          chip="teal"
        />
        <Row className="g-3">
          <InsightCard
            title={`Supply-Demand Gap${insights.supplyDemand.gap < 0 ? ' (shortfall)' : ''}`}
            icon={ClipboardList}
            chip={insights.supplyDemand.gap < 0 ? 'orange' : 'teal'}
            col={{ md: 6 }}
          >
            {currentRun ? (
              <div>
                <div className="fc-insight-stat" style={{ color: sdColor }}>
                  {insights.supplyDemand.label}
                </div>
                <div className="fc-insight-bar">
                  <div className="fc-insight-bar-fill" style={{ width: `${sdBarPct}%`, background: sdColor }} />
                </div>
                <div className="fc-insight-caption">
                  Supply covers {Math.round(sdBarPct)}% of the demand benchmark
                </div>
              </div>
            ) : (
              <p className="text-muted small mb-0">No forecast data available.</p>
            )}
          </InsightCard>

          <InsightCard title="Regional Outlook" icon={Globe2} chip="teal" col={{ md: 6 }}>
            {insights.regional.pct !== null && insights.regional.pct !== undefined && currentRun ? (
              <div className="d-flex align-items-center gap-3">
                <div className="fc-gauge">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={gaugeData} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={58} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                        <Cell fill={gaugeFill} />
                        <Cell fill="rgba(21,35,58,0.08)" />
                      </Pie>
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fc-gauge-centered">
                        {Math.min(999, Math.round(insights.regional.pct))}%
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div className="fc-gauge-label">% of demand met</div>
                  <div className="fc-insight-caption">
                    {insights.regional.total} projected supply
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted small mb-0">No forecast data available.</p>
            )}
          </InsightCard>
        </Row>
      </div>

      <SectionHeading
        icon={ChartLine}
        title="Production trajectory"
        sub="Forecast shape for the selected scope."
        chip="ocean"
      />
      <Row className="g-3 mb-3">
        <Col lg={12}>
          <Card className="fc-card h-100">
            <Card.Body className="fc-card-pad">
              <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3">
                <div className="fc-card-title mb-0">
                  <TrendingUp size={16} strokeWidth={2} />
                  Historical vs Forecast Production
                </div>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  {prevRun && (
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
                  </div>
                  <button
                    className={`fc-segmented-btn ${showBand ? 'active' : ''}`}
                    style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: '0.35rem 0.7rem', background: showBand ? 'var(--gray-100)' : 'transparent' }}
                    onClick={() => setShowBand(!showBand)}
                    title="Toggle confidence band"
                  >
                    <BoxSelect size={14} strokeWidth={2} /> Band
                  </button>
                </div>
              </div>

              {!currentRun && (
                <div className="fc-empty">
                  <Zap size={22} strokeWidth={2} />
                  No forecast generated yet. Click <strong>Run Forecast</strong> to create one.
                </div>
              )}

              {currentRun && (
                <div style={{ height: 380 }}>
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
                      {annualTarget && Number(annualTarget) > 0 && (
                        <Line
                          type="monotone"
                          dataKey="target"
                          stroke="#ef4444"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                          name="Target (monthly)"
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
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <InsightCard title="Seasonal Trend" icon={CalendarDays} chip="gold" col={{ lg: 12, md: 12 }}>
          {insights.seasonal.series.length > 1 ? (
            <div>
              <div style={{ height: 200 }} className="mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={insights.seasonal.series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fcSeasonFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BRAND.gold} stopOpacity={0.45} />
                        <stop offset="95%" stopColor={BRAND.gold} stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" vertical={false} />
                    <ReferenceArea x1={1} x2={6} fill="rgba(21,101,200,0.09)" />
                    <ReferenceArea x1={7} x2={12} fill="rgba(240,154,40,0.14)" />
                    <XAxis
                      type="number"
                      dataKey="month"
                      domain={[1, 12]}
                      ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
                      tickFormatter={(m) => MONTH_SHORT[m - 1] || m}
                      tick={{ fontSize: 11 }}
                      interval={0}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={44} />
                    <Tooltip content={<SeasonTooltip />} />
                    <Area type="monotone" dataKey="value" stroke={BRAND.gold} strokeWidth={2} fill="url(#fcSeasonFill)" dot={{ r: 3 }} isAnimationActive />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="fc-season-legend">
                <span className="fc-season-key fc-season-key-dry" /> <span className="fc-season-label">Dry ({'\u2013'}Jun)</span>
                <span className="fc-season-key fc-season-key-wet" /> <span className="fc-season-label">Rainy (Jul{'\u2013'}Dec)</span>
              </div>
              <div className="fc-insight-caption">
                Peak month {insights.seasonal.peak} {'\u00b7'} Low month {insights.seasonal.low}
              </div>
            </div>
          ) : (
            <p className="text-muted small mb-0">No forecast data available.</p>
          )}
        </InsightCard>
      </Row>

      <SectionHeading
        icon={ChartColumn}
        title="Municipality comparison"
        sub="Forecast vs actual change across municipalities."
        chip="green"
      />

      <Row className="g-3 mb-2">
        <InsightCard title="Municipality Ranking" icon={Trophy} chip="green" col={{ md: 6 }}>
          {insights.ranking.top ? (
            <div className="fc-ranking-pair">
              <div className="fc-ranking-badge fc-ranking-badge-top">
                <ArrowUpRight size={18} strokeWidth={2.5} className="fc-ranking-ico" />
                <div className="fc-ranking-meta">
                  <div className="fc-ranking-tag">Top performer</div>
                  <span className="fc-ranking-name">{insights.ranking.top.municipality_name}</span>
                  <span className="fc-ranking-val">{formatPct(insights.ranking.top.expected_change_pct)}</span>
                </div>
              </div>
              {insights.ranking.bottom && insights.ranking.bottom.municipality_id !== insights.ranking.top.municipality_id ? (
                <div className="fc-ranking-badge fc-ranking-badge-down">
                  <ArrowDownRight size={18} strokeWidth={2.5} className="fc-ranking-ico" />
                  <div className="fc-ranking-meta">
                    <div className="fc-ranking-tag">Needs attention</div>
                    <span className="fc-ranking-name">{insights.ranking.bottom.municipality_name}</span>
                    <span className="fc-ranking-val">{formatPct(insights.ranking.bottom.expected_change_pct)}</span>
                  </div>
                </div>
              ) : (
                <div className="fc-ranking-badge fc-ranking-badge-empty">
                  <div className="fc-ranking-meta">
                    <span className="fc-ranking-tag">Single ranked municipality</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted small mb-0">No ranking data available.</p>
          )}
        </InsightCard>

        <InsightCard title="Growth / Decline Flags" icon={Flag} chip="purple" col={{ md: 6 }}>
          {insights.flags.declining.length === 0 && insights.flags.growing.length === 0 ? (
            <p className="text-muted small mb-0">No early warning flags at this time.</p>
          ) : (
            <div className="fc-flag-chips">
              {insights.flags.growing.map((m) => (
                <span key={m.municipality_id} className="fc-flag-chip fc-flag-chip-up">
                  <ArrowUpRight size={13} strokeWidth={2.5} />
                  <span className="fc-flag-name">{m.municipality_name}</span>
                  <b>{formatPct(m.expected_change_pct)}</b>
                </span>
              ))}
              {insights.flags.declining.map((m) => (
                <span key={m.municipality_id} className="fc-flag-chip fc-flag-chip-down">
                  <ArrowDownRight size={13} strokeWidth={2.5} />
                  <span className="fc-flag-name">{m.municipality_name}</span>
                  <b>{formatPct(m.expected_change_pct)}</b>
                </span>
              ))}
            </div>
          )}
          <div className="fc-insight-caption">
            Municipalities with growth &gt;15% or a declining trend.
          </div>
        </InsightCard>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={7}>
          <Card className="encoder-card fc-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <span className="admin-card-head-icon admin-kpi-accent-greenbg"><ChartColumn size={16} strokeWidth={2} /></span>
                <div>
                  <h5 className="admin-card-head-title">Municipality Expected Change</h5>
                  <span className="fw-normal text-muted small ms-1">Forecast change by municipality, shaded by trend.</span>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {muniChartData.length === 0 ? (
                <div className="text-muted text-center py-4">No municipality forecast data available.</div>
              ) : (
                <div style={{ height: 340 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={muniChartData} margin={{ top: 10, right: 30, bottom: 50, left: 0 }}>
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
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="encoder-card fc-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <span className="admin-card-head-icon admin-kpi-accent-goldbg"><TrendingUp size={16} strokeWidth={2} /></span>
                <h5 className="admin-card-head-title">Year-over-Year Change</h5>
              </div>
            </Card.Header>
            <Card.Body>
              {yoyRows.length === 0 ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No year-over-year change data available.
                </div>
              ) : (
                <div>
                  <div style={{ height: 290 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={yoyRows}
                        layout="vertical"
                        margin={{ top: 5, right: 55, bottom: 5, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11 }}
                          domain={[-yoyAbsMax, yoyAbsMax]}
                          tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
                        />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                        <Tooltip content={<YoyTooltip />} cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }} />
                        <ReferenceLine x={0} stroke="var(--gray-400)" strokeWidth={1} />
                        <Bar dataKey="changePct" name="YoY change (%)" maxBarSize={22} isAnimationActive>
                          {yoyRows.map((m, i) => (
                            <Cell
                              key={`yoy-${i}`}
                              fill={m.changePct >= 0 ? BRAND.green : STATUS.not_ready}
                              radius={m.changePct >= 0 ? [0, 6, 6, 0] : [6, 0, 0, 6]}
                            />
                          ))}
                          <LabelList dataKey="changePct" content={<YoYBarLabel />} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {yoyCaption(yoyRows)}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function trendIconLarge(direction) {
  if (direction === 'increasing') return <><span style={{ color: BRAND.green }}>{'\u2191'}</span> Increasing</>;
  if (direction === 'declining') return <><span style={{ color: STATUS.not_ready }}>{'\u2193'}</span> Declining</>;
  return <>{'\u2192'} Stable</>;
}