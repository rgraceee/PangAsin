import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Row, Col, Alert, Spinner, Card } from 'react-bootstrap';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import L from 'leaflet';
import { Boxes, LayoutGrid, Ruler, Hourglass, Scale, CalendarCheck, ChartLine, MapPin } from 'lucide-react';
import {
  getAdminStats, getAdminTrends, getAdminMonths,
  getMunicipalityOutlook, getAdminSupplyDemand,
} from '../../services/dataService';
import { BRAND, oceanScale, OCEAN_LIGHT } from '../../theme/colors';
import geojson from '../../data/pangasinan_municipalities.json';
import AdminKpiCard from './AdminKpiCard';
import PageHeader from './PageHeader';

function KPIStat({ title, value, supporting, accent, icon }) {
  return (
    <AdminKpiCard icon={icon} title={title} value={value} supporting={supporting} accent={accent} />
  );
}

function KPICluster({ title, accent, children }) {
  return (
    <div className="mb-4">
      <div className={`d-flex align-items-center gap-2 admin-kpi-cluster admin-kpi-cluster-${accent}`}>
        <span className={`admin-kpi-cluster-bar admin-kpi-accent-${accent}`} />
        <span className="admin-kpi-cluster-title">{title}</span>
      </div>
      <Row className="g-3">{children}</Row>
    </div>
  );
}

function ChartTooltip({ active, payload, label, suffix = '', nameFormatter }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="admin-chart-tooltip">
      {label != null && <div className="ct-label">{label}</div>}
      {payload.map((entry, i) => (
        <div key={entry.dataKey || i}>
          <div className="ct-value">{nameFormatter ? nameFormatter(entry.value) : `${Number(entry.value).toLocaleString()}${suffix}`}</div>
          <div className="ct-sub">{entry.name}</div>
        </div>
      ))}
    </div>
  );
}

function trendCaption(series) {
  if (!series || series.length === 0) return null;
  const peak = series.reduce((best, m) => (m.total > best.total ? m : best), series[0]);
  return (
    <div className="chart-caption">
      <b>{peak.month}</b> was the highest-output month across the province
      at <b>{peak.total.toLocaleString()} MT</b>.
    </div>
  );
}

export default function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [trendSeries, setTrendSeries] = useState([]);
  const [period, setPeriod] = useState(null);
  const [outlook, setOutlook] = useState([]);
  const [supplyDemand, setSupplyDemand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminMonths, setAdminMonths] = useState([]);
  const [selectedAdminMonth, setSelectedAdminMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    getAdminMonths()
      .then((res) => {
        const months = res.months || [];
        setAdminMonths(months);
        if (months.length > 0 && !months.includes(selectedAdminMonth)) {
          setSelectedAdminMonth(months[months.length - 1]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getAdminStats(),
      getAdminTrends({ month: selectedAdminMonth || undefined }).catch(() => ({ trend: [], municipalities: [] })),
      getMunicipalityOutlook().catch(() => ({ municipalities: [] })),
      getAdminSupplyDemand().catch(() => null),
    ])
      .then(([s, tr, ol, sd]) => {
        setStats(s);
        setTrendSeries(tr.trend || []);
        setPeriod(tr.period || null);
        setOutlook(ol.municipalities || []);
        setSupplyDemand(sd);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [selectedAdminMonth]);

  const muniData = useMemo(() => {
    if (!stats) return [];
    return stats.by_municipality
      .map((m) => ({
        name: m.municipality_name,
        volumeMT: Math.round((m.total_volume_kg || 0) / 1000 * 100) / 100,
        beds: m.total_salt_beds,
        area: m.total_area_sqm,
        registered: m.total_registered_producers,
        male: m.total_male_producers,
        female: m.total_female_producers,
        records: m.record_count,
        efficiency: m.total_salt_beds > 0 ? Math.round((m.total_volume_kg / m.total_salt_beds) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.volumeMT - a.volumeMT);
  }, [stats]);

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const totalVolumeMT = Math.round((stats.total_volume_kg / 1000) * 100) / 100;
  const demandBenchmark = supplyDemand?.pangasinan?.demand_volume ?? 0;
  const supplyDemandGap = demandBenchmark ? totalVolumeMT - demandBenchmark : null;
  const supplyDemandLabel = supplyDemandGap == null ? 'N/A' : (supplyDemandGap >= 0 ? 'Surplus' : 'Shortage');

  const readyMunis = outlook.filter((o) => o.readiness !== 'not_ready').length;
  const totalMunis = outlook.length || muniData.length;

  return (
    <div>
      <PageHeader
        id="admin-dashboard"
        variant="main"
        title="Executive Dashboard"
        subtitle={`Welcome, ${user?.name} · Province-wide overview across all municipalities.`}
      />

      <Row className="g-3 mb-4">
        <Col md={4}>
          <KPIStat icon={Boxes} title="Total Production" value={`${totalVolumeMT.toLocaleString()} MT`} supporting={`${stats.total_volume_kg.toLocaleString()} kg`} accent="ocean" />
        </Col>
        <Col md={4}>
          <KPIStat icon={Ruler} title="Production Area" value={`${stats.total_area_sqm.toLocaleString()}\u00A0m\u00B2`} supporting="Combined area of all beds" accent="ocean" />
        </Col>
        <Col md={4}>
          <KPIStat
            icon={Scale}
            title="Supply-Demand Balance"
            value={supplyDemandGap == null ? 'N/A' : `${supplyDemandLabel} ${Math.abs(Math.round(supplyDemandGap)).toLocaleString()} MT`}
            supporting={demandBenchmark ? `vs ${demandBenchmark.toLocaleString()} MT demand benchmark` : 'No demand benchmark available'}
            accent="gold"
          />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col md={4}>
          <KPIStat icon={LayoutGrid} title="Total Salt Beds" value={stats.total_salt_beds.toLocaleString()} supporting="Active production beds" accent="ocean" />
        </Col>
        <Col md={4}>
          <KPIStat icon={Hourglass} title="Pending Validation" value={stats.pending_validation_count.toLocaleString()} supporting="Awaiting admin review" accent="green" />
        </Col>
        <Col md={4}>
          <KPIStat
            icon={CalendarCheck}
            title="Forecast Availability"
            value={`${readyMunis} / ${totalMunis}`}
            supporting="Municipalities with forecast data"
            accent="gold"
          />
        </Col>
      </Row>

      <MunicipalityMap muniData={muniData} />

      <Row className="g-3 mb-4">
        <Col lg={12}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <span className="admin-card-head-icon admin-kpi-accent-oceanbg"><ChartLine size={16} strokeWidth={2} /></span>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <div>
                    <h5 className="admin-card-head-title">Province-Wide Production Trend (MT / month)</h5>
                    {period ? <span className="fw-normal text-muted small ms-1">({period.start} to {period.end})</span> : null}
                  </div>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 'auto' }}
                    value={selectedAdminMonth}
                    onChange={(e) => setSelectedAdminMonth(e.target.value)}
                    aria-label="Select month"
                  >
                    {adminMonths.map((m) => (
                      <option key={m} value={m}>
                        {(() => {
                          const [y, mo] = m.split('-');
                          const d = new Date(Number(y), Number(mo) - 1);
                          return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                        })()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {trendSeries.length === 0 ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No approved production records available to build trends yet.
                </div>
              ) : (
                <div>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={3} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip content={<ChartTooltip nameFormatter={(v) => `${v.toLocaleString()} MT`} />} />
                        <Legend />
                        <Line type="monotone" dataKey="total" name="Total Production (MT)" stroke={BRAND.ocean} strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {trendCaption(trendSeries)}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function MunicipalityMap({ muniData }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geoJsonLayerRef = useRef(null);
  const openPopupRef = useRef(null);

  const { min, max } = useMemo(() => {
    const values = muniData.map((m) => m.volumeMT);
    const mn = values.length ? Math.min(...values) : 0;
    const mx = values.length ? Math.max(...values) : 0;
    return { min: mn, max: mx };
  }, [muniData]);

  const renderPopup = useCallback((feature, m) => {
    const genderText = m.registered > 0
      ? `${(m.male || 0).toLocaleString()} / ${(m.female || 0).toLocaleString()}`
      : '—';
    const rows = [
      ['Total Volume', `${m.volumeMT.toLocaleString()} MT`],
      ['Record Count', (m.records ?? 0).toLocaleString()],
      ['Production Area', `${(m.area || 0).toLocaleString()} m²`],
      ['Salt Beds', (m.beds || 0).toLocaleString()],
      ['Registered Producers', (m.registered || 0).toLocaleString()],
      ['Male / Female', genderText],
      ['Kg per Bed', (m.efficiency ?? 0).toLocaleString()],
    ];
    const rowsHtml = rows
      .map(([label, value]) => `
        <div class="map-popup-row">
          <span class="map-popup-label">${label}</span>
          <span class="map-popup-value">${value}</span>
        </div>
      `)
      .join('');

    return `
      <div class="map-popup-card">
        <div class="map-popup-header">${feature.properties.name}</div>
        ${rowsHtml}
        <div class="map-popup-foot">Administrative summary</div>
      </div>
    `;
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const byName = Object.fromEntries(muniData.map((m) => [m.name, m]));
    const scaledFor = (value) => oceanScale(value, min, max);

    const map = L.map(mapRef.current).setView([16.1, 119.95], 9);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    geoJsonLayerRef.current = L.geoJSON(geojson, {
      style: (feature) => {
        const m = byName[feature.properties.name];
        return {
          fillColor: m ? scaledFor(m.volumeMT) : '#cbd5e1',
          weight: 1.5,
          opacity: 0.9,
          color: '#ffffff',
          fillOpacity: 0.72,
        };
      },
      onEachFeature: (feature, layer) => {
        const m = byName[feature.properties.name];
        if (!m) return;
        layer.bindTooltip(
          `
            <div style="min-width:170px">
              <strong>${feature.properties.name}</strong><br/>
              <span style="font-size:0.85rem">Total: ${m.volumeMT.toLocaleString()} MT</span><br/>
              <span style="font-size:0.85rem;color:#495057">Area: ${(m.area || 0).toLocaleString()} m² · ${(m.beds || 0).toLocaleString()} beds</span><br/>
              <span style="font-size:0.85rem;color:#495057">${(m.registered || 0).toLocaleString()} producers</span><br/>
              <span style="font-size:0.8rem;color:#6c757d">Click for full details</span>
            </div>
          `,
          { sticky: true, direction: 'top', offset: [0, -10] }
        );
        layer.on({
          mouseover: (e) => {
            const target = e.target;
            target.setStyle({ fillOpacity: 0.9, weight: 2.5 });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              target.bringToFront();
            }
            target.openTooltip();
          },
          mouseout: (e) => {
            geoJsonLayerRef.current.resetStyle(e.target);
            e.target.closeTooltip();
          },
          click: () => {
            if (openPopupRef.current && openPopupRef.current !== layer) {
              openPopupRef.current.closePopup();
            }
            openPopupRef.current = layer;
            const html = renderPopup(feature, m);
            layer.bindPopup(html, {
              className: 'admin-map-popup',
              maxWidth: 260,
              closeButton: true,
            }).openPopup();
          },
        });
      },
    }).addTo(map);

    if (geoJsonLayerRef.current) {
      map.fitBounds(geoJsonLayerRef.current.getBounds(), { padding: [24, 24] });
    }
  }, [muniData, min, max, renderPopup]);

  return (
    <Row className="g-3 mb-4">
      <Col lg={12}>
        <Card className="encoder-card h-100">
          <Card.Header>
            <div className="admin-card-head">
              <span className="admin-card-head-icon admin-kpi-accent-oceanbg"><MapPin size={16} strokeWidth={2} /></span>
              <div>
                <h5 className="admin-card-head-title">Salt Production Across Pangasinan</h5>
                <span className="fw-normal text-muted small ms-1">Hover for summary · click for full details</span>
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="map-wrapper map-wrapper-float">
              <div className="map-container" ref={mapRef}></div>
            </div>
            <div className="map-legend" aria-label="Map legend">
              <div className="map-gradient-caption">
                <span className="map-legend-label">Lower production</span>
                <span className="map-legend-label">Higher production</span>
              </div>
              <div
                className="map-gradient-legend"
                style={{ backgroundImage: `linear-gradient(90deg, ${OCEAN_LIGHT} 0%, ${BRAND.ocean} 100%)` }}
              ></div>
              <p className="map-range-note">
                {min.toLocaleString()} MT → {max.toLocaleString()} MT across the {muniData.length} municipalities
              </p>
            </div>
            <p className="text-muted small mb-0 mt-2">
              Based on total recorded volume from approved production records. Municipal boundaries referenced from
              NAMRIA / PSA administrative data; base map &copy; OpenStreetMap contributors.
            </p>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}