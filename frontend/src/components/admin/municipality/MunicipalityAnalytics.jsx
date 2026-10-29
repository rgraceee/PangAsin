// WHAT: The Municipality Analytics section of the Admin Dashboard.
// WHY: one page that says what the approved records and the producer master
//      list actually contain - every panel states its scope and its source, and
//      the scope follows the municipality selector above it.
import { useEffect, useMemo, useState } from 'react';
import { Alert, Col, Row } from 'react-bootstrap';
import { Users, ContactRound, Boxes, Building2 } from 'lucide-react';
import { getAdminStats } from '../../../services/dataService';
import KpiCard from '../../ui/KpiCard';
import KpiGrid from '../../ui/KpiGrid';
import PageHeader from '../PageHeader';
import { useDashboardFilters } from '../DashboardFilters';
import { SkeletonBlock, SkeletonCards, SkeletonChart } from '../../Skeleton';
import MuniRegisteredChart from './MuniRegisteredChart';
import MuniMethodChart from './MuniMethodChart';
import MuniProfileChart from './MuniProfileChart';
import MuniProductionChart from './MuniProductionChart';
import MuniMonthlyTrendChart from './MuniMonthlyTrendChart';

import MuniDetailsTable from './MuniDetailsTable';
import {
  scopeRows, normaliseProduction, normaliseMasterList, normaliseMethods, fmtInt, fmtMT,
} from './muniData';
import {
  buildRegisteredRows, buildMethodRows, buildProfile, buildTableRows,
} from './muniSelectors';

export default function MunicipalityAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const {
    selectedMuni, selectedMunicipalitySlug, selMonth, selYear, mode, rangeStart, rangeEnd,
  } = useDashboardFilters();

  useEffect(() => {
    let active = true;
    setError(null);
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
      .then((stats) => {
        if (!active) return;
        setData(stats);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { active = false; };
  }, [selectedMunicipalitySlug, mode, rangeStart, rangeEnd, selYear, selMonth]);

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
      tableRows: buildTableRows(scope, masterList),
      totalProduction: scope.reduce((sum, m) => sum + (m.volumeMT || 0), 0),
    };
  }, [data, selectedMuni]);

  const selectedMuniId = useMemo(() => {
    if (!selectedMuni || !data) return null;
    const row = (data.by_municipality || []).find((m) => m.municipality_name === selectedMuni);
    return row ? row.municipality_id : null;
  }, [selectedMuni, data]);

  if (loading) {
    return (
      <div className="skeleton-dashboard">
        <SkeletonBlock width="45%" height={24} />
        <SkeletonBlock width="70%" height={13} />
        <div className="mt-4"><SkeletonCards count={3} /></div>
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
  const gender = view.profile.sex.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  return (
    <div className="muni-page">
      <PageHeader
        id="admin-municipality"
        variant="section"
        icon={Building2}
        title="Municipality Analytics"
        subtitle={`Municipality production data and salt farmer details for ${view.scopeLabel}.`}
      />

      <KpiGrid columns={3} className="muni-kpi-strip">
        <KpiCard
          icon={Boxes}
          title="Total Production"
          value={fmtMT(view.totalProduction)}
          unit="Metric Tons (MT)"
          supporting="for the selected period"
          info="Production volume from Adjusted_Estimates.xlsx for the selected municipality and period."
        />
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
          icon={ContactRound}
          title="Gender Distribution"
          value={`${fmtInt(gender.male || 0)} / ${fmtInt(gender.female || 0)}`}
          unit="Male / Female"
          supporting={gender.other > 0 ? `Other: ${fmtInt(gender.other)}` : undefined}
          info="Registered salt farmers by sex — male / female."
        />
      </KpiGrid>

      <Row className="g-3 mb-3">
        <Col lg={12} md={12}>
          <MuniMonthlyTrendChart selectedMuni={selectedMuni} municipalityId={selectedMuniId} />
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={7} md={12}>
          <MuniProductionChart rows={view.scope} />
        </Col>
        <Col lg={5} md={12}>
          <MuniMethodChart rows={view.method.rows} total={view.method.total} />
        </Col>
      </Row>

      <MuniDetailsTable rows={view.tableRows} scopeLabel={view.scopeLabel} />

      <Row className="g-3 mb-3">
        <Col lg={12} md={12}>
          <MuniProfileChart profile={view.profile} registeredRows={view.registeredRows} registeredTotal={view.registeredTotal} />
        </Col>
      </Row>

      <p className="muni-footnote">
        {view.tableRows.length > 0
          ? `${view.scopeLabel}: ${fmtInt(view.tableRows.reduce((s, r) => s + r.records, 0))} approved production records in scope.`
          : 'No approved production records in this scope.'}
      </p>
    </div>
  );
}
