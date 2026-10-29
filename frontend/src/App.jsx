import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, BrowserRouter, useLocation } from 'react-router-dom';
import GuestDashboard from './components/GuestDashboard';
import Login from './components/Login';
import ChangePassword from './components/ChangePassword';
import EncoderLayout from './components/encoder/EncoderLayout';
import EncoderDashboard from './components/encoder/EncoderDashboard';
import ProductionRecordsPage from './components/encoder/ProductionRecordsPage';
import EnvironmentRecordsPage from './components/encoder/EnvironmentRecordsPage';
import RequireAdmin from './components/admin/RequireAdmin';
import AdminLayout from './components/admin/AdminLayout';
import AdminPage from './components/admin/AdminPage';
import UsersManagement from './components/admin/UsersManagement';
import Municipalities from './components/admin/Municipalities';
import AuditLogs from './components/admin/AuditLogs';
import ForecastDashboard from './components/admin/ForecastDashboard';
// NOTE: the old Target Evaluation page (components/admin/DecisionSupport.jsx)
// is kept on disk for rollback, but the route now uses the new page.
import TargetEvaluation from './components/admin/target/TargetEvaluation';
import GenerateReports from './components/admin/GenerateReports';
import ValidationQueue from './components/admin/ValidationQueue';
import DataQualityDashboard from './components/admin/DataQualityDashboard';
import ProducerMasterList from './components/ProducerMasterList';
import { getMe } from './services/dataService';
import { SkeletonPage } from './components/Skeleton';
import usePageTitle from './hooks/usePageTitle';

const ROUTE_TITLES = {
  '/': 'Public Dashboard',
  '/login': 'Sign In',
  '/encoder': 'Encoder Dashboard',
  '/admin': 'Executive Dashboard',
  '/admin/users': 'User Management',
  '/admin/municipalities': 'Municipality Management',
  '/admin/audit-logs': 'Audit Log',
  '/change-password': 'Change Password',
  '/admin/master-list': 'Salt Farmer Master List',
  '/encoder/master-list': 'Salt Farmer Master List',
  '/encoder/production-records': 'Production Records',
  '/encoder/environment-records': 'Environment Records',
  '/admin/validation': 'Validation Queue',
  '/admin/data-quality': 'Data Quality',
  '/admin/forecast': 'Forecasting',
  '/admin/forecast/target': 'Target Evaluation',
  '/admin/reports': 'Generate Reports',
};

function TitleSetter() {
  const location = useLocation();
  usePageTitle(ROUTE_TITLES[location.pathname] || '');
  return null;
}

function RequireAuth({ user, isLoading, children }) {
  if (isLoading) {
    return <div className="auth-skeleton-wrap"><SkeletonPage /></div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

function RequirePasswordChange({ user, isLoading, children }) {
  if (isLoading) {
    return <div className="auth-skeleton-wrap"><SkeletonPage /></div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.must_change_password) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/encoder'} replace />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // WHAT: Hanggang hindi natapos ang session check, ipinapakita ang light
  //      skeleton placeholder — hindi isang buong loader. Kapag handa
  //      na ang resulta, direktong ginagamit ang route na ito.
  useEffect(() => {
    let active = true;

    getMe()
      .then((nextUser) => {
        if (active) {
          setUser(nextUser);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <BrowserRouter>
      <TitleSetter />
      <Routes>
        <Route path="/" element={<GuestDashboard />} />
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route
          path="/change-password"
          element={(
            <RequirePasswordChange user={user} isLoading={loading}>
              <ChangePassword user={user} setUser={setUser} />
            </RequirePasswordChange>
          )}
        />
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
          <Route path="production-records" element={<ProductionRecordsPage />} />
          <Route path="environment-records" element={<EnvironmentRecordsPage />} />
          <Route path="master-list" element={<ProducerMasterList />} />
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
          <Route path="municipalities" element={<Municipalities />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="master-list" element={<ProducerMasterList user={user} isAdmin />} />
          <Route path="validation" element={<ValidationQueue />} />
          <Route path="data-quality" element={<DataQualityDashboard />} />
          <Route path="forecast" element={<ForecastDashboard />} />
          <Route path="forecast/target" element={<TargetEvaluation />} />
          <Route path="reports" element={<GenerateReports />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
