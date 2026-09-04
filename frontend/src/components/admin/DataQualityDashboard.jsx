import React, { useEffect, useState } from 'react';
import { Row, Col, Alert, Spinner, Card, Table } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BadgeCheck, ClipboardCheck, Building2 } from 'lucide-react';
import { getDataQuality } from '../../services/dataService';
import { BRAND } from '../../theme/colors';
import AdminKpiCard from './AdminKpiCard';
import PageHeader from './PageHeader';

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
    production_volume: 'Salt Production (kg)',
    num_salt_beds: 'Number of Salt Beds',
    area_per_salt_bed: 'Area per Salt Bed (m\u00B2)',
    registered_producers: 'Total Producers Listed',
    male_producers: 'Male Producers',
    female_producers: 'Female Producers',
    record_date: 'Date of Record',
    production_method: 'How Salt Was Made',
    barangay_id: 'Barangay / Village',
  };

  const overallChart = Object.entries(data.overall_completeness).map(([field, value]) => ({
    field: fieldLabels[field] || field,
    completeness: value,
  }));

  const muniRows = (data.municipalities || []).map((m) => {
    const sorted = Object.entries(m.completeness || {}).sort((a, b) => b[1] - a[1]);
    const best = sorted[0] || [];
    return {
      id: m.municipality_id,
      name: m.municipality_name,
      records: m.record_count,
      score: m.quality_score,
      bestField: best[0] ? `${fieldLabels[best[0]] || best[0]} ${best[1]}%` : '—',
    };
  });

  return (
    <div>
      <PageHeader
        id="admin-data-quality"
        variant="sub"
        title="Data Quality"
        subtitle="How well-filled are our records across all municipalities."
      />

      <Row className="g-3 mb-4">
        <Col md={4}>
          <AdminKpiCard
            icon={BadgeCheck}
            title="Overall Completeness Score"
            value={`${data.overall_quality_score}%`}
            supporting="Based on how many required fields are filled in"
            accent="green"
            valueClassName={scoreClass(data.overall_quality_score)}
          />
        </Col>
        <Col md={4}>
          <AdminKpiCard
            icon={ClipboardCheck}
            title="Total Records Reviewed"
            value={data.total_records.toLocaleString()}
            supporting="From all municipalities combined"
            accent="ocean"
          />
        </Col>
        <Col md={4}>
          <AdminKpiCard
            icon={Building2}
            title="Municipalities Covered"
            value={(data.municipalities || []).length}
            supporting="With submitted records"
            accent="gold"
          />
        </Col>
      </Row>

      <Card className="encoder-card mb-4">
        <Card.Header as="h5">How Complete Is Each Field? (Province-wide)</Card.Header>
        <Card.Body>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overallChart} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="field" tick={{ fontSize: 12 }} width={180} />
                <Tooltip />
                <Bar dataKey="completeness" name="% Filled In" fill={BRAND.ocean} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card.Body>
      </Card>

      <Card className="encoder-card">
        <Card.Header as="h5">Municipality Completeness</Card.Header>
        <Card.Body className="p-0">
          {muniRows.length === 0 ? (
            <div className="text-muted p-3">No data yet.</div>
          ) : (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table">
              <thead>
                <tr>
                  <th>Municipality</th>
                  <th>Records</th>
                  <th>Completeness</th>
                  <th>Best-filled Field</th>
                </tr>
              </thead>
              <tbody>
                {muniRows.map((m) => (
                  <tr key={m.id}>
                    <td className="fw-semibold">{m.name}</td>
                    <td>{m.records.toLocaleString()}</td>
                    <td>
                      <span className={`record-status-badge ${scoreClass(m.score)}`}>
                        {m.score}%
                      </span>
                    </td>
                    <td className="text-muted">{m.bestField}</td>
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
