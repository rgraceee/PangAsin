import React, { useEffect, useState } from 'react';
import { Row, Col, Alert, Spinner, Card, Table } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getDataQuality } from '../../services/dataService';

function scoreClass(score) {
  if (score >= 85) return 'admin-score-high';
  if (score >= 65) return 'admin-score-mid';
  return 'admin-score-low';
}

export default function DataQualityDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDataQuality()
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }
  if (!data) return null;

  const fieldLabels = {
    production_volume: 'Production volume',
    num_salt_beds: 'Salt beds',
    area_per_salt_bed: 'Area / bed',
    registered_producers: 'Registered producers',
    male_producers: 'Male producers',
    female_producers: 'Female producers',
    record_date: 'Record date',
    notes: 'Notes',
    barangay_id: 'Barangay',
  };

  const overallChart = Object.entries(data.overall_completeness).map(([field, value]) => ({
    field: fieldLabels[field] || field,
    completeness: value,
  }));

  const lowestMunis = (data.municipalities || []).slice(0, 5);

  return (
    <div>
      <h2 className="mb-1">Data Quality</h2>
      <p className="text-muted">Completeness and weighted quality score per municipality.</p>

      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="encoder-kpi admin-kpi">
            <Card.Body>
              <div className="encoder-kpi-title">Overall Quality Score</div>
              <div className={`encoder-kpi-value ${scoreClass(data.overall_quality_score)}`}>
                {data.overall_quality_score}%
              </div>
              <div className="encoder-kpi-supporting">Weighted across all fields and records</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="encoder-kpi admin-kpi">
            <Card.Body>
              <div className="encoder-kpi-title">Records Analyzed</div>
              <div className="encoder-kpi-value">{data.total_records.toLocaleString()}</div>
              <div className="encoder-kpi-supporting">Across all municipalities</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="encoder-kpi admin-kpi">
            <Card.Body>
              <div className="encoder-kpi-title">Municipalities</div>
              <div className="encoder-kpi-value">{(data.municipalities || []).length}</div>
              <div className="encoder-kpi-supporting">Included in scoring</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={7}>
          <Card className="encoder-card">
            <Card.Header as="h5">Field Completeness (Province-wide)</Card.Header>
            <Card.Body>
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overallChart} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="field" tick={{ fontSize: 12 }} width={140} />
                    <Tooltip />
                    <Bar dataKey="completeness" name="Completeness %" fill="#1565C8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={5}>
          <Card className="encoder-card">
            <Card.Header as="h5">Lowest-Scoring Municipalities</Card.Header>
            <Card.Body className="p-0">
              {lowestMunis.length === 0 && <div className="text-muted p-3">No data yet.</div>}
              {lowestMunis.length > 0 && (
                <Table responsive striped hover size="sm" className="mb-0 encoder-table">
                  <thead>
                    <tr>
                      <th>Municipality</th>
                      <th>Records</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowestMunis.map((m) => (
                      <tr key={m.municipality_id}>
                        <td>{m.municipality_name}</td>
                        <td>{m.record_count}</td>
                        <td>
                          <span className={`record-status-badge ${scoreClass(m.quality_score)}`}>
                            {m.quality_score}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3">
        {data.municipalities.map((m) => (
          <Col md={6} lg={4} key={m.municipality_id}>
            <Card className="encoder-kpi admin-kpi">
              <Card.Body>
                <div className="encoder-kpi-title">{m.municipality_name}</div>
                <div className={`encoder-kpi-value ${scoreClass(m.quality_score)}`}>{m.quality_score}%</div>
                <div className="encoder-kpi-supporting">{m.record_count} record{m.record_count === 1 ? '' : 's'}</div>
                <div className="mt-2 small text-muted">
                  Top field: {(() => {
                    const sorted = Object.entries(m.completeness).sort((a, b) => b[1] - a[1]);
                    return sorted[0] ? `${fieldLabels[sorted[0][0]] || sorted[0][0]} ${sorted[0][1]}%` : '—';
                  })()}
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}