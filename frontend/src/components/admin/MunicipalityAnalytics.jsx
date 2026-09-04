import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Alert, Spinner, Card, Table } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend, PieChart, Pie } from 'recharts';
import { getAdminStats, getAdminMunicipalities, loadAllMockData, getMunicipalityProduction } from '../../services/dataService';
import { BRAND, MUNICIPALITY_COLORS } from '../../theme/colors';
import PageHeader from './PageHeader';

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

function ChartTooltip({ active, payload, nameFormatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="admin-chart-tooltip">
      {payload.map((entry, i) => (
        <div key={entry.dataKey || i}>
          <div className="ct-value">{nameFormatter ? nameFormatter(entry.value) : `${Number(entry.value).toLocaleString()}`}</div>
          <div className="ct-sub">{entry.name}</div>
        </div>
      ))}
    </div>
  );
}

const MUNI_ORDER = ['Dasol', 'Infanta', 'Bani', 'Bolinao', 'Anda', 'Alaminos', 'San Fabian'];

const METHOD_COLORS = {
  solar: BRAND.gold,
  cooked: BRAND.ocean,
  hybrid: BRAND.green,
};

const METHOD_LABELS = {
  solar: 'Solar Evaporation',
  cooked: 'Cooked / Boiled',
  hybrid: 'Hybrid',
};

export default function MunicipalityAnalytics() {
  const [data, setData] = useState(null);
  const [munis, setMunis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hidden, setHidden] = useState(() => new Set());
  const [filters, setFilters] = useState({ municipality_id: '' });
  const [methodMuniId, setMethodMuniId] = useState(null);
  const [methodData, setMethodData] = useState([]);

  useEffect(() => {
    getAdminMunicipalities().then((res) => setMunis(res.municipalities || [])).catch(() => {});
  }, []);

  useEffect(() => {
    getAdminStats()
      .then((stats) => {
        setData(stats);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => {
    loadAllMockData()
      .then(() => setMethodData(getMunicipalityProduction()))
      .catch(() => {});
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.by_municipality
      .map((m) => ({
        id: m.municipality_id,
        name: m.municipality_name,
        volumeMT: Math.round((m.total_volume_kg || 0) / 1000 * 100) / 100,
        beds: m.total_salt_beds,
        area: Math.round(m.total_area_sqm || 0),
        registered: m.total_registered_producers,
        records: m.record_count,
      }))
      .sort((a, b) => b.volumeMT - a.volumeMT);
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!filters.municipality_id) return rows;
    const id = Number(filters.municipality_id);
    return rows.filter((r) => r.id === id);
  }, [rows, filters.municipality_id]);

  useEffect(() => {
    if (filteredRows.length > 0 && methodMuniId === null) {
      setMethodMuniId('all');
    }
  }, [filteredRows, methodMuniId]);

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }
  if (!data) return null;

  const muniColor = (name) => MUNICIPALITY_COLORS[name] || BRAND.ocean;

  const visibleRows = filteredRows.filter((r) => !hidden.has(r.name));

  const registeredData = visibleRows.map((r) => ({ name: r.name, registered: r.registered, fill: muniColor(r.name) }));

  const present = new Set(filteredRows.map((r) => r.name));

  const toggleMuni = (name) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectedMuni = methodMuniId === 'all'
    ? { name: 'All Municipalities', productionMT: methodData.reduce((s, m) => s + (m.productionMT || 0), 0), productionAreaSqm: methodData.reduce((s, m) => s + (m.productionAreaSqm || 0), 0) }
    : methodData.find((m) => m.id === methodMuniId);
  const methods = selectedMuni
    ? [
        { key: 'solar', value: methodMuniId === 'all' ? methodData.reduce((s, m) => s + (m.solarProductionMT || 0), 0) : (selectedMuni.solarProductionMT || 0) },
        { key: 'cooked', value: methodMuniId === 'all' ? methodData.reduce((s, m) => s + (m.cookedProductionMT || 0), 0) : (selectedMuni.cookedProductionMT || 0) },
        { key: 'hybrid', value: methodMuniId === 'all' ? methodData.reduce((s, m) => s + (m.hybridProductionMT || 0), 0) : (selectedMuni.hybridProductionMT || 0) },
      ].filter((m) => m.value > 0)
    : [];
  const methodsTotal = methods.reduce((s, m) => s + m.value, 0);
  const methodPieData = methods.map((m) => ({
    name: METHOD_LABELS[m.key],
    value: m.value,
    fill: METHOD_COLORS[m.key],
  }));
  const efficiencyHa = selectedMuni && selectedMuni.productionAreaSqm
    ? (selectedMuni.productionMT / (selectedMuni.productionAreaSqm / 10000)).toFixed(2)
    : null;

  return (
    <div>
      <PageHeader
        id="admin-municipality"
        variant="sub"
        title="Municipality Analytics"
        subtitle="Deep-dive production breakdown for each municipality."
      >
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="muni-filter">Municipality</label>
          <select
            id="muni-filter"
            className="form-select admin-page-hero-select"
            value={filters.municipality_id}
            onChange={(e) => setFilters({ municipality_id: e.target.value })}
          >
            <option value="">All municipalities</option>
            {munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </PageHeader>

      <div className="muni-toggle">
        {MUNI_ORDER.map((name) => {
          const inData = present.has(name);
          const isOff = hidden.has(name);
          const cls = ['muni-chip'];
          if (inData && !isOff) cls.push('muni-chip--on');
          if (inData && isOff) cls.push('muni-chip--off');
          if (!inData) cls.push('muni-chip--no-data');
          return (
            <button
              key={name}
              type="button"
              className={cls.join(' ')}
              onClick={() => inData && toggleMuni(name)}
              disabled={!inData}
              aria-pressed={inData && !isOff}
              aria-disabled={!inData}
              title={inData ? (isOff ? `Show ${name}` : `Hide ${name}`) : `${name} has no data`}
            >
              <span className="muni-chip-swatch" style={{ background: inData ? muniColor(name) : 'transparent' }} />
              <span className="muni-chip-name">{name}</span>
              {!inData && <span className="muni-chip-none">no data</span>}
            </button>
          );
        })}
      </div>

      <Row className="g-3 mb-4">
        <Col lg={6}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <h5 className="admin-card-head-title">Registered Producers by Municipality</h5>
              </div>
            </Card.Header>
            <Card.Body>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={registeredData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <defs>
                      {registeredData.map((entry, i) => (
                        <linearGradient key={i} id={`regGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={entry.fill} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={entry.fill} stopOpacity={0.55} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }} content={<ChartTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <Bar dataKey="registered" name="Registered producers" radius={[6, 6, 0, 0]} maxBarSize={46}>
                      {registeredData.map((entry, i) => (
                        <Cell key={i} fill={`url(#regGrad-${i})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head d-flex align-items-center justify-content-between">
                <h5 className="admin-card-head-title mb-0">Method Breakdown</h5>
                {filteredRows.length > 0 && (
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 'auto', maxWidth: 160, fontSize: 12 }}
                    value={methodMuniId || 'all'}
                    onChange={(e) => setMethodMuniId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  >
                    <option value="all">All Municipalities</option>
                    {filteredRows.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </Card.Header>
            <Card.Body>
              {selectedMuni && methods.length > 0 ? (
                <div style={{ height: 300 }} className="d-flex align-items-center justify-content-center gap-4">
                  <div style={{ width: 200, height: 200, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={methodPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {methodPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [`${Math.round(value).toLocaleString()} MT`, '']}
                          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.12)', fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    {methods.map((m) => {
                      const pct = methodsTotal > 0 ? ((m.value / methodsTotal) * 100).toFixed(1) : 0;
                      return (
                        <div key={m.key} className="d-flex align-items-center gap-2 mb-2">
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: METHOD_COLORS[m.key], flexShrink: 0 }} />
                          <span className="small fw-semibold" style={{ minWidth: 130 }}>{METHOD_LABELS[m.key]}</span>
                          <span className="small text-muted">{pct}%</span>
                        </div>
                      );
                    })}
                    {efficiencyHa && (
                      <div className="mt-3 pt-2 border-top small text-muted">
                        Efficiency: <strong className="text-dark">{efficiencyHa} MT/ha</strong>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-muted text-center py-4">
                  {selectedMuni ? `${selectedMuni.name} has no production method data.` : 'Select a municipality to view method breakdown.'}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

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
                <th>Registered Producers</th>
                <th>Records</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.name}</td>
                  <td>{r.volumeMT.toLocaleString()}</td>
                  <td>{r.beds.toLocaleString()}</td>
                  <td>{r.area.toLocaleString()}</td>
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
