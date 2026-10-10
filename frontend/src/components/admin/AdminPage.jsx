import React from 'react';
import AdminDashboard from './AdminDashboard';
import MunicipalityAnalytics from './MunicipalityAnalytics';
import SupplyDemandAnalytics from './SupplyDemandAnalytics';

export default function AdminPage({ user }) {
  return (
    <div className="admin-single-page admin-dashboard-shell">
      <AdminDashboard user={user} />
      <MunicipalityAnalytics />
      <SupplyDemandAnalytics />
    </div>
  );
}
