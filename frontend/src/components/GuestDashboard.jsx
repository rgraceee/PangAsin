import React, { useEffect, useState } from 'react';
import PublicHeader from './PublicHeader';
import DashboardIntro from './DashboardIntro';
import DataStatusBadge from './DataStatusBadge';
import KPISection from './KPISection';
import MunicipalityMapSection from './MunicipalityMapSection';
import MunicipalityProductionSection from './MunicipalityProductionSection';
import SupplyDemandSection from './SupplyDemandSection';
import ProducerDemographicsSection from './ProducerDemographicsSection';
import PublicFooter from './PublicFooter';
import { loadAllMockData } from '../services/dataService';
import MunicipalityDetailPanel from './MunicipalityDetailPanel';

export default function GuestDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);

  useEffect(() => {
    loadAllMockData()
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

  if (loading) {
    return (
      <div className="public-dashboard">
        <PublicHeader />
        <DashboardIntro />
        <DataStatusBadge />
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-dashboard">
        <PublicHeader />
        <DashboardIntro />
        <DataStatusBadge />
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="public-dashboard">
      <PublicHeader />
      <DashboardIntro />
      <DataStatusBadge />

      <KPISection data={data} />

      <MunicipalityMapSection
        municipalities={data.municipalities}
        onSelectMunicipality={setSelectedMunicipality}
      />

      <MunicipalityProductionSection municipalities={data.municipalities} />

      <SupplyDemandSection supplyDemand={data.supplyDemand} />

      <ProducerDemographicsSection demographics={data.demographics} />

      <MunicipalityDetailPanel
        municipality={selectedMunicipality}
        onClose={() => setSelectedMunicipality(null)}
        demographics={data.demographics}
      />
    </div>
  );
}
