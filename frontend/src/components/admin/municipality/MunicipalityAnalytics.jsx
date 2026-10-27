// WHAT: The Municipality Analytics section of the Admin Dashboard.
// WHY: one page that says what the approved records and the producer master
//      list actually contain - every panel states its scope and its source, and
//      the scope follows the municipality selector above it.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Col, Row } from 'react-bootstrap';
import { Users, Building2, Layers, MapPin, Info } from 'lucide-react';
import { getAdminStats } from '../../../services/dataService';
import KpiCard from '../../ui/KpiCard';
import KpiGrid from '../../ui/KpiGrid';
import PageHeader from '../PageHeader';
import { SkeletonBlock, SkeletonCards, SkeletonChart } from '../../Skeleton';
import MuniRegisteredChart from './MuniRegisteredChart';
import MuniMethodChart from './MuniMethodChart';
import MuniProfileChart from './MuniProfileChart';
import MuniEnvironmentPanel from './MuniEnvironmentPanel';
import MuniDetailsTable from './MuniDetailsTable';
import {
  scopeRows, normaliseProduction, normaliseMasterList, normaliseMethods, fmtInt,
} from './muniData';
import {
  buildRegisteredRows, buildMethodRows, buildProfile, buildEnvironment, buildTableRows,
} from './muniSelectors';

export default function MunicipalityAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const selectedMuni = searchParams.get('muni') || '';

  useEffect(() => {
    getAdminStats({ source: 'municipality_production' })
      .then((stats) => { setData(stats); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const production = normaliseProduction(data.by_municipality);
    const masterList = normaliseMasterList(data.master_list_by_municipality);
    const methods = normaliseMethods(data.production_methods_mt);
    const scope = scopeRows(production, selectedMuni);
    const masterScope = scopeRows(masterList, selectedMuni);
    const methodScope = scopeRows(methods, selectedMuni);
    const masterTotal = masterScope.reduce((sum, m) => sum + (m.producers || 0), 0);
    return {
      scope,
      scopeLabel: selectedMuni || 'Pangasinan',
      registeredRows: buildRegisteredRows(masterScope),
      registeredTotal: masterTotal,
      method: buildMethodRows(methodScope),
      profile: buildProfile(masterScope),
      environment: buildEnvironment(data.environment_by_municipality || [], scope),
      tableRows: buildTableRows(scope, masterList),
      productionMunicipalityCount: scope.filter((m) => m.productionMonths > 0).length,
      totalBeds: scope.reduce((sum, m) => sum + (m.beds || 0), 0),
      totalArea: scope.reduce((sum, m) => sum + (m.area || 0), 0),
    };
  }, [data, selectedMuni]);

  if (loading) {
    return (
      <div className="skeleton-dashboard">
        <SkeletonBlock width="45%" height={24} />
        <SkeletonBlock width="70%" height={13} />
        <div className="mt-4"><SkeletonCards count={4} /></div>
        <div className="row g-3 mt-1">
          <div className="col-lg-8"><div className="skeleton-card"><SkeletonChart height={300} /></div></div>
          <div className="col-lg-4"><div className="skeleton-card"><SkeletonChart height={240} /></div></div>
        </div>
      </div>
    );
  }
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!view) return null;

  const topProducer = view.registeredRows[0];

  return (
    <div className="muni-page">
      <PageHeader
        id="admin-municipality"
        variant="section"
        title="Municipality Analytics"
<<<<<<< HEAD
        subtitle={`Municipality production data and operational producer details for ${view.scopeLabel}.`}
=======
        subtitle={`Production and salt farmer breakdown for ${view.scopeLabel}.`}
>>>>>>> 2d552db87db1db72a07070ef1210a4dd5c7abbf7
      />

      <div className="muni-scope-bar">
        <span className="muni-scope-chip">Scope: {view.scopeLabel}</span>
        <span className="muni-scope-note">
          <Info size={12} strokeWidth={2} aria-hidden="true" />
<<<<<<< HEAD
          Production volume uses estimates from Adjusted_Estimates.xlsx. Producers come from the master list; beds, area,
          methods, and environment details remain from approved operational reports.
=======
          Production, beds and area come from approved production records (all time). Salt farmers come from the
          master list.
>>>>>>> 2d552db87db1db72a07070ef1210a4dd5c7abbf7
        </span>
      </div>

      <KpiGrid columns={4} className="muni-kpi-strip">
        <KpiCard
          icon={Users}
          title="Registered Salt Farmers"
          value={view.registeredTotal}
          supporting={topProducer
            ? `${topProducer.name} has the most (${fmtInt(topProducer.count)})`
            : 'From the master list'}
          info="Distinct salt farmers registered in the master list. Production reports also log salt farmer-months, which count the same people again each month."
        />
        <KpiCard
          icon={Building2}
          title="Municipalities"
          value={view.productionMunicipalityCount}
          supporting="with municipality production data"
          info="Municipalities in scope with at least one month in the municipality production dataset."
        />
        <KpiCard
          icon={Layers}
          title="Salt Beds"
          value={view.totalBeds}
          supporting="from approved production records"
          info="Sum of the salt beds reported on approved operational production records; these are separate from the municipality production dataset."
        />
        <KpiCard
          icon={MapPin}
          title="Total Area"
          value={view.totalArea}
          unit="m²"
          supporting={`across ${fmtInt(view.totalBeds)} salt beds`}
          info="Sum of salt beds x area per bed, from approved operational production records."
        />
      </KpiGrid>

      <Row className="g-3 mb-3">
        <Col lg={7} md={12}>
          <MuniRegisteredChart rows={view.registeredRows} total={view.registeredTotal} />
        </Col>
        <Col lg={5} md={12}>
          <MuniMethodChart rows={view.method.rows} total={view.method.total} />
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={7} md={12}>
          <MuniProfileChart profile={view.profile} />
        </Col>
        <Col lg={5} md={12}>
          <MuniEnvironmentPanel environment={view.environment} />
        </Col>
      </Row>

      <MuniDetailsTable rows={view.tableRows} scopeLabel={view.scopeLabel} />

      <p className="muni-footnote">
        {view.tableRows.length > 0
          ? `${view.scopeLabel}: ${fmtInt(view.tableRows.reduce((s, r) => s + r.records, 0))} approved production records in scope.`
          : 'No approved production records in this scope.'}
      </p>
    </div>
  );
}
