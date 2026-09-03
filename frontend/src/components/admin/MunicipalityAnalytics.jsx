import React, { useEffect, useState } from 'react';
import { Row, Col, Alert, Spinner, Card, Table } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from 'recharts';
import { getAdminStats } from '../../services/dataService';

const MUNI_COLORS = [
  '#1565C8', '#F09A28', '#E53935', '#29B039',
  '#8E24AA', '#00ACC1', '#FB8C00',
];

function CustomLegend({ payload }) {
  return (
    <div className="admin-chart-legend">
      {payload.map((entry, i) => (
        <span key={i} className="admin-chart-legend-item">
          <span className="admin-chart-legend-swatch" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
}

export default function MunicipalityAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminStats()
      .then((stats) => {
        setData(stats);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }
  if (!data) return null;

  const rows = data.by_municipality
    .map((m) => ({
      id: m.municipality_id,
      name: m.municipality_name,
      volumeMT: Math.round((m.total_volume_kg || 0) / 1000 * 100) / 100,
      beds: m.total_salt_beds,
      area: Math.round(m.total_area_sqm || 0),
      efficiency: m.total_salt_beds > 0 ? Math.round((m.total_volume_kg / m.total_salt_beds)) : 0,
      registered: m.total_registered_producers,
      records: m.record_count,
    }))
    .sort((a, b) => b.volumeMT - a.volumeMT);

  const chartData = rows.map((r) => ({ name: r.name, volumeMT: r.volumeMT }));

  return (
    <div>
      <h2 className="mb-1">Municipality Analytics</h2>
      <p className="text-muted">Deep-dive production breakdown for each municipality.</p>

      <Card className="encoder-card mb-3">
        <Card.Header as="h5">Production by Municipality (MT)</Card.Header>
        <Card.Body>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend content={<CustomLegend />} />
                <Bar dataKey="volumeMT" name="Volume (MT)" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={MUNI_COLORS[i % MUNI_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card.Body>
      </Card>

      <Card className="encoder-card">
        <Card.Header as="h5">Municipality Details</Card.Header>
        <Card.Body className="p-0">
          <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
            <thead>
              <tr>
                <th>Municipality</th>
                <th>Production (MT)</th>
                <th>Salt Beds</th>
                <th>Area (m\u00B2)</th>
                <th>kg / Bed</th>
                <th>Registered Producers</th>
                <th>Records</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.name}</td>
                  <td>{r.volumeMT.toLocaleString()}</td>
                  <td>{r.beds.toLocaleString()}</td>
                  <td>{r.area.toLocaleString()}</td>
                  <td>{r.efficiency.toLocaleString()}</td>
                  <td>{r.registered.toLocaleString()}</td>
                  <td>{r.records.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
}
