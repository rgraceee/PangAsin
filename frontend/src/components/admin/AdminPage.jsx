import React from 'react';
import AdminDashboard from './AdminDashboard';
import UsersManagement from './UsersManagement';
import ValidationQueue from './ValidationQueue';
import DataQualityDashboard from './DataQualityDashboard';
import MunicipalityAnalytics from './MunicipalityAnalytics';
import TrendsComparison from './TrendsComparison';
import SupplyDemandAnalytics from './SupplyDemandAnalytics';
import ForecastDashboard from './ForecastDashboard';
import GenerateReports from './GenerateReports';

function SectionDivider({ number, title }) {
  return (
    <div className="admin-section-divider">
      <div className="admin-section-number">{number}</div>
      <h3>{title}</h3>
    </div>
  );
}

export default function AdminPage({ user }) {
  return (
    <div className="admin-single-page">
      <SectionDivider number={1} title="Executive Dashboard" />
      <AdminDashboard user={user} />

      <SectionDivider number={2} title="User Management" />
      <UsersManagement />

      <SectionDivider number={3} title="Validation Queue" />
      <ValidationQueue />

      <SectionDivider number={4} title="Data Quality" />
      <DataQualityDashboard />

      <SectionDivider number={5} title="Municipality Analytics" />
      <MunicipalityAnalytics />

      <SectionDivider number={6} title="Trends & Comparison" />
      <TrendsComparison />

      <SectionDivider number={7} title="Supply & Demand Analytics" />
      <SupplyDemandAnalytics />

      <SectionDivider number={8} title="Forecasting" />
      <ForecastDashboard />

      <SectionDivider number={9} title="Generate Reports" />
      <GenerateReports />
    </div>
  );
}
