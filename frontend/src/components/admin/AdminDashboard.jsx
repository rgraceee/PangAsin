import React, { Component, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Alert, Card } from 'react-bootstrap';
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
import { addBasemap, buildProvinceMaskRings, addProvinceMask } from '../../utils/mapLayers';
import { buildMapDetailCard, clampMapDetailTooltip } from '../../utils/mapDetailCard';
import geojson from '../../data/pangasinan_municipalities.json';
import geojsonAll from '../../data/pangasinan_municipalities_all.json';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';
import PageHeader from './PageHeader';
import { SkeletonBlock, SkeletonCards, SkeletonChart } from '../Skeleton';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';

const normName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(city|of|municipality)\b/g, ' ').replace(/\s+/g, ' ').trim();

const prettyName = (raw) => raw.replace(/^City of (.+)$/, '$1 City');

/* WHAT: Tiny error boundary that wraps ONLY the hero map art.
   WHY: a projection or render error inside the decorative SVG must never
        white-screen the whole admin dashboard again. Fallback renders nothing. */
class HeroMapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err) {
    /* WHAT: Log to console so the failure is visible during dev/debug.
       WHY: we intentionally swallow the render so the rest of the dashboard stays alive. */
    console.error('[AdminDashboard] Hero map art failed to render:', err);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/* WHAT: Format ng admin month key (YYYY-MM) papuntang "Mon YYYY".
   WHY: Pare-parehong label sa month select ng header at dati sa trend card. */
function monthLabel(ym) {
  const [y, mo] = String(ym || '').split('-');
  const d = new Date(Number(y), Number(mo) - 1);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
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
  const [reportingMunis, setReportingMunis] = useState([]);
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
        /* WHAT: Mga munisipyo na may approved records sa panahon (galing sa trends).
           WHY: ito ang "municipalities reporting" na chip; wala tayong bagong API call. */
        setReportingMunis(tr.municipalities || []);
        setPeriod(tr.period || null);
        setOutlook(ol.municipalities || []);
        setSupplyDemand(sd);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [selectedAdminMonth]);

  /* WHAT: muniData mula sa stats (default: [] habang/sa hindi pa ready).
     WHY: null-safe — kung wala pa ang stats o nawawala ang by_municipality
          array, huwag mag-.map sa undefined (dati ay nag-crash sa hero art). */
  const muniData = useMemo(() => {
    if (!stats) return [];
    return (stats.by_municipality || [])
      .map((m) => ({
        name: m.municipality_name,
        volumeMT: Math.round((m.total_volume_mt || 0) * 1000) / 1000,
        beds: m.total_salt_beds,
        area: m.total_area_sqm,
        registered: m.total_registered_producers,
        male: m.total_male_producers,
        female: m.total_female_producers,
        records: m.record_count,
        efficiency: m.total_salt_beds > 0 ? Math.round((m.total_volume_mt / m.total_salt_beds) * 1000) / 1000 : 0,
      }))
      .sort((a, b) => b.volumeMT - a.volumeMT);
  }, [stats]);

  /* WHAT: Pinakahuling forecast run date mula sa outlook (may last_run_at na).
     WHY: Ito lang ang available na "last run" data sa dashboard; walang bagong fetch. */
  const lastRunAt = useMemo(() => {
    const stamps = outlook
      .map((o) => (o.last_run_at ? new Date(o.last_run_at).getTime() : NaN))
      .filter((t) => Number.isFinite(t));
    return stamps.length ? new Date(Math.max(...stamps)) : null;
  }, [outlook]);

  if (loading) {
    return (
      <div className="skeleton-dashboard">
        <div className="ui-pageheader ui-pageheader--dashboard">
          {/* WHAT: Skeleton placeholders para sa hero title/subtitle at stat strip.
             WHY: habang nagi-load pa ang stats, may nakikitang loading state sa
                  header (hindi blank), bago lumabas ang totoong art/stat. */}
          <SkeletonBlock width="100%" height={24} />
          <SkeletonBlock className="mt-2" width="60%" height={13} />
          <div className="mt-3 d-flex gap-2">
            <div className="skeleton-card" style={{ flex: 1, height: 60 }} />
            <div className="skeleton-card" style={{ flex: 1, height: 60 }} />
            <div className="skeleton-card" style={{ flex: 1, height: 60 }} />
            <div className="skeleton-card" style={{ flex: 1, height: 60 }} />
          </div>
        </div>
        <div className="mt-4"><SkeletonCards count={4} /></div>
        <div className="row g-3 mt-1">
          <div className="col-lg-7"><div className="skeleton-card"><SkeletonChart height={300} /></div></div>
          <div className="col-lg-5"><div className="skeleton-card"><SkeletonChart height={300} /></div></div>
        </div>
      </div>
    );
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const totalVolumeMT = Math.round((stats.total_volume_mt || 0) * 1000) / 1000;
  const demandBenchmark = supplyDemand?.pangasinan?.demand_volume ?? 0;
  const supplyDemandGap = demandBenchmark ? totalVolumeMT - demandBenchmark : null;
  const supplyDemandLabel = supplyDemandGap == null ? 'N/A' : (supplyDemandGap >= 0 ? 'Surplus' : 'Shortage');

  const readyMunis = outlook.filter((o) => o.readiness !== 'not_ready').length;
  const totalMunis = outlook.length || muniData.length;

  const pendingValidation = stats.pending_validation_count ?? 0;
  const saltTotal = geojson.features.length;
  const reportingCount = Math.min(reportingMunis.length, saltTotal);

  /* WHAT: Stat strip (3-4 equal columns, 1px dividers) inside the same card below the top row.
     WHY: show only items whose data is already loaded; pending links to /admin/validation
          and is amber when N>0. Strip becomes a 2x2 grid below 768px. */
  const statItems = [];
  statItems.push({
    label: 'Total production',
    value: `${totalVolumeMT.toLocaleString()} MT`,
    trend: null,
  });
  statItems.push({
    label: 'Pending validation',
    value: pendingValidation > 0 ? String(pendingValidation) : 'All caught up',
    tone: pendingValidation > 0 ? 'warn' : 'neutral',
    link: '/admin/validation',
  });
  statItems.push({
    label: 'Municipalities reporting',
    value: `${reportingCount} of ${saltTotal}`,
  });
  if (lastRunAt) {
    statItems.push({
      label: 'Last forecast run',
      value: lastRunAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    });
  }

  const statStrip = (
    <div className="ui-dashstats" role="list">
      {statItems.map((item, idx) => (
        <div key={item.label} className={`ui-dashstat${idx > 0 ? ' ui-dashstat--divided' : ''}`} role="listitem">
          <div className="ui-dashstat__label">{item.label}</div>
          <div className={`ui-dashstat__value${item.tone === 'warn' ? ' ui-dashstat__value--warn' : ''}`}>
            {item.link ? <Link to={item.link} className="ui-dashstat__link">{item.value}</Link> : item.value}
          </div>
          {item.trend ? <div className="ui-dashstat__trend">{item.trend}</div> : null}
        </div>
      ))}
    </div>
  );

  /* WHAT: Kanang block ng header: month selector + dalawang actions.
     WHY: Hindi binago ang existing state/handler ng selector (selectedAdminMonth). */
  const headerActions = (
    <>
      <select
        className="ui-pageheader-select ui-dashselect"
        value={selectedAdminMonth}
        onChange={(e) => setSelectedAdminMonth(e.target.value)}
        aria-label="Select month"
      >
        {adminMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
      <Link className="ui-btn-outline" to="/admin/reports">Generate report</Link>
      <Link className="ui-btn-primary" to="/admin/validation">Validation queue</Link>
    </>
  );

return (
    <div>
      {/* WHAT: Polished hero card matching the encoder style: 20px radius, 1px border,
         overflow hidden, white-to-accent-tint horizontal wash, faint dot pattern fading
         to the left, province-mode map art with salt municipalities highlighted and
         pulsing dots staggered by 150ms. */}
      <PageHeader
        id="admin-dashboard"
        variant="clean"
        className="ui-pageheader--dashboard"
        title="Dashboard"
        subtitle="Province-wide salt production monitoring for Pangasinan."
        stat={statStrip}
        actions={headerActions}
        art={(
          <HeroMapErrorBoundary>
            <MunicipalityMapArt mode="province" muniData={muniData || []} />
          </HeroMapErrorBoundary>
        )}
      />

      <MunicipalityMap muniData={muniData} />

      <KpiGrid columns={3}>
        <KpiCard icon={Boxes} title="Total Production" value={totalVolumeMT} unit="MT" supporting={`${totalVolumeMT.toLocaleString()} MT recorded`} accent="ocean" />
        <KpiCard icon={Ruler} title="Production Area" value={stats.total_area_sqm} unit="m²" supporting="Combined area of all beds" accent="ocean" />
        <KpiCard
          icon={Scale}
          title="Supply-Demand Balance"
          value={supplyDemandGap == null ? 'N/A' : `${supplyDemandLabel} ${Math.abs(Math.round(supplyDemandGap)).toLocaleString()}`}
          unit={supplyDemandGap == null ? undefined : 'MT'}
          supporting={demandBenchmark ? `vs ${demandBenchmark.toLocaleString()} MT demand benchmark` : 'No demand benchmark available'}
          accent="gold"
        />
      </KpiGrid>

      <KpiGrid columns={3}>
        <KpiCard icon={LayoutGrid} title="Total Salt Beds" value={stats.total_salt_beds} supporting="Active production beds" accent="ocean" />
        <KpiCard icon={Hourglass} title="Pending Validation" value={stats.pending_validation_count} supporting="Awaiting admin review" accent="gold" tone="warning" />
        <KpiCard
          icon={CalendarCheck}
          title="Forecast Availability"
          value={`${readyMunis} / ${totalMunis}`}
          supporting="Municipalities with forecast data"
          accent="green"
        />
      </KpiGrid>
      {/* WHAT: Ang malaking interactive map ay nasa <MunicipalityMap> na sa taas.
         WHY: Dati may duplicate na inline copy dito na nag-reference ng mapRef/min/max
              na wala sa scope — ReferenceError → white screen. Ang design ay mag-isa
              na nito (hero + KPI cards), kaya hindi na kailangan ang extra Row. */}
    </div>
  );
}

function MunicipalityMap({ muniData }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geoJsonLayerRef = useRef(null);
  const detailOpenRef = useRef(false);

  const { min, max } = useMemo(() => {
    const values = muniData.map((m) => m.volumeMT);
    const mn = values.length ? Math.min(...values) : 0;
    const mx = values.length ? Math.max(...values) : 0;
    return { min: mn, max: mx };
  }, [muniData]);

  const renderPopup = useCallback((m) => {
    const genderText = m.registered > 0
      ? `${(m.male || 0).toLocaleString()} / ${(m.female || 0).toLocaleString()}`
      : '—';
    return buildMapDetailCard({
      name: m.name,
      rows: [
        ['Total Volume', `${m.volumeMT.toLocaleString()} MT`],
        ['Record Count', (m.records ?? 0).toLocaleString()],
        ['Production Area', `${(m.area || 0).toLocaleString()} m²`],
        ['Salt Beds', (m.beds || 0).toLocaleString()],
        ['Registered Producers', (m.registered || 0).toLocaleString()],
        ['Male / Female', genderText],
        ['MT per Bed', (m.efficiency ?? 0).toLocaleString()],
      ],
    });
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const byName = Object.fromEntries(muniData.map((m) => [normName(m.name), m]));
    const scaledFor = (value) => oceanScale(value, min, max);
    const producingNames = new Set(muniData.map((m) => normName(m.name)));

    const allFeatures = [...geojsonAll.features, ...geojson.features];
    const provinceBounds = L.geoJSON(allFeatures).getBounds();

    const map = L.map(mapRef.current, {
      minZoom: 7,
      maxZoom: 15,
      maxBoundsViscosity: 1.0,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false,
    }).setView(provinceBounds.getCenter(), 8);
    mapInstanceRef.current = map;

    addBasemap(map);
    /* WHAT: Lighter province mask so the big map reads light without a new provider.
       WHY: reduced dark tint keeps boundaries visible while lifting the overall tone. */
    addProvinceMask(map, buildProvinceMaskRings([geojsonAll, geojson], provinceBounds));

    const detailAnchor = L.marker([0, 0], {
      icon: L.divIcon({ className: 'detail-anchor', html: '', iconSize: [0, 0] }),
      interactive: false,
    }).addTo(map);
    detailAnchor.bindTooltip('', {
      direction: 'right',
      sticky: false,
      interactive: true,
      className: 'admin-map-detail',
      opacity: 1,
      offset: [14, 30],
    });
    map.on('click', (e) => {
      const target = e.originalEvent && e.originalEvent.target;
      if (target && target.classList && target.classList.contains('leaflet-interactive')) return;
      detailOpenRef.current = false;
      if (detailAnchor.isTooltipOpen()) detailAnchor.closeTooltip();
    });
    map.on('moveend zoomend', () => {
      if (detailAnchor.isTooltipOpen()) {
        window.requestAnimationFrame(() => clampMapDetailTooltip(map, detailAnchor, mapRef.current));
      }
    });

    const contextFeatures = geojsonAll.features.filter(
      (f) => !producingNames.has(normName(f.properties.shapeName || f.properties.name || ''))
    );

    L.geoJSON(contextFeatures, {
      style: {
        fillColor: '#E2E8F0',
        fillOpacity: 0.65,
        weight: 1.2,
        opacity: 0.85,
        color: '#94A3B8',
      },
      onEachFeature: (feature, layer) => {
        const label = prettyName(feature.properties.shapeName || feature.properties.name || '');
        layer.bindTooltip(
          `<div style="min-width:170px"><strong>${label}</strong><br/><span style="font-size:0.85rem;color:#6B7280">No production data recorded yet</span></div>`,
          { sticky: true, direction: 'auto', offset: [0, -8] }
        );
        L.marker(layer.getBounds().getCenter(), {
          icon: L.divIcon({ className: 'muni-name-label', html: label, iconSize: null }),
          interactive: false,
        }).addTo(map);
      },
    }).addTo(map);

    geoJsonLayerRef.current = L.geoJSON(geojson, {
      style: (feature) => {
        const m = byName[normName(feature.properties.name)];
        return {
          fillColor: m ? scaledFor(m.volumeMT) : '#cbd5e1',
          weight: 1.5,
          opacity: 0.9,
          color: '#ffffff',
          fillOpacity: 0.72,
        };
      },
      onEachFeature: (feature, layer) => {
        const m = byName[normName(feature.properties.name)];
        if (!m) return;
        layer.bindTooltip(
          `
            <div style="min-width:170px">
              <strong>${m.name}</strong><br/>
              <span style="font-size:0.85rem">Total: ${m.volumeMT.toLocaleString()} MT</span><br/>
              <span style="font-size:0.85rem;color:#495057">Area: ${(m.area || 0).toLocaleString()} m² · ${(m.beds || 0).toLocaleString()} beds</span><br/>
              <span style="font-size:0.85rem;color:#495057">${(m.registered || 0).toLocaleString()} producers</span><br/>
              <span style="font-size:0.8rem;color:#6c757d">Click for full details</span>
            </div>
          `,
          { sticky: true, direction: 'auto', offset: [0, -10] }
        );
        layer.on({
          mouseover: (e) => {
            const target = e.target;
            if (detailOpenRef.current) return;
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
          click: (e) => {
            L.DomEvent.stopPropagation(e.originalEvent);
            detailOpenRef.current = true;
            layer.closeTooltip();
            const html = renderPopup(m);
            const b = layer.getBounds();
            const anchor = L.latLng(
              b.getCenter().lat,
              b.getCenter().lng + (b.getEast() - b.getCenter().lng) * 0.6
            );
            detailAnchor.setLatLng(anchor);
            detailAnchor.setTooltipContent(html);
            detailAnchor.openTooltip();
            window.requestAnimationFrame(() => clampMapDetailTooltip(map, detailAnchor, mapRef.current));
          },
        });

        L.marker(layer.getBounds().getCenter(), {
          icon: L.divIcon({ className: 'muni-name-label', html: prettyName(m.name), iconSize: null }),
          interactive: false,
        }).addTo(map);
      },
    }).addTo(map);

if (geoJsonLayerRef.current) {
      const container = mapRef.current;
      let resizeObserver = null;
      let fitted = false;
      const fitToProvince = () => {
        if (fitted) return;
        fitted = true;
        map.invalidateSize();
        map.setMaxBounds(provinceBounds.pad(0.06));
        map.fitBounds(provinceBounds, { padding: [10, 10] });
        if (resizeObserver) resizeObserver.disconnect();
      };
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (container && container.getBoundingClientRect().height > 0) fitToProvince();
        });
        resizeObserver.observe(container);
      } else {
        window.requestAnimationFrame(fitToProvince);
      }
    }
  }, [muniData, min, max, renderPopup]);

  return (
    <Row className="g-3 mb-4">
      <Col lg={12}>
        <Card className="encoder-card h-100 admin-map-section">
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
            <div className="map-wrapper">
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
              Based on total recorded volume from approved production records. Shaded gray municipalities have no
              recorded production yet. Municipal boundaries referenced from NAMRIA / PSA administrative data.
              &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.
            </p>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}