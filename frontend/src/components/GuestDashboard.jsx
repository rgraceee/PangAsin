// WHAT: Public/guest dashboard na walang login.
// WHY: Ipinapakita ang aggregated provincial data (KPIs, supply-demand + mapa) mula sa
//      loadPublicDashboardData, para hindi kailangan ng account para makita.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { Boxes, Factory, Scale, Ship, ShieldCheck } from 'lucide-react';
import PageHeader from './admin/PageHeader';
import Reveal from './Reveal';
import MunicipalityMapSection from './MunicipalityMapSection';
import SupplyDemandSection from './SupplyDemandSection';
import MunicipalityMapArt from './encoder/MunicipalityMapArt';
import KpiGrid from './ui/KpiGrid';
import KpiCard from './ui/KpiCard';
import { loadPublicDashboardData } from '../services/dataService';
import { SkeletonCards, SkeletonChart } from './Skeleton';

// WHAT: Kalkulahin ang headline numbers para sa KPI strip.
// WHY: naka-derive lang sa parehong JSON (walang bagong data); null kapag wala pang data
//      para ipakita ng KpiCard ang "—" kaysa maling zero.
function buildKpis(data) {
  const production = data.production || {};
  const records = Array.isArray(production.records) ? production.records : [];
  const totalMT = records.length ? production.provinceTotalMT : null;

  // WHAT: National context mula sa demand benchmark.
  const national = (data.supplyDemand && data.supplyDemand.philippines) || {};
  const demand = national.demand;
  const domestic = national.domesticSupply;
  const imports = national.imports;
  const pct = (numerator, base) =>
    Number.isFinite(numerator) && Number.isFinite(base) && base > 0
      ? Math.round((numerator / base) * 1000) / 10
      : null;
  const coverage = pct(domestic, demand);
  const importDependence = pct(imports, demand);

  return { totalMT, nationalDemand: demand, coverage, importDependence };
}

export default function GuestDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPublicDashboardData()
      .then((mockData) => {
        setData(mockData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
        setError('Unable to load dashboard data. Please try refreshing the page.');
        setLoading(false);
      });
  }, []);

  const kpis = useMemo(() => (data ? buildKpis(data) : null), [data]);

  return (
    <div className="public-dashboard admin-content">
      {/* WHAT: Kaparehas na clean header ng admin/encoder (puti + map art).
         WHY: dating asul na admin-page-hero--main ang gamit ng public, kaya iba ang
              itsura; dito naka-align na sa Admin at Encoder dashboards. */}
      <PageHeader
        id="public-overview"
        variant="clean"
        className="ui-pageheader--dashboard"
        title="Pangasinan Salt Industry Dashboard"
        subtitle="Approved salt production and demand information from the salt-producing municipalities of Pangasinan."
        art={<MunicipalityMapArt mode="province" />}
      >
        <span className="ui-pageheader-chip">
          <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
          Public data &middot; approved and aggregated records only
        </span>
      </PageHeader>

      {loading && (
        <div className="skeleton-dashboard">
          <SkeletonCards count={4} />
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      {kpis && (
        <Reveal>
          <KpiGrid columns={4} className="public-kpi-grid">
            <KpiCard
              icon={Scale}
              title="National Salt Demand"
              value={kpis.nationalDemand}
              unit="MT"
              supporting="Philippines demand benchmark"
              info="Latest national salt demand benchmark compiled by the ASIN Center."
            />
            <KpiCard
              icon={Factory}
              title="National Supply Coverage"
              value={kpis.coverage}
              unit="%"
              supporting="Share of demand from local production"
              info="How much of national demand is covered by domestic supply."
            />
            <KpiCard
              icon={Ship}
              title="Import Dependence"
              value={kpis.importDependence}
              unit="%"
              supporting="Share of demand covered by imports"
              info="How much of national demand relies on imported salt."
            />
            <KpiCard
              icon={Boxes}
              title="Recorded Production"
              value={kpis.totalMT}
              unit="MT"
              supporting="Total approved production · Pangasinan"
              info="Total approved salt production recorded by Pangasinan municipalities to date."
            />
          </KpiGrid>
        </Reveal>
      )}

      <div className="public-about-card">
        <div className="public-about-eyebrow">About the ASIN Center</div>
        <h2 className="public-about-title">Accelerating the Philippine Salt Industry</h2>
        <p className="public-about-body">
          The Accelerating Salt Research and Innovation (ASIN) Center at Pangasinan State University supports the Philippine salt industry through research, innovation, and data-driven planning under RA 11985. This dashboard presents approved and aggregated salt production information from the salt-producing municipalities of Pangasinan.
        </p>
      </div>

      {loading && (
        <div className="skeleton-dashboard">
          <div className="skeleton-card">
            <SkeletonChart height={320} />
          </div>
        </div>
      )}

      {data && (
        <>
          <Reveal>
            <SupplyDemandSection />
          </Reveal>

          <Reveal>
            <MunicipalityMapSection />
          </Reveal>
        </>
      )}

      {/* WHAT: Attribution footer na navy, katulad ng brand shell.
         WHY: malinaw kung kanino ang datos at kung saan galing (governance + source). */}
      <footer className="public-footer" aria-label="About this dashboard">
        <div className="public-footer-grid">
          <div className="public-footer-block">
            <img
              src="/static/brand/Logo_with_PangAsin.png"
              alt="PangAsin"
              className="public-footer-logo"
            />
            <p className="public-footer-org">
              Accelerating Salt Research and Innovation (ASIN) Center<br />
              Pangasinan State University
            </p>
            <p className="public-footer-support">Supported by the DOST NICER Program.</p>
          </div>
          <div className="public-footer-block">
            <div className="public-footer-eyebrow">Data source</div>
            <p className="public-footer-meta">
              Figures are aggregated from approved salt production records submitted by municipal
              encoders and validated by the ASIN Center. Values are indicative and updated as
              records are approved.
            </p>
          </div>
          <div className="public-footer-block">
            <div className="public-footer-eyebrow">Reference</div>
            <p className="public-footer-meta">
              Produced under RA 11985 (Philippine Salt Industry Development Act). Municipal
              boundaries from NAMRIA / PSA administrative data.
            </p>
          </div>
        </div>
        <div className="public-footer-bottom">
          <span>&copy; 2026 PangAsin &middot; ASIN Center, Pangasinan State University</span>
        </div>
      </footer>
    </div>
  );
}
