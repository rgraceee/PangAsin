import React, { Component, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Alert, Card } from 'react-bootstrap';
import L from 'leaflet';
import { Boxes, Scale, MapPin, Building2 } from 'lucide-react';
import {
  getAdminStats, getAdminSupplyDemand,
} from '../../services/dataService';
import { BRAND, greenScale, GREEN_LIGHT, GREEN_DARK } from '../../theme/colors';
import { buildProvinceMaskRings, addProvinceMask, addLightBasemap, getProductionTier, computeTierThresholds, NON_PRODUCING_FILL, NON_PRODUCING_BORDER } from '../../utils/mapLayers';
import { buildMapDetailCard, createMapDetailPopup, openMapDetailPopup } from '../../utils/mapDetailCard';
import geojson from '../../data/pangasinan_municipalities.json';
import geojsonAll from '../../data/pangasinan_municipalities_all.json';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';
import PageHeader from './PageHeader';
import { SkeletonCards, SkeletonChart } from '../Skeleton';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import DashboardFilters, { useDashboardFilters } from './DashboardFilters';

const normName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(city|of|municipality)\b/g, ' ').replace(/\s+/g, ' ').trim();

const prettyName = (raw) => raw.replace(/^City of (.+)$/, '$1 City');

/* WHAT: Consistent Metric Tons (MT) formatting — max 2 decimals + thousands separators.
   WHY: pareho ang pagtitingnan ng lahat ng volume sa buong dashboard. */
const fmtMT = (v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

function buildMunicipalityTooltip(municipality, tierThresholds) {
  const tier = getProductionTier(municipality.volumeMT, tierThresholds);
  const tierLabel = `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
  return `
    <div style="min-width:170px">
      <strong>${municipality.name}</strong><br/>
      <span style="font-size:0.85rem">Total: ${fmtMT(municipality.volumeMT)} Metric Tons (MT)</span><br/>
      <span style="font-size:0.85rem">Tier: ${tierLabel}</span><br/>
      <span style="font-size:0.85rem;color:#495057">Area: ${fmtMT(municipality.area)} m² · ${(municipality.beds || 0).toLocaleString()} beds</span><br/>
      <span style="font-size:0.85rem;color:#495057">${(municipality.registered || 0).toLocaleString()} salt farmers</span><br/>
      <span style="font-size:0.8rem;color:#6c757d">Click for full details</span>
    </div>
  `;
}

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

export default function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [supplyDemand, setSupplyDemand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* WHAT: Isang filter source para sa buong dashboard: municipality + period.
     WHY: the chip, Year, and Month controls above the KPIs must scope every
          section with the same values, and the URL is the shared state. */
  const {
    selectedMuni,
    selectedMunicipalitySlug,
    selYear,
    selMonth,
    mode,
    rangeStart,
    rangeEnd,
    muniOptions: activeNames,
  } = useDashboardFilters();

  /* WHAT: Supply/demand benchmark ay province-wide at hindi sumasabay sa filter.
     WHY: isang beses lang ito kailangan; separate effect para hindi ito
          nagre-refetch tuwing magbabago ang municipality o period. */
  useEffect(() => {
    let active = true;
    getAdminSupplyDemand()
      .then((sd) => { if (active) setSupplyDemand(sd); })
      .catch(() => { if (active) setSupplyDemand(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let active = true;

    const params = { source: 'municipality_production' };
    if (selectedMunicipalitySlug) params.municipality = selectedMunicipalitySlug;
    if (mode === 'range') {
      if (rangeStart && rangeEnd) {
        params.start = rangeStart;
        params.end = rangeEnd;
      }
    } else {
      params.year = selYear;
      if (selMonth) params.month = Number(selMonth);
    }

    getAdminStats(params)
      .then((s) => {
        if (!active) return;
        setStats(s);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { active = false; };
  }, [selectedMunicipalitySlug, mode, rangeStart, rangeEnd, selYear, selMonth]);

  /* WHAT: muniData mula sa stats (default: [] habang/sa hindi pa ready).
     WHY: null-safe — kung wala pa ang stats o nawawala ang by_municipality
          array, huwag mag-.map sa undefined (dati ay nag-crash sa hero art). */
  const muniData = useMemo(() => {
    if (!stats) return [];
    return (stats.by_municipality || [])
      .map((m) => ({
        name: m.municipality_name,
        volumeMT: Math.round((m.total_volume_mt || 0) * 100) / 100,
        beds: m.total_salt_beds,
        area: m.total_area_sqm,
        registered: m.total_registered_producers,
        male: m.total_male_producers,
        female: m.total_female_producers,
        records: m.production_month_count ?? m.record_count,
        efficiency: m.total_salt_beds > 0 ? Math.round((m.total_volume_mt / m.total_salt_beds) * 1000) / 1000 : 0,
      }))
      .sort((a, b) => b.volumeMT - a.volumeMT);
  }, [stats]);

  const totalVolumeMT = stats?.total_volume_mt == null
    ? null
    : Math.round(stats.total_volume_mt * 100) / 100;
  const municipalityCount = muniData.filter((m) => (m.records || 0) > 0).length;
  const demandBenchmark = supplyDemand?.pangasinan?.demand_volume ?? 0;
  const localSupplyMT = supplyDemand?.pangasinan?.local_production;
  const supplyPeriod = supplyDemand?.pangasinan?.local_supply_period;
  const demandYear = supplyDemand?.pangasinan?.year;
  const supplyDemandGap = demandBenchmark && localSupplyMT != null
    ? localSupplyMT - demandBenchmark
    : null;
  const supplyDemandLabel = supplyDemandGap == null ? 'N/A' : (supplyDemandGap >= 0 ? 'Surplus' : 'Shortage');
  const supplySourceNote = supplyPeriod
    ? `Pangasinan-wide comparison, unaffected by dashboard filters. Supply uses Adjusted_Estimates.xlsx from ${supplyPeriod.start} to ${supplyPeriod.end}; demand is the ${demandYear} annual benchmark.`
    : 'Municipality production data is not available for the supply comparison.';

  const scopeName = selectedMuni || 'Pangasinan';
  const subtitle = `Record, review, and manage salt production data for ${scopeName}.`;
  const showSkeleton = loading && !stats;

  return (
    <div className="admin-dashboard-page">
      {/* WHAT: Polished hero card matching the encoder style: 20px radius, 1px border,
         overflow hidden, white-to-accent-tint horizontal wash, faint dot pattern fading
         to the left, province-mode map art with salt municipalities highlighted and
         pulsing dots staggered by 150ms. */}
      <PageHeader
        id="admin-dashboard"
        variant="clean"
        className="ui-pageheader--admin"
        title="Dashboard"
        subtitle={subtitle}
        art={(
          <HeroMapErrorBoundary>
            <MunicipalityMapArt mode="province" selectedName={selectedMuni} activeNames={activeNames} />
          </HeroMapErrorBoundary>
        )}
      >
        <DashboardFilters
          loading={loading}
          canSelectMunicipality={user?.role === 'admin'}
        />
      </PageHeader>

      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {showSkeleton ? (
        <div className="skeleton-dashboard" aria-busy="true">
          <SkeletonCards count={4} />
          <div className="row g-3 mt-1">
            <div className="col-lg-12"><div className="skeleton-card"><SkeletonChart height={480} /></div></div>
          </div>
        </div>
      ) : stats ? (
        <div aria-busy={loading ? 'true' : undefined}>
          <KpiGrid columns={4}>
            {/* WHAT: Numeric na value + maliit na unit at badge; hiwalay sa title.
               WHY: pare-parehong format sa lahat ng KPI — thousands, max 2 decimals.
                    (Ang supply/demand balance lang ang province-wide; sumasabay na
                    sa municipality + period filter ang iba.) */}
            <KpiCard
              icon={Scale}
              title="Province-wide Balance"
              value={supplyDemandGap == null ? null : Math.round(Math.abs(supplyDemandGap) * 100) / 100}
              unit={supplyDemandGap == null ? undefined : 'Metric Tons (MT)'}
              badge={supplyDemandLabel === 'N/A' ? undefined : { text: supplyDemandLabel, tone: supplyDemandGap >= 0 ? 'good' : 'bad' }}
              supporting={demandBenchmark ? `vs ${fmtMT(demandBenchmark)} Metric Tons (MT) demand benchmark` : 'No demand benchmark available'}
              info={supplySourceNote}
            />
            <KpiCard
              icon={Boxes}
              title="Total Production"
              value={totalVolumeMT}
              unit="Metric Tons (MT)"
              supporting={`${fmtMT(totalVolumeMT)} Metric Tons (MT) recorded`}
              info="Source: Adjusted_Estimates.xlsx."
            />
            <KpiCard icon={Boxes} title="Total Salt Beds" value={muniData.reduce((s, m) => s + (m.beds || 0), 0)} unit="beds" supporting="Combined salt beds across municipalities" />
            <KpiCard
              icon={Building2}
              title="Municipalities"
              value={municipalityCount}
              supporting="with municipality production data"
              info="Municipalities in scope with at least one month in the municipality production dataset."
            />
          </KpiGrid>

          {/* WHAT: Full-width map — wala nang side panel sa tabi nito.
             WHY: inalis ang lahat ng charts/tables sa gilid; mas malaki ang mapa.
                  Remount kapag iba ang municipality scope para tama ang context
                  layers (green producing vs gray non-producing) sa unang paint. */}
          <MunicipalityMap
            key={selectedMunicipalitySlug || 'all'}
            muniData={muniData}
            selectedName={selectedMuni}
          />
        </div>
      ) : null}
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

  const tierThresholds = useMemo(() => computeTierThresholds(muniData.map((m) => m.volumeMT)), [muniData]);
  const sortedVals = useMemo(() => [...muniData.map((m) => m.volumeMT)].filter((v) => v != null).sort((a, b) => a - b), [muniData]);
  const lowMax = sortedVals[Math.max(0, Math.floor(sortedVals.length / 3) - 1)] ?? tierThresholds[0];
  const mediumMin = sortedVals[Math.floor(sortedVals.length / 3)] ?? tierThresholds[0];
  const mediumMax = sortedVals[Math.max(0, sortedVals.length - Math.floor(sortedVals.length / 3) - 1)] ?? tierThresholds[1];
  const highMin = sortedVals[Math.max(0, sortedVals.length - Math.floor(sortedVals.length / 3))] ?? tierThresholds[1];

  const municipalityDataRef = useRef({});
  municipalityDataRef.current = Object.fromEntries(
    muniData.map((municipality) => [normName(municipality.name), municipality]),
  );

  const mapScaleRef = useRef({ min, max, tierThresholds });
  mapScaleRef.current = { min, max, tierThresholds };

  const renderPopup = useCallback((m) => {
    const genderText = m.registered > 0
      ? `${(m.male || 0).toLocaleString()} / ${(m.female || 0).toLocaleString()}`
      : '—';

    return buildMapDetailCard({
      name: m.name,
      rows: [
        ['Total Volume', `${m.volumeMT.toLocaleString()} Metric Tons (MT)`],
        ['Record Count', (m.records ?? 0).toLocaleString()],
        ['Production Area', `${(m.area || 0).toLocaleString()} m²`],
        ['Salt Beds', (m.beds || 0).toLocaleString()],
        ['Registered Salt Farmers', (m.registered || 0).toLocaleString()],
        ['Male / Female', genderText],
      ],
    });
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const producingNames = new Set(muniData.map((m) => normName(m.name)));

    const allFeatures = [...geojsonAll.features, ...geojson.features];
    const provinceBounds = L.geoJSON(allFeatures).getBounds();

    const map = L.map(mapRef.current, {
      minZoom: 7,
      maxZoom: 15,
      maxBoundsViscosity: 1.0,

      /* WHAT: Zoom +/- (top-left) at draggable ang mapa.
         WHY: dating admin map (Sep 18) ay nangangailangan ng +/- up/down sa
              gilid at naka-drag para makita ang buong lalawigan. */
      zoomControl: true,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false,
    }).setView(provinceBounds.getCenter(), 8);

    mapInstanceRef.current = map;

    /* WHAT: OSM basemap (dating admin look) + madilim na province mask.
       WHY: walang API key at walang watermark ang OSM; ang dark mask ay ang
            mismong dating itsura ng admin map. */
    addLightBasemap(map);
    addProvinceMask(map, buildProvinceMaskRings([geojsonAll, geojson], provinceBounds), {
      fillColor: '#ffffff',
      fillOpacity: 1,
    });

    /* WHAT: Native popup na may auto-pan at malaking close button.
       WHY: Hindi na kailangang i-clamp ang tooltip; buo ang card kahit
            malapit ito sa gilid ng mapa, public man o admin. */
    const detailPopup = createMapDetailPopup({
      onClose: () => {
        detailOpenRef.current = false;
      },
    });
    map.on('click', (e) => {
      const target = e.originalEvent && e.originalEvent.target;
      if (target && target.classList && target.classList.contains('leaflet-interactive')) return;
      if (detailPopup.isOpen()) detailPopup.close();
    });

    const contextFeatures = geojsonAll.features.filter(
      (f) => !producingNames.has(normName(f.properties.shapeName || f.properties.name || '')),
    );

    /* WHAT: Non-producing na bayan = context outline + pangalan (walang datos).
       WHY: labeling lahat ng 48 bayan para makita ang buong lalawigan, gaya
            ng dating (Sep 18) admin map. */
    L.geoJSON(contextFeatures, {
      style: {
        fillColor: NON_PRODUCING_FILL,
        fillOpacity: 0.6,
        weight: 1.2,
        opacity: 0.85,
        color: NON_PRODUCING_BORDER,
      },
      onEachFeature: (feature, layer) => {
        const label = prettyName(feature.properties.shapeName || feature.properties.name || '');
        layer.bindTooltip(
          `<div style="min-width:170px"><strong>${label}</strong><br/><span style="font-size:0.85rem;color:#6B7280">No production data recorded yet</span></div>`,
          { sticky: true, direction: 'auto', offset: [0, -8] },
        );
      },
    }).addTo(map);

    geoJsonLayerRef.current = L.geoJSON(geojson, {
      style: (feature) => {
        const m = municipalityDataRef.current[normName(feature.properties.name)];
        const { min: currentMin, max: currentMax } = mapScaleRef.current;
        return {
          fillColor: m ? greenScale(m.volumeMT, currentMin, currentMax) : NON_PRODUCING_FILL,
          weight: 1.5,
          opacity: 0.9,
          color: '#ffffff',
          fillOpacity: m ? 0.9 : 0.6,
        };
      },
      onEachFeature: (feature, layer) => {
        const municipalityKey = normName(feature.properties.name);
        const m = municipalityDataRef.current[municipalityKey];
        if (!m) return;

        layer.bindTooltip(buildMunicipalityTooltip(m, tierThresholds), {
          sticky: true,
          direction: 'auto',
          offset: [0, -10],
        });

        layer.on({
          mouseover: (e) => {
            const target = e.target;
            if (detailOpenRef.current) return;

            const currentMuni = municipalityDataRef.current[municipalityKey];
            if (!currentMuni) return;

            target.setTooltipContent(
              buildMunicipalityTooltip(currentMuni, mapScaleRef.current.tierThresholds),
            );

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

            const currentMuni = municipalityDataRef.current[municipalityKey];
            if (!currentMuni) return;

            const html = renderPopup(currentMuni);
            const b = layer.getBounds();
            const anchor = L.latLng(
              b.getCenter().lat,
              b.getCenter().lng + (b.getEast() - b.getCenter().lng) * 0.6,
            );

            openMapDetailPopup(map, detailPopup, { latlng: anchor, html });
          },
        });

        if (m) {
          L.marker(layer.getBounds().getCenter(), {
            icon: L.divIcon({ className: 'muni-name-label', html: prettyName(m.name), iconSize: null }),
            interactive: false,
          }).addTo(map);
        }
      },
    }).addTo(map);

    if (geoJsonLayerRef.current) {
      const container = mapRef.current;
      let resizeObserver = null;
      let fitted = false;

      /* WHAT: Buong lalawigan ang inilalagay sa loob ng view (dating admin look).
         WHY: dating (Sep 18) admin map ay ipinapakita ang buong Pangasinan
              sa isang sulyap — hindi lang ang mga bayang may datos. */
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
  }, []);

  useEffect(() => {
    const gl = geoJsonLayerRef.current;
    if (!gl) return;

    const selKey = selectedName ? normName(selectedName) : '';

    gl.eachLayer((layer) => {
      const municipalityKey = normName(layer.feature?.properties?.name || '');
      const municipality = municipalityDataRef.current[municipalityKey];

      if (!municipality) {
        gl.resetStyle(layer);
        return;
      }

      const style = municipalityKey === selKey
        ? { fillColor: BRAND.ocean, fillOpacity: 0.96, weight: 3, color: '#ffffff', opacity: 1 }
        : {
          fillColor: greenScale(municipality.volumeMT, min, max),
          fillOpacity: 0.9,
          weight: 1.5,
          color: '#ffffff',
          opacity: 0.9,
        };

      layer.setStyle(style);
      layer.setTooltipContent(
        buildMunicipalityTooltip(municipality, tierThresholds),
      );
    });
  }, [muniData, min, max, tierThresholds, selectedName]);

  return (
    <Card className="encoder-card h-100 admin-map-section">
      <Card.Header>
        <div className="admin-card-head">
          <span className="admin-card-head-icon admin-card-head-icon--soft"><MapPin size={16} strokeWidth={2} /></span>
          <div>
            <h5 className="admin-card-head-title">Salt Production Across Pangasinan</h5>
            <span className="admin-card-head-sub">
              Darker municipalities produce more salt; hover for a summary or click for full details.
            </span>
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
            style={{ backgroundImage: `linear-gradient(90deg, ${GREEN_LIGHT} 0%, ${GREEN_DARK} 100%)` }}
          ></div>

          <p className="map-range-note">
            {fmtMT(min)} Metric Tons (MT) → {fmtMT(max)} Metric Tons (MT) across the {muniData.length}{' '}
            {muniData.length === 1 ? 'municipality' : 'municipalities'}
          </p>
        </div>

        <p className="text-muted small mb-0 mt-2">
          Production shading uses municipality dataset volume for the selected year and month; area, beds, and
          producer details use approved operational records. 2026 workbook estimates are not independent observations.
          Shaded gray municipalities have no dataset production in this period. Municipal boundaries referenced from NAMRIA / PSA administrative data.
          &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.
        </p>
      </Card.Body>
    </Card>
  );
}

/* WHAT: Demand snapshot tinanggal na — kailangan na lang ng full-width map.
   (Ang supply-demand context ay makikita sa Supply & Demand Analytics page.) */
