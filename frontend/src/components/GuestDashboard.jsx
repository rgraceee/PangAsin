// WHAT: Public/guest dashboard na walang login.
// WHY: Ipinapakita ang aggregated provincial data (KPIs, supply-demand + mapa) mula sa
//      loadPublicDashboardData, para hindi kailangan ng account para makita.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Container } from 'react-bootstrap';
import { Boxes, Factory, Mail, MapPin, Scale, Ship, ShieldCheck } from 'lucide-react';
import PageHeader from './admin/PageHeader';
import Reveal from './Reveal';
import MunicipalityMapSection from './MunicipalityMapSection';
import SupplyDemandSection from './SupplyDemandSection';
import MunicipalityMapArt from './encoder/MunicipalityMapArt';
import PublicIntro from './public/PublicIntro';
import PublicAbout from './public/PublicAbout';
import MunicipalityProductionCharts from './public/MunicipalityProductionCharts';
import KpiGrid from './ui/KpiGrid';
import KpiCard from './ui/KpiCard';
import { loadPublicDashboardData } from '../services/dataService';
import { SkeletonCards, SkeletonChart } from './Skeleton';
import useMunicipalityDirectory from '../hooks/useMunicipalityDirectory';

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
  const { activeNames } = useMunicipalityDirectory();

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
        subtitle="Source-labeled municipality production data and salt-industry demand benchmarks for Pangasinan."
        art={<MunicipalityMapArt mode="province" activeNames={activeNames} activeLegendLabel="Salt producing municipality" />}
      >
        <span className="ui-pageheader-chip">
          <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
          Public data &middot; municipality production dataset
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

      {/* WHAT: Dalawang bagay bago ang mga numero — maikling introduksiyon at
         ang About/Mandate block.
         WHY: ang bisitante ay nangangailangan ng konteksto (ano ito, sino ang
              nag-publish, ano ang mandate) bago pa basahin ang mga KPI. */}
      {data && (
        <>
          <Reveal>
            <PublicIntro
              municipalities={data.municipalities || []}
              production={data.production || {}}
            />
          </Reveal>

          <Reveal>
            <PublicAbout />
          </Reveal>
        </>
      )}

      {kpis && (
        <Reveal>
          <KpiGrid columns={4} className="public-kpi-grid">
            <KpiCard
              icon={Scale}
              title="National Salt Demand"
              value={kpis.nationalDemand}
              unit="Metric Tons (MT)"
              supporting="Philippines demand benchmark"
              info="The total amount of salt the country needs in a year. A higher number means greater national demand."
            />
            <KpiCard
              icon={Factory}
              title="National Supply Coverage"
              value={kpis.coverage}
              unit="%"
              supporting="Share of demand from local production"
              info="The share of national salt demand met by locally produced salt. A higher percentage means less reliance on imports."
            />
            <KpiCard
              icon={Ship}
              title="Import Dependence"
              value={kpis.importDependence}
              unit="%"
              supporting="Share of demand covered by imports"
              info="The share of national salt demand covered by imported salt. A higher percentage means more reliance on foreign supply."
            />
            <KpiCard
              icon={Boxes}
              title="Municipality Production"
              value={kpis.totalMT == null ? null : Math.round(kpis.totalMT * 100) / 100}
              unit="Metric Tons (MT)"
              supporting="Workbook-derived production data · Pangasinan"
              info="Total salt production recorded across Pangasinan municipalities for the latest period. Each municipality’s figure is shown on the map and charts below."
            />
          </KpiGrid>
        </Reveal>
      )}

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

          <Reveal>
            <MunicipalityProductionCharts municipalities={data.municipalities || []} />
          </Reveal>
        </>
      )}

      <footer className="login-footer public-dashboard-footer">
        <Container>
          <div className="login-footer-grid">
            <div className="login-footer-brand">
              <div className="login-footer-brand-row" aria-hidden="true">
                <img
                  src="/static/brand/PangAsin_Logo.png"
                  alt=""
                  className="login-footer-brand-logo"
                />
                <span className="login-footer-brand-name">PangAsin</span>
              </div>
              <p className="login-footer-brand-desc">
                Salt production monitoring, forecasting, and decision support.
              </p>
              <p className="login-footer-brand-support">
                Supported by the DOST NICER Program
              </p>
            </div>

            <div className="login-footer-block">
              <div className="login-footer-eyebrow">Contact</div>
              <ul className="login-footer-details">
                <li>
                  <Mail size={18} aria-hidden="true" className="login-footer-icon" />
                  <a
                    href="mailto:pang.asin26@gmail.com"
                    className="login-footer-contact-link"
                  >
                    pang.asin26@gmail.com
                  </a>
                </li>
                <li>
                  <MapPin size={18} aria-hidden="true" className="login-footer-icon" />
                  <span>ASIN Center, PSU Binmaley, Pangasinan</span>
                </li>
                <li>
                  <MapPin size={18} aria-hidden="true" className="login-footer-icon" />
                  <a
                    href="https://asincenter.psu.edu.ph/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="login-footer-contact-link"
                  >
                    ASIN Center website
                  </a>
                </li>
              </ul>
            </div>

            <div className="login-footer-block">
              <div className="login-footer-eyebrow">Developed by</div>
              <p className="login-footer-credits">
                <span className="login-footer-dev-name">PangAsin Development Team</span>
                <br />
                BS Information Technology, Major in Data Analytics,
                Pangasinan State University
              </p>
              <p className="login-footer-meta">
                Built for the{' '}
                <a
                  href="https://asincenter.psu.edu.ph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="login-footer-contact-link"
                >
                  ASIN Center
                </a>
              </p>
            </div>
          </div>

          <div className="login-footer-bottom">
            <div className="login-footer-bottom-row">
              <span className="login-footer-copyright">
                © 2026 ASIN Center, Pangasinan State University
              </span>
              <nav className="login-footer-policy" aria-label="Legal and account links">
                <Link to="/privacy" className="login-footer-contact-link">
                  Privacy Policy
                </Link>
                {' · '}
                <Link to="/login" className="login-footer-signin">
                  Sign in
                </Link>
                {' · '}
                RA 11985
              </nav>
            </div>
          </div>
        </Container>
      </footer>
    </div>
  );
}
