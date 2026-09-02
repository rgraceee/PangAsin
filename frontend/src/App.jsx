import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, HashRouter } from 'react-router-dom';
import GuestDashboard from './components/GuestDashboard';
import Login from './components/Login';
import EncoderLayout from './components/encoder/EncoderLayout';
import EncoderDashboard from './components/encoder/EncoderDashboard';
import RecordList from './components/encoder/RecordList';
import ProductionRecordForm from './components/encoder/ProductionRecordForm';
import RequireAdmin from './components/admin/RequireAdmin';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import UsersManagement from './components/admin/UsersManagement';
import ValidationQueue from './components/admin/ValidationQueue';
import DataQualityDashboard from './components/admin/DataQualityDashboard';
import ForecastDashboard from './components/admin/ForecastDashboard';
import ForecastInsights from './components/admin/ForecastInsights';
import ComingSoon from './components/admin/ComingSoon';
import { getMe } from './services/dataService';

function RequireAuth({ user, isLoading, children }) {
  if (isLoading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GuestDashboard />} />
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="/encoder/login" element={<Navigate to="/login" replace />} />
        <Route
          path="/encoder"
          element={
            <RequireAuth user={user} isLoading={loading}>
              <EncoderLayout user={user} />
            </RequireAuth>
          }
        >
          <Route index element={<EncoderDashboard />} />
          <Route path="records" element={<RecordList />} />
          <Route path="records/new" element={<ProductionRecordForm />} />
          <Route path="records/:id/edit" element={<ProductionRecordForm />} />
        </Route>
        <Route
          path="/admin"
          element={
            <RequireAdmin user={user} isLoading={loading} setUser={setUser}>
              <AdminLayout user={user} setUser={setUser} />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="validation" element={<ValidationQueue />} />
          <Route path="users" element={<UsersManagement />} />
          <Route path="data-quality" element={<DataQualityDashboard />} />
          <Route
            path="municipalities"
            element={<ComingSoon title="Municipality Analytics" description="Deep-dive analytics per municipality." />}
          />
          <Route
            path="trends"
            element={<ComingSoon title="Trends & Analysis" description="Province-wide trends over time." />}
          />
          <Route
            path="comparison"
            element={<ComingSoon title="Municipality Comparison" description="Compare municipalities side by side." />}
          />
          <Route
            path="supply-demand"
            element={<ComingSoon title="Supply & Demand Analytics" description="Track domestic supply vs. demand." />}
          />
          <Route
            path="forecast"
            element={<ForecastDashboard />}
          />
          <Route
            path="forecast/insights"
            element={<ForecastInsights />}
          />
          <Route
            path="reports"
            element={<ComingSoon title="Reports & Export" description="Generate and export reports." />}
          />
          <Route
            path="reports/preview"
            element={<ComingSoon title="Report Preview" description="Preview a generated report before export." />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}