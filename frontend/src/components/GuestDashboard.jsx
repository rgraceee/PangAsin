import React, { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import PageHeader from './admin/PageHeader';
import Reveal from './Reveal';
import MunicipalityMapSection from './MunicipalityMapSection';
import MunicipalityProductionSection from './MunicipalityProductionSection';
import SupplyDemandSection from './SupplyDemandSection';
import ProducerDemographicsSection from './ProducerDemographicsSection';
import MunicipalityDetailPanel from './MunicipalityDetailPanel';
import { loadAllMockData } from '../services/dataService';

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

  return (
    <div className="public-dashboard admin-content">
      <PageHeader
        id="public-overview"
        variant="main"
        title="Pangasinan Salt Industry Dashboard"
        subtitle="The Accelerating Salt Research and Innovation (ASIN) Center at Pangasinan State University supports the Philippine salt industry through research, innovation, and data-driven planning under RA 11985. This dashboard presents approved and aggregated salt production information from the salt-producing municipalities of Pangasinan."
      />

      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      {data && (
        <>
          <Reveal>
            <MunicipalityMapSection onSelectMunicipality={setSelectedMunicipality} />
          </Reveal>

          <Reveal>
            <MunicipalityProductionSection />
          </Reveal>

          <Reveal>
            <SupplyDemandSection />
          </Reveal>

          <Reveal>
            <ProducerDemographicsSection />
          </Reveal>

          <MunicipalityDetailPanel
            municipality={selectedMunicipality}
            onClose={() => setSelectedMunicipality(null)}
            demographics={data.demographics}
          />
        </>
      )}
    </div>
  );
}