import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Alert, Spinner, Card, Table } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, LabelList } from 'recharts';
import { getAdminStats, loadAllMockData, getMunicipalityProduction, getDemographicsByMunicipality } from '../../services/dataService';
import { BRAND, MUNICIPALITY_COLORS, GENDER } from '../../theme/colors';
import PageHeader from './PageHeader';

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

const AGE_BANDS = [
  { label: '18-30', field: 'producers_18_30' },
  { label: '31-40', field: 'producers_31_40' },
  { label: '41-50', field: 'producers_41_50' },
  { label: '51-60', field: 'producers_51_60' },
  { label: '61+', field: 'producers_61_plus' },
];

export default function MunicipalityAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hidden, setHidden] = useState(() => new Set());
  const [provinceMode, setProvinceMode] = useState(true);
  const [methodData, setMethodData] = useState([]);

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
        male: m.total_male_producers || 0,
        female: m.total_female_producers || 0,
      }))
      .sort((a, b) => b.volumeMT - a.volumeMT);
  }, [data]);

  const registeredData = useMemo(() => {
    const visible = rows.filter((r) => !hidden.has(r.name));
    return [...visible]
      .sort((a, b) => b.registered - a.registered)
      .map((r) => ({ name: r.name, registered: r.registered, fill: MUNICIPALITY_COLORS[r.name] || BRAND.ocean }));
  }, [rows, hidden]);

  const muniColor = (name) => MUNICIPALITY_COLORS[name] || BRAND.ocean;

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }
  if (!data) return null;

  const visibleRows = rows.filter((r) => !hidden.has(r.name));
  const present = new Set(rows.map((r) => r.name));
  const activeNames = new Set(visibleRows.map((r) => r.name));

  const selectPangasinan = () => {
    setProvinceMode(true);
    setHidden(new Set());
  };

  const toggleMuni = (name) => {
    if (provinceMode) {
      setProvinceMode(false);
      setHidden(new Set(rows.map((r) => r.name).filter((n) => n !== name)));
      return;
    }
    if (hidden.has(name)) {
      const next = new Set(hidden);
      next.delete(name);
      setHidden(next);
    } else {
      const next = new Set(hidden);
      next.add(name);
      const stillActive = rows.some((r) => r.name !== name && !next.has(r.name));
      if (!stillActive) {
        setProvinceMode(true);
        setHidden(new Set());
      } else {
        setHidden(next);
      }
    }
  };

  /* ---- Registered producers ---- */
  const topRegistered = registeredData.reduce((best, r) => (r.registered > best.registered ? r : best), registeredData[0] || null);
  const registeredTotal = visibleRows.reduce((s, r) => s + r.registered, 0);

  function registeredCaption() {
    if (!topRegistered || topRegistered.registered <= 0) {
      return (
        <div className="chart-caption">
          <b>No registered producer data</b> available for the selected municipalities.
        </div>
      );
    }
    return (
      <div className="chart-caption">
        <b>{topRegistered.name}</b> has the most registered producers at <b>{topRegistered.registered.toLocaleString()}</b>.
      </div>
    );
  }

  /* ---- Production methods (aggregate over active municipalities) ---- */
  const activeMethodRows = methodData.filter((m) => activeNames.has(m.name));
  const methods = [
    { key: 'solar', value: activeMethodRows.reduce((s, m) => s + (m.solarProductionMT || 0), 0) },
    { key: 'cooked', value: activeMethodRows.reduce((s, m) => s + (m.cookedProductionMT || 0), 0) },
    { key: 'hybrid', value: activeMethodRows.reduce((s, m) => s + (m.hybridProductionMT || 0), 0) },
  ].filter((m) => m.value > 0);
  const methodsTotal = methods.reduce((s, m) => s + m.value, 0);
  const methodPieData = methods.map((m) => ({
    name: METHOD_LABELS[m.key],
    value: m.value,
    fill: METHOD_COLORS[m.key],
  }));

  function methodCaption() {
    if (methods.length === 0) return null;
    const top = methods.reduce((b, m) => (m.value > b.value ? m : b), methods[0]);
    const pct = methodsTotal > 0 ? ((top.value / methodsTotal) * 100).toFixed(1) : 0;
    return (
      <div className="chart-caption">
        <b>{METHOD_LABELS[top.key]}</b> leads production with <b>{pct}%</b> of the recorded volume.
      </div>
    );
  }

  /* ---- Producer demographics (gender) ---- */
  const hasDemogData = visibleRows.some((r) => (r.male || r.female) > 0);

  const demogTotalMale = visibleRows.reduce((s, r) => s + r.male, 0);
  const demogTotalFemale = visibleRows.reduce((s, r) => s + r.female, 0);
  const demogTotal = demogTotalMale + demogTotalFemale;

  const genderPieData = (demogTotal > 0 ? [
    { name: 'Male Producers', value: demogTotalMale, fill: GENDER.male },
    { name: 'Female Producers', value: demogTotalFemale, fill: GENDER.female },
  ] : []);

  function genderDonutCaption() {
    if (!hasDemogData) {
      return (
        <div className="chart-caption">
          <b>No producer gender data</b> available for the selected municipalities.
        </div>
      );
    }
    if (demogTotal === 0) return null;
    const malePct = (demogTotalMale / demogTotal) * 100;
    const femalePct = (demogTotalFemale / demogTotal) * 100;
    const headline = malePct >= femalePct
      ? `Male producers outnumber female, ${malePct.toFixed(1)}% to ${femalePct.toFixed(1)}%.`
      : `Female producers outnumber male, ${femalePct.toFixed(1)}% to ${malePct.toFixed(1)}%.`;
    let title;
    if (visibleRows.length === 1) {
      title = `${visibleRows[0].name} records ${demogTotal.toLocaleString()} producers.`;
    } else if (visibleRows.length === present.size) {
      title = `Across Pangasinan, ${demogTotal.toLocaleString()} producers are recorded.`;
    } else {
      title = `Across the ${visibleRows.length} selected municipalities, ${demogTotal.toLocaleString()} producers are recorded.`;
    }
    return (
      <div className="chart-caption">
        {title} {headline}
      </div>
    );
  }

  /* ---- Producer demographics (age) ---- */
  const demogByMuni = getDemographicsByMunicipality();
  const ageValues = AGE_BANDS.map((b) => ({
    name: b.label,
    value: visibleRows.reduce((s, r) => s + ((demogByMuni[String(r.id)]?.ageGroups || {})[b.field] || 0), 0),
  }));
  const ageTotal = ageValues.reduce((s, a) => s + a.value, 0);
  const ageData = ageValues.map((a) => ({ ...a, total: ageTotal, pct: ageTotal > 0 ? (a.value / ageTotal) * 100 : 0 }));
  const ageMax = Math.max(1, ...ageValues.map((a) => a.value));

  function ageCaption() {
    if (ageTotal === 0) {
      return (
        <div className="chart-caption">
          <b>No producer age data</b> available for the selected municipalities.
        </div>
      );
    }
    const top = ageData.reduce((b, a) => (a.value > b.value ? a : b), ageData[0]);
    return (
      <div className="chart-caption">
        The <b>{top.name}</b> age bracket is the largest group at
        {' '}<b>{top.pct.toFixed(1)}%</b> of {ageTotal.toLocaleString()} recorded producers.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        id="admin-municipality"
        variant="sub"
        title="Municipality Analytics"
        subtitle="Deep-dive production breakdown for each municipality."
      />

      <div className="muni-toggle">
        <button
          key="pangasinan"
          type="button"
          className={`muni-chip ${provinceMode ? 'muni-chip--on' : 'muni-chip--off'}`}
          style={provinceMode ? { background: BRAND.ocean, borderColor: BRAND.ocean, color: '#fff', boxShadow: `0 4px 14px -4px ${BRAND.ocean}66` } : undefined}
          onClick={selectPangasinan}
          aria-pressed={provinceMode}
          title="Whole-province aggregate"
        >
          <span className="muni-chip-swatch" style={{ background: provinceMode ? 'rgba(255,255,255,0.9)' : BRAND.ocean }} />
          <span className="muni-chip-name">Pangasinan</span>
        </button>
        {MUNI_ORDER.map((name) => {
          const inData = present.has(name);
          const isOn = inData && !provinceMode && !hidden.has(name);
          const isOff = inData && !provinceMode && hidden.has(name);
          const cls = ['muni-chip'];
          if (!inData) cls.push('muni-chip--no-data');
          else if (isOn) cls.push('muni-chip--on');
          else cls.push('muni-chip--off');
          const color = muniColor(name);
          return (
            <button
              key={name}
              type="button"
              className={cls.join(' ')}
              style={isOn ? { background: color, borderColor: color, color: '#fff', boxShadow: `0 4px 14px -4px ${color}66` } : undefined}
              onClick={() => inData && toggleMuni(name)}
              disabled={!inData}
              aria-pressed={isOn}
              aria-disabled={!inData}
              title={!inData ? `${name} has no data` : isOff ? `Show ${name}` : `Hide ${name}`}
            >
              <span className="muni-chip-swatch" style={{ background: inData ? (isOn ? 'rgba(255,255,255,0.9)' : color) : 'transparent' }} />
              <span className="muni-chip-name">{name}</span>
              {!inData && <span className="muni-chip-none">no data</span>}
            </button>
          );
        })}
      </div>

      {/* Row A: Registered Producers | Method Breakdown */}
      <Row className="g-3 mb-4">
        <Col lg={6}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head d-flex align-items-center justify-content-between w-100">
                <h5 className="admin-card-head-title mb-0">Registered Producers by Municipality</h5>
                <div className="text-end">
                  <div className="small text-muted" style={{ fontSize: 11, lineHeight: 1.1 }}>Total Registered Producers</div>
                  <div className="fw-bold" style={{ fontSize: 24, lineHeight: 1.1 }}>{registeredTotal.toLocaleString()}</div>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {registeredData.length === 0 ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No registered producer data for the selected municipalities.
                </div>
              ) : (
                <div>
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
                        <Bar dataKey="registered" name="Registered producers" radius={[6, 6, 0, 0]} maxBarSize={46}>
                          {registeredData.map((entry, i) => (
                            <Cell key={i} fill={`url(#regGrad-${i})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {registeredCaption()}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <h5 className="admin-card-head-title">Method Breakdown</h5>
              </div>
            </Card.Header>
            <Card.Body>
              {methods.length > 0 ? (
                <div>
                  <div style={{ minHeight: 300 }} className="d-flex align-items-center justify-content-center flex-wrap gap-4">
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
                    </div>
                  </div>
                  {methodCaption()}
                </div>
              ) : (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No production method data available for the selected municipalities.
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Row B: Producer demographics — gender | age */}
      <Row className="g-3 mb-4">
        <Col lg={6}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <h5 className="admin-card-head-title">Producer Gender Distribution</h5>
              </div>
            </Card.Header>
            <Card.Body>
              {genderPieData.length === 0 ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No producer gender data available for the selected municipalities.
                </div>
              ) : (
                <div>
                  <div style={{ minHeight: 300 }} className="d-flex align-items-center justify-content-center flex-wrap gap-4">
                    <div style={{ width: 210, height: 210, flexShrink: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={genderPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={56}
                            outerRadius={92}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                          >
                            {genderPieData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => [`${Number(value).toLocaleString()} producers`, name]}
                            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.12)', fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      {genderPieData.map((g) => (
                        <div key={g.name} className="d-flex align-items-center gap-2 mb-2">
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: g.fill, flexShrink: 0 }} />
                          <span className="small fw-semibold" style={{ minWidth: 130 }}>{g.name}</span>
                          <span className="small text-muted">{g.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {genderDonutCaption()}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <h5 className="admin-card-head-title">Producer Age Distribution</h5>
              </div>
            </Card.Header>
            <Card.Body>
              {ageTotal === 0 ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No producer age data available for the selected municipalities.
                </div>
              ) : (
                <div>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ageData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <defs>
                          <linearGradient id="ageGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={BRAND.ocean} stopOpacity={0.95} />
                            <stop offset="100%" stopColor={BRAND.ocean} stopOpacity={0.55} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} domain={[0, ageMax]} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="admin-chart-tooltip">
                                <div className="ct-label">Age {d.name}</div>
                                <div className="ct-value">{d.value.toLocaleString()} producers</div>
                                <div className="ct-sub">{d.pct.toFixed(1)}% of {d.total.toLocaleString()} recorded</div>
                              </div>
                            );
                          }}
                          cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }}
                        />
                        <Bar dataKey="value" name="Producers" radius={[6, 6, 0, 0]} maxBarSize={54}>
                          {ageData.map((entry, i) => (
                            <Cell key={i} fill="url(#ageGrad)" />
                          ))}
                          <LabelList
                            dataKey="value"
                            position="top"
                            formatter={(v) => Number(v).toLocaleString()}
                            style={{ fontSize: 11, fontWeight: 700, fill: 'var(--gray-700)' }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {ageCaption()}
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
              {rows.map((r) => (
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