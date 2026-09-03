import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Spinner, Alert, Form, Badge, Table, Button } from 'react-bootstrap';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Area, ComposedChart,
} from 'recharts';
import { runForecast, getForecastRuns, getForecastResult, getMunicipalityOutlook, getAdminMunicipalities } from '../../services/dataService';
import { supplyDemand } from '../../data/municipalities';

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

function trendIcon(direction) {
  if (direction === 'increasing') return '\u2191 Increasing';
  if (direction === 'declining') return '\u2193 Declining';
  return '\u2192 Stable';
}

function formatKg(val) {
  if (val === null || val === undefined) return '\u2014';
  return `${Math.round(val).toLocaleString()} kg`;
}

function formatPct(val) {
  if (val === null || val === undefined) return '\u2014';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

function InsightCard({ title, children, className }) {
  return (
    <Col md={4}>
      <Card className={`forecast-insight-card h-100 ${className || ''}`}>
        <Card.Header as="h6" className="fw-bold">{title}</Card.Header>
        <Card.Body>
          {children}
        </Card.Body>
      </Card>
    </Col>
  );
}

function computeInsights(currentRun, outlook) {
  const insights = {
    perMuni: [],
    seasonal: { peak: '\u2014', low: '\u2014', pattern: 'No forecast data available.' },
    ranking: { top: null, bottom: null },
    supplyDemand: { gap: 0, label: '\u2014', detail: 'No forecast data available.' },
    flags: { declining: [], growing: [] },
    regional: { total: '\u2014', detail: 'No forecast data available.' },
  };

  if (!currentRun) return insights;

  const demandBenchmark = supplyDemand.pangasinan.demandBenchmark;

  if (currentRun.points && currentRun.points.length > 0) {
    const forecastPoints = currentRun.points.filter((p) => p.is_forecast);
    const historicalPoints = currentRun.points.filter((p) => !p.is_forecast);

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
    const gap = Math.round(projectedMT - demandBenchmark);
    const sign = gap >= 0 ? '+' : '';
    insights.supplyDemand.gap = gap;
    insights.supplyDemand.label = `${sign}${gap.toLocaleString()} MT`;
    insights.supplyDemand.detail = `Projected: ${Math.round(projectedMT).toLocaleString()} MT vs demand benchmark: ${demandBenchmark.toLocaleString()} MT.`;
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

    const readyMunis = outlook.filter((o) => o.readiness !== 'not_ready');
    insights.perMuni = outlook.map((o) => ({
      name: o.municipality_name,
      trend: o.trend_direction,
      change: o.expected_change_pct,
      readiness: o.readiness,
    }));
  }

  if (currentRun.projected_total !== null && currentRun.projected_total !== undefined) {
    const totalProjectedMT = Math.round(currentRun.projected_total / 1000).toLocaleString();
    insights.regional.total = `${totalProjectedMT} MT`;
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
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminMunicipalities()
      .then((res) => setMunicipalities(res.municipalities || []))
      .catch(() => {});
    getMunicipalityOutlook()
      .then((res) => setOutlook(res.municipalities || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
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

  const chartData = useMemo(() => {
    if (!currentRun || !currentRun.points) return [];
    return currentRun.points.map((p) => ({
      label: p.period_label,
      production: p.predicted_value,
      lower: p.lower_bound,
      upper: p.upper_bound,
      isForecast: p.is_forecast,
    }));
  }, [currentRun]);

  const muniOutlook = useMemo(() => {
    return [...outlook].sort((a, b) => {
      const order = { ready: 0, limited: 1, not_ready: 2 };
      return (order[a.readiness] || 2) - (order[b.readiness] || 2);
    });
  }, [outlook]);

  const [sortBy, setSortBy] = useState('municipality');
  const sortedOutlook = useMemo(() => {
    const arr = [...muniOutlook];
    arr.sort((a, b) => {
      if (sortBy === 'municipality') return a.municipality_name.localeCompare(b.municipality_name);
      if (sortBy === 'expected_change') {
        const av = a.expected_change_pct ?? -9999;
        const bv = b.expected_change_pct ?? -9999;
        return bv - av;
      }
      if (sortBy === 'trend') {
        const order = { increasing: 0, stable: 1, declining: 2 };
        return (order[a.trend_direction] || 1) - (order[b.trend_direction] || 1);
      }
      if (sortBy === 'readiness') {
        const order = { ready: 0, limited: 1, not_ready: 2 };
        return (order[a.readiness] || 2) - (order[b.readiness] || 2);
      }
      return 0;
    });
    return arr;
  }, [muniOutlook, sortBy]);

  const insights = useMemo(() => computeInsights(currentRun, outlook), [currentRun, outlook]);

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const readiness = currentRun?.readiness || 'not_ready';

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h2 className="mb-1">Forecasting &amp; Production Outlook</h2>
          <p className="text-muted mb-0">Province-wide and municipality-level production projections based on validated historical data.</p>
        </div>
        <Button onClick={handleRun} disabled={running} variant="primary">
          {running ? 'Running...' : 'Run Forecast'}
        </Button>
      </div>

      <Card className="mb-3 forecast-controls-card">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={4}>
              <Form.Label className="small fw-bold text-uppercase text-muted">Municipality</Form.Label>
              <Form.Select value={selectedMuni} onChange={(e) => setSelectedMuni(e.target.value)}>
                <option value="all">All Municipalities</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label className="small fw-bold text-uppercase text-muted">Historical Period</Form.Label>
              <Form.Control disabled value="Based on available validated records" />
            </Col>
            <Col md={4}>
              <Form.Label className="small fw-bold text-uppercase text-muted">Forecast Period</Form.Label>
              <Form.Control disabled value="12 months from latest record" />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3 forecast-readiness-card">
        <Card.Body className="d-flex align-items-center gap-3">
          {readinessBadge(readiness)}
          <div>
            <div className="fw-bold">Forecast Readiness</div>
            <div className="text-muted small">{readinessReason(readiness)}</div>
          </div>
        </Card.Body>
      </Card>

      <Row className="g-3 mb-3">
        <Col md={3}>
          <Card className="h-100 forecast-summary-card">
            <Card.Body>
              <div className="forecast-summary-title">Projected Production</div>
              <div className="forecast-summary-value">{formatKg(currentRun?.projected_total)}</div>
              <div className="forecast-summary-supporting">Forecast period total</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100 forecast-summary-card">
            <Card.Body>
              <div className="forecast-summary-title">Expected Change</div>
              <div className="forecast-summary-value">{formatPct(currentRun?.expected_change_pct)}</div>
              <div className="forecast-summary-supporting">Compared with previous period</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100 forecast-summary-card">
            <Card.Body>
              <div className="forecast-summary-title">Trend Direction</div>
              <div className="forecast-summary-value">{trendIcon(currentRun?.trend_direction)}</div>
              <div className="forecast-summary-supporting">Based on historical validated data</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100 forecast-summary-card">
            <Card.Body>
              <div className="forecast-summary-title">Forecast Reliability</div>
              <div className="forecast-summary-value text-capitalize">{currentRun?.reliability || '\u2014'}</div>
              <div className="forecast-summary-supporting">Connected to available validated data</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-3 forecast-chart-card">
        <Card.Header as="h5" className="fw-bold">Historical vs Forecast Production</Card.Header>
        <Card.Body>
          {!currentRun && (
            <div className="text-center py-5 text-muted">
              No forecast generated yet. Click <strong>Run Forecast</strong> to create one.
            </div>
          )}
          {currentRun && (
            <div style={{ height: 420 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value, name) => [value ? `${Math.round(value).toLocaleString()} kg` : '\u2014', name]}
                    labelFormatter={(l) => l}
                  />
                  <Legend />
                  <defs>
                    <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1565C8" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1565C8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="none"
                    fill="url(#forecastBand)"
                    name="Upper bound"
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="lower"
                    stroke="none"
                    fill="url(#forecastBand)"
                    name="Lower bound"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="production"
                    stroke="#1565C8"
                    strokeWidth={3}
                    dot={false}
                    name="Historical"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="production"
                    stroke="#F09A28"
                    strokeWidth={3}
                    strokeDasharray="6 4"
                    dot={false}
                    name="Forecast"
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card.Body>
      </Card>

      <Card className="mb-3 forecast-outlook-card">
        <Card.Header as="h5" className="fw-bold">Municipality Forecast Outlook</Card.Header>
        <Card.Body className="p-0">
          <Table responsive striped hover size="sm" className="mb-0 forecast-table">
            <thead>
              <tr>
                <th>Municipality</th>
                <th className="cursor-pointer" onClick={() => setSortBy('trend')}>Forecast Trend {sortBy === 'trend' ? '\u2191' : ''}</th>
                <th className="cursor-pointer" onClick={() => setSortBy('expected_change')}>Expected Change {sortBy === 'expected_change' ? '\u2191' : ''}</th>
                <th className="cursor-pointer" onClick={() => setSortBy('readiness')}>Readiness {sortBy === 'readiness' ? '\u2191' : ''}</th>
              </tr>
            </thead>
            <tbody>
              {sortedOutlook.length === 0 && (
                <tr><td colSpan="4" className="text-center text-muted py-4">No municipality data available.</td></tr>
              )}
              {sortedOutlook.map((m) => (
                <tr key={m.municipality_id}>
                  <td className="fw-semibold">{m.municipality_name}</td>
                  <td>{trendIcon(m.trend_direction)}</td>
                  <td>{formatPct(m.expected_change_pct)}</td>
                  <td>{readinessBadge(m.readiness)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <h5 className="fw-bold mb-3">Forecast Insights &amp; Decision Support</h5>
      <Row className="g-3 mb-3">
        <InsightCard title="1. Production Forecast per Municipality">
          {insights.perMuni.length === 0 ? (
            <p className="text-muted mb-0">No forecast data available. Run a forecast to see projected volumes per municipality.</p>
          ) : (
            <div className="small">
              {insights.perMuni.map((m) => (
                <div key={m.name} className="d-flex justify-content-between mb-1">
                  <span>{m.name}</span>
                  <span className="text-muted">{trendIcon(m.trend)} {formatPct(m.change)}</span>
                </div>
              ))}
              {currentRun?.projected_total && (
                <p className="mt-2 mb-0 fw-semibold">Total projected: {formatKg(currentRun.projected_total)}</p>
              )}
            </div>
          )}
        </InsightCard>

        <InsightCard title="2. Seasonal Trend Analysis">
          <div className="small">
            <p className="mb-1"><strong>Peak production month:</strong> {insights.seasonal.peak}</p>
            <p className="mb-1"><strong>Lowest production month:</strong> {insights.seasonal.low}</p>
            <p className="mb-0 text-muted">{insights.seasonal.pattern}</p>
          </div>
        </InsightCard>

        <InsightCard title="3. Municipality Ranking Forecast">
          {insights.ranking.top ? (
            <div className="small">
              <p className="mb-1">
                <strong className="text-success">Top performer (next period):</strong>{' '}
                {insights.ranking.top.municipality_name} ({formatPct(insights.ranking.top.expected_change_pct)})
              </p>
              {insights.ranking.bottom && insights.ranking.bottom.municipality_id !== insights.ranking.top.municipality_id && (
                <p className="mb-0">
                  <strong className="text-warning">Needs attention:</strong>{' '}
                  {insights.ranking.bottom.municipality_name} ({formatPct(insights.ranking.bottom.expected_change_pct)})
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted mb-0">No ranking data available.</p>
          )}
        </InsightCard>

        <InsightCard title="4. Supply-Demand Gap">
          <div className="small">
            <p className="mb-1"><strong>Projected gap:</strong> {insights.supplyDemand.label}</p>
            <p className="mb-0 text-muted">{insights.supplyDemand.detail}</p>
          </div>
        </InsightCard>

        <InsightCard title="5. Decline / Growth Flags">
          {insights.flags.declining.length === 0 && insights.flags.growing.length === 0 ? (
            <p className="text-muted mb-0">No early warning flags at this time.</p>
          ) : (
            <div className="small">
              {insights.flags.growing.length > 0 && (
                <div className="mb-2">
                  <strong className="text-success">Strong growth:</strong>
                  {insights.flags.growing.map((m) => (
                    <div key={m.municipality_id} className="ms-2">
                      {m.municipality_name} ({formatPct(m.expected_change_pct)})
                    </div>
                  ))}
                </div>
              )}
              {insights.flags.declining.length > 0 && (
                <div>
                  <strong className="text-danger">Declining:</strong>
                  {insights.flags.declining.map((m) => (
                    <div key={m.municipality_id} className="ms-2">
                      {m.municipality_name} ({formatPct(m.expected_change_pct)})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </InsightCard>

        <InsightCard title="6. Aggregate / Regional Outlook">
          <div className="small">
            <p className="mb-1"><strong>Total projected supply:</strong> {insights.regional.total}</p>
            <p className="mb-0 text-muted">{insights.regional.detail}</p>
          </div>
        </InsightCard>
      </Row>
    </div>
  );
}
