import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, BrowserRouter, useLocation } from 'react-router-dom';
import GuestDashboard from './components/GuestDashboard';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import ConfirmEmailChange from './components/ConfirmEmailChange';
import ChangePassword from './components/ChangePassword';
import EncoderLayout from './components/encoder/EncoderLayout';
import EncoderDashboard from './components/encoder/EncoderDashboard';
import ProductionRecordsPage from './components/encoder/ProductionRecordsPage';
import EnvironmentRecordsPage from './components/encoder/EnvironmentRecordsPage';
import RequireAdmin from './components/admin/RequireAdmin';
import AdminLayout from './components/admin/AdminLayout';
import AdminPage from './components/admin/AdminPage';
import UsersManagement from './components/admin/UsersManagement';
import DemandBenchmarkSettings from './components/admin/DemandBenchmarkSettings';
import Municipalities from './components/admin/Municipalities';
import ForecastDashboard from './components/admin/ForecastDashboard';
import TargetEvaluation from './components/admin/target/TargetEvaluation';
import GenerateReports from './components/admin/GenerateReports';
import ValidationQueue from './components/admin/ValidationQueue';
import DataQualityDashboard from './components/admin/DataQualityDashboard';
import ProducerMasterList from './components/ProducerMasterList';
import PrivacyPolicy from './components/support/PrivacyPolicy';
import LegalDoc from './components/support/LegalDoc';
import Settings from './components/Settings';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import SuperAdminUsers from './components/admin/SuperAdminUsers';
import SuperAdminAuditLog from './components/admin/SuperAdminAuditLog';
import SuperAdminOverview from './components/admin/SuperAdminOverview';
import SuperAdminConfig from './components/admin/SuperAdminConfig';
import SuperAdminRecords from './components/admin/SuperAdminRecords';
import SuperAdminExport from './components/admin/SuperAdminExport';
import SuperAdminPolicies from './components/admin/SuperAdminPolicies';
import SuperAdminAnnouncement from './components/admin/SuperAdminAnnouncement';
import SuperAdminAbout from './components/admin/SuperAdminAbout';
import SuperAdminHelp from './components/admin/SuperAdminHelp';
import RequireSuperAdmin from './components/admin/RequireSuperAdmin';
import { getMe } from './services/dataService';
import { AuthLoadingScreen } from './components/Skeleton';
import { ToastProvider } from './components/Toast';
import usePageTitle from './hooks/usePageTitle';

const ROUTE_TITLES = {
  '/': 'Public Dashboard',
  '/login': 'Sign In',
  '/forgot-password': 'Forgot Password',
  '/reset-password': 'Reset Password',
  '/confirm-email-change': 'Confirm Email Address',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms & Conditions',
  '/help': 'Help Center',
  '/help/manual': 'User Manual',
  '/help/report': 'Report a Problem',
  '/encoder': 'Encoder Dashboard',
  '/admin': 'Executive Dashboard',
  '/admin/users': 'User Management',
  '/admin/demand-benchmarks': 'Demand Benchmark Settings',
  '/admin/municipalities': 'Municipality Management',
  '/change-password': 'Change Password',
  '/admin/master-list': 'Salt Farmer Master List',
  '/encoder/master-list': 'Salt Farmer Master List',
  '/encoder/production-records': 'Production Records',
  '/encoder/environment-records': 'Environment Records',
  '/encoder/reports': 'Generate Reports',
  '/admin/validation': 'Validation Queue',
  '/admin/data-quality': 'Data Completeness',
  '/admin/forecast': 'Forecasting',
  '/admin/forecast/target': 'Target Evaluation',
  '/admin/reports': 'Generate Reports',
  '/admin/settings': 'Settings',
  '/admin/settings/account': 'Account',
  '/admin/settings/security': 'Security',
  '/admin/settings/help': 'Help & Support',
  '/admin/settings/legal': 'Legal',
  '/admin/settings/legal/privacy': 'Privacy Policy',
  '/admin/settings/legal/terms': 'Terms & Conditions',
  '/admin/settings/about': 'About',
  '/superadmin/users': 'User Management',
  '/superadmin/audit-log': 'Audit Log',
  '/superadmin/records': 'Records',
  '/superadmin/export': 'Export & Backup',
  '/superadmin/health': 'Health',
  '/superadmin/config': 'Configuration',
  '/encoder/settings': 'Settings',
  '/encoder/settings/account': 'Account',
  '/encoder/settings/security': 'Security',
  '/encoder/settings/help': 'Help & Support',
  '/encoder/settings/legal': 'Legal',
  '/encoder/settings/legal/privacy': 'Privacy Policy',
  '/encoder/settings/legal/terms': 'Terms & Conditions',
  '/encoder/settings/about': 'About',
};

function TitleSetter() {
  const location = useLocation();
  usePageTitle(ROUTE_TITLES[location.pathname] || '');
  return null;
}

function RequireAuth({ user, isLoading, children }) {
  if (isLoading) {
    return <AuthLoadingScreen />;
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
    return <AuthLoadingScreen />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
      if (!user.must_change_password) {
        return <Navigate to={user.role === 'superadmin' ? '/superadmin/health' : (user.role === 'admin' ? '/admin' : '/encoder')} replace />;
      }
  return children;
}

// WHAT: Redirect mula sa lumang /settings pat sa role-specific na settings path.
// WHY: Admin papunta sa /admin/settings, encoder papunta sa /encoder/settings.
function SettingsRedirect({ user }) {
  const path = user.role === 'admin' ? '/admin/settings' : '/encoder/settings';
  useEffect(() => {
    window.location.href = path;
  }, [path]);
  return null;
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
      <ScrollToTop />
      <TitleSetter />
      <Routes>
        <Route path="/" element={<ErrorBoundary><GuestDashboard /></ErrorBoundary>} />
        <Route path="/login" element={(
          <ErrorBoundary>
            <ToastProvider>
              <Login onLogin={setUser} />
            </ToastProvider>
          </ErrorBoundary>
        )} />
        <Route path="/forgot-password" element={<ErrorBoundary><ForgotPassword /></ErrorBoundary>} />
        <Route path="/reset-password" element={<ErrorBoundary><ResetPassword /></ErrorBoundary>} />
        <Route
          path="/confirm-email-change"
          element={(
            <ErrorBoundary>
              <ConfirmEmailChange setUser={setUser} />
            </ErrorBoundary>
          )}
        />
        <Route path="/privacy" element={<ErrorBoundary><PrivacyPolicy /></ErrorBoundary>} />
        <Route path="/terms" element={<ErrorBoundary><LegalDoc docType="terms" /></ErrorBoundary>} />
        <Route
          path="/change-password"
          element={(
            <RequirePasswordChange user={user} isLoading={loading}>
              <ToastProvider>
                <ChangePassword user={user} setUser={setUser} />
              </ToastProvider>
            </RequirePasswordChange>
          )}
        />
// WHAT: Lumang /settings route — redirect sa role-specific na settings path
//       (admin to /admin/settings, encoder to /encoder/settings).
// WHY: Hindi na standalone page; nasa loob na ng admin/encoder shell.
//      Unauthenticated users pa rin dinadala sa login sa pamamagitan ng RequireAuth.
        <Route
          path="/settings"
          element={(
            <RequireAuth user={user} isLoading={loading}>
              <SettingsRedirect user={user} />
            </RequireAuth>
          )}
        />
        <Route path="/settings/*" element={(
          <RequireAuth user={user} isLoading={loading}>
            <SettingsRedirect user={user} />
          </RequireAuth>
        )} />
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
          <Route path="reports" element={
            <ErrorBoundary>
              <GenerateReports encoderMode user={user} />
            </ErrorBoundary>
          } />
          <Route path="settings/*" element={
            <RequireAuth user={user} isLoading={loading}>
              <Settings user={user} setUser={setUser} />
            </RequireAuth>
          }>
            <Route index element={<Navigate to="account" replace />} />
            <Route path="account" element={<Settings user={user} setUser={setUser} />} />
            <Route path="security" element={<Settings user={user} setUser={setUser} />} />
            <Route path="help" element={<Settings user={user} setUser={setUser} />} />
            <Route path="legal" element={<Settings user={user} setUser={setUser} />} />
            <Route path="legal/*" element={<Settings user={user} setUser={setUser} />}>
              <Route path="privacy" element={<LegalDoc docType="privacy" user={user} />} />
              <Route path="terms" element={<LegalDoc docType="terms" user={user} />} />
            </Route>
            <Route path="about" element={<Settings user={user} setUser={setUser} />} />
          </Route>
        </Route>
        <Route
          path="/admin"
          element={
            <RequireAdmin user={user} isLoading={loading} setUser={setUser}>
              <AdminLayout user={user} setUser={setUser} />
            </RequireAdmin>
          }
        >
          <Route index element={
            <ErrorBoundary>
              <AdminPage user={user} />
            </ErrorBoundary>
          } />
          <Route path="users" element={
            <ErrorBoundary>
              <UsersManagement />
            </ErrorBoundary>
          } />
          <Route path="demand-benchmarks" element={
            <ErrorBoundary>
              <DemandBenchmarkSettings />
            </ErrorBoundary>
          } />
          <Route path="municipalities" element={
            <ErrorBoundary>
              <Municipalities />
            </ErrorBoundary>
          } />
          <Route path="master-list" element={
            <ErrorBoundary>
              <ProducerMasterList user={user} isAdmin />
            </ErrorBoundary>
          } />
          <Route path="validation" element={
            <ErrorBoundary>
              <ValidationQueue />
            </ErrorBoundary>
          } />
          <Route path="data-quality" element={
            <ErrorBoundary>
              <DataQualityDashboard />
            </ErrorBoundary>
          } />
          <Route path="forecast" element={
            <ErrorBoundary>
              <ForecastDashboard />
            </ErrorBoundary>
          } />
          <Route path="forecast/target" element={
            <ErrorBoundary>
              <TargetEvaluation />
            </ErrorBoundary>
          } />
          <Route path="reports" element={
            <ErrorBoundary>
              <GenerateReports />
            </ErrorBoundary>
          } />
          <Route path="settings/*" element={
            <RequireAdmin user={user} isLoading={loading} setUser={setUser}>
              <Settings user={user} setUser={setUser} />
            </RequireAdmin>
          }>
            <Route index element={<Navigate to="account" replace />} />
            <Route path="account" element={<Settings user={user} setUser={setUser} />} />
            <Route path="security" element={<Settings user={user} setUser={setUser} />} />
            <Route path="help" element={<Settings user={user} setUser={setUser} />} />
            <Route path="legal" element={<Settings user={user} setUser={setUser} />} />
            <Route path="legal/*" element={<Settings user={user} setUser={setUser} />}>
              <Route path="privacy" element={<LegalDoc docType="privacy" user={user} />} />
              <Route path="terms" element={<LegalDoc docType="terms" user={user} />} />
            </Route>
            <Route path="about" element={<Settings user={user} setUser={setUser} />} />
          </Route>

          {/* WHAT: Old /admin/system/* and /admin/settings/system/* routes now
             live under /superadmin/*. Old /superadmin/accounts and /activity
             also redirect to the health landing. WHY: frontend-only URL change;
             bookmarked/emailed old links still work. */}
          <Route path="settings/system" element={<Navigate to="/superadmin/health" replace />} />
          <Route path="settings/system/accounts" element={<Navigate to="/superadmin/health" replace />} />
          <Route path="settings/system/activity" element={<Navigate to="/superadmin/health" replace />} />
          <Route path="settings/system/*" element={<Navigate to="/superadmin/health" replace />} />
          <Route path="settings/activity" element={<Navigate to="/superadmin/health" replace />} />
          <Route path="system" element={<Navigate to="/superadmin/health" replace />} />
          <Route path="system/accounts" element={<Navigate to="/superadmin/health" replace />} />
          <Route path="system/activity" element={<Navigate to="/superadmin/health" replace />} />
          <Route path="system/*" element={<Navigate to="/superadmin/health" replace />} />
        </Route>

        {/* WHAT: SuperAdmin pages under /superadmin/*, rendered inside the admin
           shell so the sidebar stays visible, and guarded by RequireSuperAdmin.
           WHY: Admin and encoder hitting /superadmin/* are redirected to /admin
           (and superadmin hitting admin-only routes is redirected to /superadmin/health). */}
        <Route
          path="/superadmin"
          element={
            <RequireAdmin user={user} isLoading={loading} setUser={setUser}>
              <AdminLayout user={user} setUser={setUser} />
            </RequireAdmin>
          }
        >
          <Route index element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <SuperAdminOverview />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="" element={<Navigate to="" replace />} />
          <Route path="accounts" element={<Navigate to="/superadmin/users" replace />} />
          <Route path="activity" element={<Navigate to="/superadmin" replace />} />
          <Route path="users" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <SuperAdminUsers />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="audit-log" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <SuperAdminAuditLog />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="records" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <SuperAdminRecords />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="export" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <SuperAdminExport />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="health" element={<Navigate to="/superadmin" replace />} />
          <Route path="announcement" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <SuperAdminAnnouncement />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="about" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <SuperAdminAbout />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="config" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <SuperAdminConfig />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="policies" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <SuperAdminPolicies />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="help" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <SuperAdminHelp />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="dashboard" element={<Navigate to="/superadmin" replace />} />
          <Route path="forecast" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <ForecastDashboard />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="forecast/target" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <TargetEvaluation />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="data-quality" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <DataQualityDashboard />
              </RequireSuperAdmin>
            </ErrorBoundary>
          } />
          <Route path="settings/*" element={
            <ErrorBoundary>
              <RequireSuperAdmin user={user} isLoading={loading} setUser={setUser}>
                <Settings user={user} setUser={setUser} />
              </RequireSuperAdmin>
            </ErrorBoundary>
          }>
            <Route index element={<Navigate to="account" replace />} />
            <Route path="account" element={<Settings user={user} setUser={setUser} />} />
            <Route path="security" element={<Settings user={user} setUser={setUser} />} />
            <Route path="help" element={<Settings user={user} setUser={setUser} />} />
            <Route path="legal" element={<Settings user={user} setUser={setUser} />} />
            <Route path="legal/*" element={<Settings user={user} setUser={setUser} />} />
            <Route path="about" element={<Settings user={user} setUser={setUser} />} />
          </Route>
          <Route path="*" element={<Navigate to="/superadmin" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
