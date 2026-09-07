import React, { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import PageHeader from './admin/PageHeader';
import Reveal from './Reveal';
import MunicipalityMapSection from './MunicipalityMapSection';
import SupplyDemandSection from './SupplyDemandSection';
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
        eyebrow="ASIN Center · Pangasinan State University"
        title="Pangasinan Salt Industry Dashboard"
      />

      <div className="public-about-card">
        <div className="public-about-eyebrow">About the ASIN Center</div>
        <h2 className="public-about-title">Accelerating the Philippine Salt Industry</h2>
        <p className="public-about-body">
          The Accelerating Salt Research and Innovation (ASIN) Center at Pangasinan State University supports the Philippine salt industry through research, innovation, and data-driven planning under RA 11985. This dashboard presents approved and aggregated salt production information from the salt-producing municipalities of Pangasinan.
        </p>
      </div>

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
            <SupplyDemandSection />
          </Reveal>

          <MunicipalityDetailPanel
            municipality={selectedMunicipality}
            onClose={() => setSelectedMunicipality(null)}
            demographics={data.demographics}
          />

          <Reveal>
            <MunicipalityMapSection onSelectMunicipality={setSelectedMunicipality} />
          </Reveal>
        </>
      )}
    </div>
  );
}