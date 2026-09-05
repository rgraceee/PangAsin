import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, HashRouter, useLocation } from 'react-router-dom';
import GuestDashboard from './components/GuestDashboard';
import Login from './components/Login';
import EncoderLayout from './components/encoder/EncoderLayout';
import EncoderDashboard from './components/encoder/EncoderDashboard';
import RequireAdmin from './components/admin/RequireAdmin';
import AdminLayout from './components/admin/AdminLayout';
import AdminPage from './components/admin/AdminPage';
import UsersManagement from './components/admin/UsersManagement';
import ForecastDashboard from './components/admin/ForecastDashboard';
import GenerateReports from './components/admin/GenerateReports';
import ValidationQueue from './components/admin/ValidationQueue';
import DataQualityDashboard from './components/admin/DataQualityDashboard';
import { getMe } from './services/dataService';
import usePageTitle from './hooks/usePageTitle';

const ROUTE_TITLES = {
  '/': 'Public Dashboard',
  '/login': 'Sign In',
  '/encoder': 'Encoder Dashboard',
  '/admin': 'Executive Dashboard',
  '/admin/users': 'User Management',
  '/admin/validation': 'Validation Queue',
  '/admin/data-quality': 'Data Quality',
  '/admin/forecast': 'Forecasting',
  '/admin/reports': 'Generate Reports',
};

function TitleSetter() {
  const location = useLocation();
  usePageTitle(ROUTE_TITLES[location.pathname] || '');
  return null;
}

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
      <TitleSetter />
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
        </Route>
        <Route
          path="/admin"
          element={
            <RequireAdmin user={user} isLoading={loading} setUser={setUser}>
              <AdminLayout user={user} setUser={setUser} />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminPage user={user} />} />
          <Route path="users" element={<UsersManagement />} />
          <Route path="validation" element={<ValidationQueue />} />
          <Route path="data-quality" element={<DataQualityDashboard />} />
          <Route path="forecast" element={<ForecastDashboard />} />
          <Route path="reports" element={<GenerateReports />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
