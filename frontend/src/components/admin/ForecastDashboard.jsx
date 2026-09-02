import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Spinner, Alert, Form, Badge, Table, Button } from 'react-bootstrap';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Area, ComposedChart,
} from 'recharts';
import { runForecast, getForecastRuns, getForecastResult, getMunicipalityOutlook, getAdminMunicipalities } from '../../services/dataService';

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

function insightText(run, outlook) {
  if (!run) {
    if (outlook && outlook.readiness === 'not_ready') {
      return 'Additional validated historical records are required before a meaningful forecast can be generated.';
    }
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
      label: p.predicted_value !== null ? p.period_label : p.period_label,
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
              <div className="forecast-summary-value text-capitalize">{currentRun?.reliability || '—'}</div>
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
                    formatter={(value, name) => [value ? `${Math.round(value).toLocaleString()} kg` : '—', name]}
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
                <th className="cursor-pointer" onClick={() => setSortBy('trend')}>Forecast Trend {sortBy === 'trend' ? '↑' : ''}</th>
                <th className="cursor-pointer" onClick={() => setSortBy('expected_change')}>Expected Change {sortBy === 'expected_change' ? '↑' : ''}</th>
                <th className="cursor-pointer" onClick={() => setSortBy('readiness')}>Readiness {sortBy === 'readiness' ? '↑' : ''}</th>
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

      <Card className="forecast-insight-card">
        <Card.Header as="h5" className="fw-bold">Decision Support Insight</Card.Header>
        <Card.Body>
          <div className="forecast-insight-text">
            {currentRun ? (
              <>
                <strong>Production Outlook</strong>
                <p className="mb-0">{insightText(currentRun, null)}</p>
              </>
            ) : (
              <>
                <strong>Forecast Unavailable</strong>
                <p className="mb-0">{insightText(null, outlook[0])}</p>
              </>
            )}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
