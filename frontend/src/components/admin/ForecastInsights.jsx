import React, { useEffect, useState } from 'react';
import { Card, Spinner, Alert, Row, Col, Button } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Area, ComposedChart } from 'recharts';
import { runForecast, getForecastRuns, getForecastResult } from '../../services/dataService';

function readinessBadge(readiness) {
  const map = {
    ready: { variant: 'success', label: 'READY' },
    limited: { variant: 'warning', label: 'LIMITED' },
    not_ready: { variant: 'danger', label: 'NOT READY' },
  };
  const c = map[readiness] || map['not_ready'];
  return <span className={`badge bg-${c.variant} forecast-readiness-badge`}>{c.label}</span>;
}

function trendIcon(direction) {
  if (direction === 'increasing') return '↑ Increasing';
  if (direction === 'declining') return '↓ Declining';
  return '→ Stable';
}

function formatKg(val) {
  if (val === null || val === undefined) return '—';
  return `${Math.round(val).toLocaleString()} kg`;
}

function formatPct(val) {
  if (val === null || val === undefined) return '—';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

function insightText(run) {
  if (!run) {
    return 'Run a forecast to generate decision-support insights.';
  }
  if (run.readiness === 'not_ready') {
    return 'Additional validated historical records are required before a meaningful forecast can be generated.';
  }
  if (run.readiness === 'limited') {
    return 'Forecast results should be interpreted with caution because validated historical records are limited.';
  }
  if (run.trend_direction === 'increasing') {
    const pct = run.expected_change_pct;
    if (pct !== null && pct > 15) {
      return 'Strong production growth is indicated by the current historical trend. Consider prioritizing further assessment of this area.';
    }
    return 'Production is projected to increase based on the current historical trend.';
  }
  if (run.trend_direction === 'declining') {
    return 'Production shows a declining trend. ASIN Center may investigate possible production or resource constraints.';
  }
  return 'Production is projected to remain stable based on recent historical records.';
}

export default function ForecastInsights() {
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getForecastRuns()
      .then((res) => {
        const runsList = res.runs || [];
        setRuns(runsList);
        if (runsList.length > 0) {
          setSelectedRunId(runsList[0].id);
        }
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    setLoading(true);
    getForecastResult(selectedRunId)
      .then((res) => { setRun(res.run); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [selectedRunId]);

  const handleRun = () => {
    setRunning(true);
    setError(null);
    runForecast({ municipality_id: null, forecast_horizon: 12 })
      .then((res) => {
        setRun(res.run);
        return getForecastRuns();
      })
      .then((res) => {
        const runsList = res.runs || [];
        setRuns(runsList);
        if (runsList.length > 0) setSelectedRunId(runsList[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setRunning(false));
  };

  const chartData = run?.points?.map((p) => ({
    label: p.period_label,
    production: p.predicted_value,
    lower: p.lower_bound,
    upper: p.upper_bound,
    isForecast: p.is_forecast,
  })) || [];

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h2 className="mb-1">Forecast Insights</h2>
          <p className="text-muted mb-0">Decision-support interpretation of the most recent forecast run.</p>
        </div>
        <Button onClick={handleRun} disabled={running} variant="primary">
          {running ? 'Running...' : 'Run New Forecast'}
        </Button>
      </div>

      <Row className="g-3 mb-3">
        <Col md={12}>
          <Card className="forecast-insight-card">
            <Card.Header as="h5" className="fw-bold">Decision Support Insight</Card.Header>
            <Card.Body>
              {run ? (
                <div className="forecast-insight-text">
                  <strong>Production Outlook</strong>
                  <p className="mb-0">{insightText(run)}</p>
                </div>
              ) : (
                <div className="forecast-insight-text">
                  <strong>Forecast Unavailable</strong>
                  <p className="mb-0">No forecast run available. Run a forecast to generate insights.</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col md={3}>
          <Card className="h-100 forecast-summary-card">
            <Card.Body>
              <div className="forecast-summary-title">Projected Production</div>
              <div className="forecast-summary-value">{formatKg(run?.projected_total)}</div>
              <div className="forecast-summary-supporting">Forecast period total</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100 forecast-summary-card">
            <Card.Body>
              <div className="forecast-summary-title">Expected Change</div>
              <div className="forecast-summary-value">{formatPct(run?.expected_change_pct)}</div>
              <div className="forecast-summary-supporting">Compared with previous period</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100 forecast-summary-card">
            <Card.Body>
              <div className="forecast-summary-title">Trend Direction</div>
              <div className="forecast-summary-value">{trendIcon(run?.trend_direction)}</div>
              <div className="forecast-summary-supporting">Based on historical validated data</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100 forecast-summary-card">
            <Card.Body>
              <div className="forecast-summary-title">Forecast Reliability</div>
              <div className="forecast-summary-value text-capitalize">{run?.reliability || '—'}</div>
              <div className="forecast-summary-supporting">Connected to available validated data</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-3">
        <Card.Header as="h5" className="fw-bold">Historical vs Forecast Production</Card.Header>
        <Card.Body>
          {chartData.length === 0 ? (
            <div className="text-center py-5 text-muted">No forecast data available.</div>
          ) : (
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value, name) => [value ? `${Math.round(value).toLocaleString()} kg` : '—', name]} />
                  <Legend />
                  <defs>
                    <linearGradient id="forecastBand2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1565C8" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1565C8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="upper" stroke="none" fill="url(#forecastBand2)" name="Upper bound" connectNulls />
                  <Area type="monotone" dataKey="lower" stroke="none" fill="url(#forecastBand2)" name="Lower bound" connectNulls />
                  <Line type="monotone" dataKey="production" stroke="#1565C8" strokeWidth={3} dot={false} name="Historical" connectNulls />
                  <Line type="monotone" dataKey="production" stroke="#F09A28" strokeWidth={3} strokeDasharray="6 4" dot={false} name="Forecast" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header as="h5" className="fw-bold">Recent Forecast Runs</Card.Header>
        <Card.Body className="p-0">
          {runs.length === 0 && <div className="text-muted p-3">No forecast runs yet.</div>}
          {runs.length > 0 && (
            <Table responsive striped hover size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Municipality</th>
                  <th>Readiness</th>
                  <th>Trend</th>
                  <th>Expected Change</th>
                  <th>Reliability</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedRunId(r.id)} className={selectedRunId === r.id ? 'table-active' : ''}>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                    <td>{r.municipality_name || 'All Municipalities'}</td>
                    <td>{readinessBadge(r.readiness)}</td>
                    <td>{trendIcon(r.trend_direction)}</td>
                    <td>{formatPct(r.expected_change_pct)}</td>
                    <td className="text-capitalize">{r.reliability}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
