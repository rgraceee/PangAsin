import React, { useEffect, useState } from 'react';
import { Card, Spinner, Alert, Form, Button, Row, Col } from 'react-bootstrap';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, BarChart, Cell } from 'recharts';
import { Lightbulb, ChartLine, TrendingUp, ChartColumn } from 'lucide-react';
import { getAdminMunicipalities, evaluateTarget } from '../../services/dataService';
import { useToast } from '../Toast';
import { SkeletonChart } from '../Skeleton';
import { BRAND } from '../../theme/colors';

export default function DecisionSupport() {
  const { toastSuccess, toastError } = useToast();
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
      .then((res) => {
        setResults(res.evaluation);
        toastSuccess('Target evaluation compared against the forecast.', 'Evaluation complete');
      })
      .catch((err) => {
        const message = err.message || 'Could not run the evaluation.';
        setError(message);
        toastError(message);
      })
      .finally(() => setLoading(false));
  };

  const municipalityName = selectedMuni === 'all'
    ? 'All Municipalities'
    : municipalities.find((m) => String(m.id) === String(selectedMuni))?.name || 'All Municipalities';

  const chartData = [];
  if (results) {
    let cumForecast = 0;
    let cumTarget = 0;
    results.forecast_labels.forEach((label, i) => {
      const forecast = results.monthly_forecasts[i] || 0;
      const target = results.monthly_targets[i] || 0;
      cumForecast += forecast;
      cumTarget += target;
      chartData.push({
        label,
        forecast,
        target,
        cumForecast,
        cumTarget,
        gap: forecast - target,
      });
    });
  }

  return (
    <div className="admin-single-page">
      <div className="admin-page-hero mb-4">
        <div className="admin-page-hero-title">
          <Lightbulb size={20} strokeWidth={2.5} className="me-2" />
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
              aria-label="Run evaluation"
            >
              {loading ? <Spinner as="span" animation="border" size="sm" /> : <Lightbulb size={16} strokeWidth={2.2} />}
            </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {loading && (
        <Card className="fc-card mb-3">
          <Card.Body>
            <div className="text-muted small mb-2">Evaluating target against forecast…</div>
            <SkeletonChart height={320} />
          </Card.Body>
        </Card>
      )}

      {results && !loading && (
        <Card className="fc-card mb-3">
          <Card.Header>
            <div className="admin-card-head">
              <span className="admin-card-head-icon admin-kpi-accent-oceanbg"><ChartLine size={16} strokeWidth={2} /></span>
              <h5 className="admin-card-head-title">Forecast vs. Monthly Target</h5>
            </div>
          </Card.Header>
          <Card.Body>
            {results.total_projected === 0 ? (
              <div className="chart-empty">
                <span className="chart-empty-chip">No forecast</span>
                No forecast data available for this scope. Run a forecast first in the Forecasting page.
              </div>
            ) : (
              <>
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => [`${Math.round(value).toLocaleString()} kg`, undefined]} />
                      <Legend />
                      <Bar dataKey="forecast" name="Forecast" fill={BRAND.ocean} radius={[3, 3, 0, 0]} isAnimationActive />
                      <Line type="monotone" dataKey="target" name="Monthly Target" stroke={BRAND.gold} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="admin-card-head mt-4 mb-3">
                  <span className="admin-card-head-icon admin-kpi-accent-oceanbg"><TrendingUp size={16} strokeWidth={2} /></span>
                  <h5 className="admin-card-head-title">Cumulative Pace (Forecast vs. Monthly Target)</h5>
                </div>
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => [`${Math.round(value).toLocaleString()} kg`, undefined]} />
                      <Legend />
                      <Line type="monotone" dataKey="cumForecast" name="Cumulative Forecast" stroke={BRAND.ocean} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive />
                      <Line type="monotone" dataKey="cumTarget" name="Cumulative Target" stroke={BRAND.gold} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-caption">Shows whether cumulative production is on pace to meet the annual target by year-end.</div>

                <div className="admin-card-head mt-4 mb-3">
                  <span className="admin-card-head-icon admin-kpi-accent-greenbg"><ChartColumn size={16} strokeWidth={2} /></span>
                  <h5 className="admin-card-head-title">Monthly Gap (Forecast − Monthly Target)</h5>
                </div>
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => [`${Math.round(value).toLocaleString()} kg`, undefined]} />
                      <Bar dataKey="gap" name="Forecast − Monthly Target" isAnimationActive>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.gap >= 0 ? BRAND.green : '#DC3545'} radius={[3, 3, 0, 0]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-caption">Shows which months are projected to fall short of or exceed their target.</div>
              </>
            )}
          </Card.Body>
        </Card>
      )}

      {!results && !loading && !error && (
        <Card className="fc-card">
          <Card.Body className="text-center py-5">
            <Lightbulb size={32} strokeWidth={1.5} className="text-muted mb-3" />
            <h6 className="fw-semibold mb-2">No evaluation yet</h6>
            <p className="text-muted small mb-0">
              Enter an annual target above to compare it against the forecast.
            </p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
