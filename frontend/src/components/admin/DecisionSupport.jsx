import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Spinner, Alert, Form, Button } from 'react-bootstrap';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Target, Activity, TrendingUp, CalendarDays, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import { getAdminMunicipalities, evaluateTarget } from '../../services/dataService';
import { BRAND } from '../../theme/colors';

export default function DecisionSupport() {
  const [municipalities, setMunicipalities] = useState([]);
  const [selectedMuni, setSelectedMuni] = useState('all');
  const [annualTarget, setAnnualTarget] = useState('');
  const [forecastHorizon, setForecastHorizon] = useState(12);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminMunicipalities()
      .then((res) => setMunicipalities(res.municipalities || []))
      .catch(() => {});
  }, []);

  const runEvaluation = () => {
    const target = Number(annualTarget);
    if (!target || target <= 0) return;
    setLoading(true);
    setError(null);
    setResults(null);
    const payload = {
      municipality_id: selectedMuni !== 'all' ? Number(selectedMuni) : null,
      annual_target: target,
      forecast_horizon: forecastHorizon,
    };
    evaluateTarget(payload)
      .then((res) => setResults(res.evaluation))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const municipalityName = selectedMuni === 'all'
    ? 'All Municipalities'
    : municipalities.find((m) => String(m.id) === String(selectedMuni))?.name || 'All Municipalities';

  const chartData = results ? results.forecast_labels.map((label, i) => ({
    label,
    forecast: results.monthly_forecasts[i],
    target: results.monthly_targets[i],
  })) : [];

  return (
    <div className="admin-single-page">
      <div className="admin-page-hero mb-4">
        <div className="admin-page-hero-title">
          <Target size={20} strokeWidth={2.5} className="me-2" />
          Target Evaluation
        </div>
        <div className="admin-page-hero-sub">
          Compare your annual production target against forecast data for <b>{municipalityName}</b>.
        </div>
      </div>

      <Card className="fc-card mb-3">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={3}>
              <Form.Label className="fc-decision-label">Municipality</Form.Label>
              <Form.Select value={selectedMuni} onChange={(e) => setSelectedMuni(e.target.value)} className="fc-decision-input">
                <option value="all">All Municipalities</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label className="fc-decision-label">Annual Target (MT)</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="any"
                value={annualTarget}
                onChange={(e) => setAnnualTarget(e.target.value)}
                placeholder="e.g. 5000"
                className="fc-decision-input"
              />
            </Col>
            <Col md={3}>
              <Form.Label className="fc-decision-label">Forecast Horizon (months)</Form.Label>
              <Form.Control
                type="number"
                min="1"
                max="36"
                value={forecastHorizon}
                onChange={(e) => setForecastHorizon(Number(e.target.value))}
                className="fc-decision-input"
              />
            </Col>
            <Col md={3}>
              <Button
                variant="primary"
                onClick={runEvaluation}
                disabled={loading || !annualTarget || Number(annualTarget) <= 0}
                className="fc-decision-run-btn w-100"
              >
                {loading ? 'Evaluating…' : 'Run Evaluation'}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {loading && (
        <Card className="fc-card mb-3">
          <Card.Body className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <div className="mt-3 text-muted">Evaluating target against forecast…</div>
          </Card.Body>
        </Card>
      )}

      {results && !loading && (
        <>
          {results.total_projected === 0 && (
            <Alert variant="warning" className="mb-3">
              <AlertTriangle size={16} className="me-2" />
              No forecast data available for this scope. Please run a forecast first in the <strong>Forecasting</strong> page.
            </Alert>
          )}

          <Card className="fc-card mb-3">
            <Card.Header>
              <div className="admin-card-head">
                <span className="admin-card-head-icon admin-kpi-accent-oceanbg"><Lightbulb size={16} strokeWidth={2} /></span>
                <h5 className="admin-card-head-title">Insight</h5>
              </div>
            </Card.Header>
            <Card.Body>
              <p className="mb-3" style={{ fontSize: 15, lineHeight: 1.7 }}>{results.narrative}</p>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {results.below_months.length > 0 && (
                  <span className="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle">
                    Below target: {results.below_months.join(', ')}
                  </span>
                )}
                {results.above_months.length > 0 && (
                  <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle">
                    Above target: {results.above_months.join(', ')}
                  </span>
                )}
              </div>
              {results.recommendations.length > 0 && (
                <div>
                  <div className="small fw-semibold text-muted mb-2">Recommendations</div>
                  <ul className="mb-0">
                    {results.recommendations.map((rec, idx) => (
                      <li key={idx} className="small mb-1">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card.Body>
          </Card>

          {results.total_projected > 0 && (
            <>
              <Row className="g-3 mb-3">
                <Col md={3}>
                  <Card className="fc-card h-100">
                    <Card.Body>
                      <div className="small text-muted mb-1">Annual Target</div>
                      <div className="fw-bold" style={{ fontSize: 20 }}>{results.annual_target.toLocaleString()} MT</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="fc-card h-100">
                    <Card.Body>
                      <div className="small text-muted mb-1">Projected Total</div>
                      <div className="fw-bold" style={{ fontSize: 20 }}>{results.total_projected.toLocaleString()} MT</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="fc-card h-100">
                    <Card.Body>
                      <div className="small text-muted mb-1">Variance</div>
                      <div className={`fw-bold ${results.variance >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: 20 }}>
                        {results.variance >= 0 ? '+' : ''}{results.variance.toLocaleString()} MT
                      </div>
                      <div className="small text-muted">({results.variance_pct.toFixed(1)}%)</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="fc-card h-100">
                    <Card.Body className="d-flex flex-column align-items-center justify-content-center">
                      {results.achievable ? (
                        <CheckCircle2 size={28} className="text-success mb-2" />
                      ) : (
                        <AlertTriangle size={28} className="text-danger mb-2" />
                      )}
                      <div className={`fw-bold ${results.achievable ? 'text-success' : 'text-danger'}`} style={{ fontSize: 16 }}>
                        {results.achievable ? 'Achievable' : 'Challenging'}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Row className="g-3 mb-3">
                <Col lg={8}>
                  <Card className="fc-card h-100">
                    <Card.Header>
                      <div className="admin-card-head">
                        <span className="admin-card-head-icon admin-kpi-accent-goldbg"><TrendingUp size={16} strokeWidth={2} /></span>
                        <h5 className="admin-card-head-title">Forecast vs. Monthly Target</h5>
                      </div>
                    </Card.Header>
                    <Card.Body>
                      <div style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(value) => [`${Math.round(value).toLocaleString()} kg`, undefined]} />
                            <Legend />
                            <Bar dataKey="forecast" name="Forecast" fill={BRAND.ocean} radius={[3, 3, 0, 0]} isAnimationActive />
                            <Line type="monotone" dataKey="target" name="Monthly Target" stroke={BRAND.gold} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col lg={4}>
                  <Card className="fc-card h-100">
                    <Card.Header>
                      <div className="admin-card-head">
                        <span className="admin-card-head-icon admin-kpi-accent-greenbg"><Activity size={16} strokeWidth={2} /></span>
                        <h5 className="admin-card-head-title">Summary</h5>
                      </div>
                    </Card.Header>
                    <Card.Body>
                      <div className="d-flex flex-column gap-3">
                        <div>
                          <div className="small text-muted">Trend Direction</div>
                          <div className="fw-bold text-capitalize">{results.trend_direction}</div>
                        </div>
                        <div>
                          <div className="small text-muted">Peak Month</div>
                          <div className="fw-bold">{results.peak_month}</div>
                        </div>
                        <div>
                          <div className="small text-muted">Low Month</div>
                          <div className="fw-bold">{results.low_month}</div>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </>
      )}

      {!results && !loading && !error && (
        <Card className="fc-card">
          <Card.Body className="text-center py-5">
            <Target size={32} strokeWidth={1.5} className="text-muted mb-3" />
            <h6 className="fw-semibold mb-2">No evaluation yet</h6>
            <p className="text-muted small mb-0">
              Enter an annual target above and click <b>Run Evaluation</b> to see how your forecast compares.
            </p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
