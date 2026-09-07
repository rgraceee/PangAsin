import React, { useEffect, useState } from 'react';
import { Card, Spinner, Alert, Form, Button, Row, Col } from 'react-bootstrap';
import { Lightbulb } from 'lucide-react';
import { getAdminMunicipalities, evaluateTarget } from '../../services/dataService';

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
      )}

      {!results && !loading && !error && (
        <Card className="fc-card">
          <Card.Body className="text-center py-5">
            <Lightbulb size={32} strokeWidth={1.5} className="text-muted mb-3" />
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
