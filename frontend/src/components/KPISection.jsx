import React from 'react';
import KPICard from './KPICard';
import { getProductionSummary } from '../services/dataService';

export default function KPISection({ data }) {
  const summary = getProductionSummary();

  return (
    <section className="kpi-section">
      <div className="row g-3">
        <div className="col-md-6 col-lg-3">
          <KPICard
            title="Salt-Producing Municipalities"
            value={summary.municipalityCount}
            supporting="Municipalities represented"
          />
        </div>
        <div className="col-md-6 col-lg-3">
          <KPICard
            title="Pangasinan Salt Production"
            value={`${summary.totalProduction.toLocaleString()} MT`}
            supporting="Recorded production"
          />
        </div>
        <div className="col-md-6 col-lg-3">
          <KPICard
            title="Total Production Area"
            value={`${summary.totalArea.toLocaleString()} m²`}
            supporting="Recorded salt production area"
          />
        </div>
        <div className="col-md-6 col-lg-3">
          <KPICard
            title="National Salt Self-Sufficiency"
            value={`${summary.sufficiency.toFixed(1)}%`}
            supporting="Domestic supply coverage"
          />
        </div>
      </div>
    </section>
  );
}
