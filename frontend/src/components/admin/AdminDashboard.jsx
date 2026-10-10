import React, { Component, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Row, Col, Alert, Card } from 'react-bootstrap';
import L from 'leaflet';
import { Boxes, LayoutGrid, Ruler, Hourglass, Scale, CalendarCheck, MapPin } from 'lucide-react';
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

/* WHAT: Mga pagpipilian sa Municipality filter (7 salt-producing + Pangasinan).
   WHY: parehas na ayos sa SALT_LIST ng MunicipalityMapArt para tugma ang highlight. */
const MUNI_OPTIONS = ['Alaminos City', 'Anda', 'Bani', 'Bolinao', 'Dasol', 'Infanta', 'San Fabian'];

/* WHAT: Maikling pangalan ng buwan para sa Month dropdown (Jan..Dec).
   WHY: compact na opsyon lang; ang buong period ay binubuo mula Month + Year. */
const MONTH_SHORTS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleString(undefined, { month: 'short' }));
const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => String(i + 1));

export default function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [reportingMunis, setReportingMunis] = useState([]);
  const [outlook, setOutlook] = useState([]);
  const [supplyDemand, setSupplyDemand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminMonths, setAdminMonths] = useState([]);

  /* WHAT: URL-driven filters (muni/month/year) gamit ang query params.
     WHY: shareable/reload-safe ang view; ang dashboard ay view lang (walang bagong API). */
  const [searchParams, setSearchParams] = useSearchParams();
  const urlMuni = searchParams.get('muni') || '';
  const urlMonthRaw = searchParams.get('month') || '';
  const urlYearRaw = searchParams.get('year') || '';

  /* WHAT: Sanitize ang URL month/year — huwag ipadala ang invalid na value sa trends.
     WHY: ang '/trends?month=13' ay magbabalik ng 400; i-ignore na lang ang invalid. */
  const isAllMonths = urlMonthRaw === 'all';
  const monthNumber = Number(urlMonthRaw);
  const hasValidMonth = !isAllMonths && urlMonthRaw !== '' && Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12;
  const hasValidYear = /^\d{4}$/.test(urlYearRaw);

  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  /* WHAT: Default na period = ngayong buwan; kung wala ito sa adminMonths ay
     gamitin ang pinakahuling buwan na may data (kaparehas ng dating behavior).
     WHY: kapag walang URL params, may sensible na default pa rin ang dashboard. */
  const resolvedDefaultMonth = useMemo(() => {
    if (adminMonths.length > 0 && !adminMonths.includes(todayIso)) {
      return adminMonths[adminMonths.length - 1];
    }
    return todayIso;
  }, [adminMonths, todayIso]);

  const selectedMuni = urlMuni; // '' = Pangasinan (province-wide)
  const selYear = hasValidYear ? urlYearRaw : resolvedDefaultMonth.slice(0, 4);
  const selMonth = isAllMonths ? '' : (hasValidMonth ? urlMonthRaw : resolvedDefaultMonth.slice(5, 7));
  /* WHAT: Pinagsamang period key (YYYY-MM) o '' kapag "All months".
     WHY: ito ang ipinapasa sa /trends para sa month-scoped reporting stats. */
  const selectedAdminMonth = (isAllMonths || !selMonth)
    ? ''
    : `${selYear}-${String(Number(selMonth)).padStart(2, '0')}`;

  const yearOptions = useMemo(() => {
    const years = new Set(adminMonths.map((m) => m.slice(0, 4)));
    years.add(String(new Date().getFullYear()));
    if (resolvedDefaultMonth) years.add(resolvedDefaultMonth.slice(0, 4));
    if (hasValidYear) years.add(urlYearRaw);
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [adminMonths, resolvedDefaultMonth, hasValidYear, urlYearRaw]);

  useEffect(() => {
    getAdminMonths()
      .then((res) => {
        setAdminMonths(res.months || []);
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
        /* WHAT: Mga munisipyo na may approved records sa panahon (galing sa trends).
           WHY: ito ang "municipalities reporting"; wala tayong bagong API call. */
        setReportingMunis(tr.municipalities || []);
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

  /* WHAT: Hanapin ang napiling munisipalidad sa naka-load na muniData at trends.
     WHY: para maging muni-scoped ang stat strip nang walang bagong API call;
          null-safe ang lahat (— kapag wala ang data). */
  const selectedMuniData = selectedMuni
    ? (muniData.find((m) => normName(m.name) === normName(selectedMuni)) || null)
    : null;
  const muniReportingNow = selectedMuni
    ? reportingMunis.some((r) => normName(typeof r === 'string' ? r : (r && r.name) || '') === normName(selectedMuni))
    : null;

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
     WHY: show only items whose data is already loaded; naka-label ang scope ng bawat stat
          (muni vs province-wide). Pending links to /admin/validation (amber when N>0). */
  const statItems = [];
  if (selectedMuni) {
    /* WHAT: Muni-scoped stats gamit lang ang loaded data. WHY: para hindi misleading. */
    statItems.push({
      label: `Production · ${selectedMuni}`,
      value: selectedMuniData ? `${selectedMuniData.volumeMT.toLocaleString()} MT` : '—',
    });
    statItems.push({
      label: 'Reporting this period',
      value: muniReportingNow ? 'Yes' : 'No',
      tone: muniReportingNow ? 'ok' : 'muted',
    });
    statItems.push({
      label: 'Pending validation · province-wide',
      value: pendingValidation > 0 ? String(pendingValidation) : 'All caught up',
      tone: pendingValidation > 0 ? 'warn' : 'neutral',
      link: '/admin/validation',
    });
    if (lastRunAt) {
      statItems.push({
        label: 'Last forecast run · province-wide',
        value: lastRunAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      });
    }
  } else {
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
  }

  const statToneClass = (tone) => (
    tone === 'warn' ? ' ui-dashstat__value--warn'
      : tone === 'ok' ? ' ui-dashstat__value--ok'
        : tone === 'muted' ? ' ui-dashstat__value--muted'
          : ''
  );

  const statStrip = (
    <div className="ui-dashstats" role="list">
      {statItems.map((item, idx) => (
        <div key={item.label} className={`ui-dashstat${idx > 0 ? ' ui-dashstat--divided' : ''}`} role="listitem">
          <div className="ui-dashstat__label">{item.label}</div>
          <div className={`ui-dashstat__value${statToneClass(item.tone)}`}>
            {item.link ? <Link to={item.link} className="ui-dashstat__link">{item.value}</Link> : item.value}
          </div>
          {item.trend ? <div className="ui-dashstat__trend">{item.trend}</div> : null}
        </div>
      ))}
    </div>
  );

  /* WHAT: Filter bar (municipality / month / year) sa kanang block ng hero.
     WHY: pinapalitan ang dating "Generate report" at "Validation queue" buttons;
          URL-driven ang state para shareable/reload-safe; may Reset kapag non-default. */
  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };
  const resetFilters = () => setSearchParams({});
  const isDefaultFilters = urlMuni === '' && urlMonthRaw === '' && urlYearRaw === '';
  const periodHasData = selectedAdminMonth === '' || adminMonths.includes(selectedAdminMonth);

  const headerActions = (
    <div className="dashboard-filters">
      <label className="dashboard-filter">
        <span className="dashboard-filter__label">Municipality</span>
        <select value={selectedMuni} onChange={(e) => updateParam('muni', e.target.value)}>
          <option value="">Pangasinan</option>
          {MUNI_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="dashboard-filter">
        <span className="dashboard-filter__label">Month</span>
        <select value={selMonth} onChange={(e) => updateParam('month', e.target.value === '' ? 'all' : e.target.value)}>
          <option value="">All months</option>
          {MONTH_NUMBERS.map((num, i) => <option key={num} value={num}>{MONTH_SHORTS[i]}</option>)}
        </select>
      </label>
      <label className="dashboard-filter">
        <span className="dashboard-filter__label">Year</span>
        <select value={selYear} onChange={(e) => updateParam('year', e.target.value)}>
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      {!isDefaultFilters && (
        <button type="button" className="dashboard-filter-reset" onClick={resetFilters}>Reset</button>
      )}
      {!periodHasData && (
        <p className="dashboard-filter-note" role="status">No data for this period.</p>
      )}
    </div>
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
        subtitle={selectedMuni
          ? `Production monitoring for ${selectedMuni}, Pangasinan.`
          : 'Province-wide salt production monitoring for Pangasinan.'}
        stat={statStrip}
        actions={headerActions}
        art={(
          <HeroMapErrorBoundary>
            <MunicipalityMapArt mode="province" selectedName={selectedMuni} />
          </HeroMapErrorBoundary>
        )}
      />

      <MunicipalityMap muniData={muniData} selectedName={selectedMuni} />

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

function MunicipalityMap({ muniData, selectedName }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geoJsonLayerRef = useRef(null);
  const detailOpenRef = useRef(false);
  /* WHAT: Ref na nagdadala ng pinakabagong selectedName papasok sa Leaflet handlers.
     WHY: ang mouseout handler ay na-closure noong init, kaya kailangan ng ref
          para hindi ito makaluma kapag nagbago ang filter. */
  const selectedNameRef = useRef(selectedName);
  selectedNameRef.current = selectedName;

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
            const target = e.target;
            geoJsonLayerRef.current.resetStyle(target);
            /* WHAT: Kung ang layer na ito ang napiling muni, ibalik ang highlight.
               WHY: ang resetStyle ay nagwawala sa highlight kapag na-hover ito. */
            const selKey = selectedNameRef.current ? normName(selectedNameRef.current) : '';
            if (selKey && normName(target.feature?.properties?.name) === selKey) {
              target.setStyle({ fillColor: BRAND.ocean, fillOpacity: 0.96, weight: 3, color: '#ffffff', opacity: 1 });
            }
            target.closeTooltip();
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

  /* WHAT: I-highlight ang napiling munisipalidad sa malaking mapa (reset muna lahat).
     WHY: solid accent + puting border para malinaw kung alin ang naka-filter;
          naiposisyon pagkatapos ng init effect para may layers nang mai-istyle. */
  useEffect(() => {
    const gl = geoJsonLayerRef.current;
    if (!gl) return;
    const selKey = selectedName ? normName(selectedName) : '';
    gl.eachLayer((layer) => {
      gl.resetStyle(layer);
      if (selKey && normName(layer.feature?.properties?.name) === selKey) {
        layer.setStyle({ fillColor: BRAND.ocean, fillOpacity: 0.96, weight: 3, color: '#ffffff', opacity: 1 });
      }
    });
  }, [selectedName]);

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