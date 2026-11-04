import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastProvider } from '../components/Toast';
import RequireSuperAdmin from '../components/admin/RequireSuperAdmin';
import RequireAdmin from '../components/admin/RequireAdmin';
import ErrorBoundary from '../components/ErrorBoundary';
import SuperAdminOverview from '../components/admin/SuperAdminOverview';
import SuperAdminUsers from '../components/admin/SuperAdminUsers';
import SuperAdminRecords from '../components/admin/SuperAdminRecords';
import SuperAdminAuditLog from '../components/admin/SuperAdminAuditLog';
import SuperAdminPolicies from '../components/admin/SuperAdminPolicies';
import SuperAdminConfig from '../components/admin/SuperAdminConfig';
import SuperAdminExport from '../components/admin/SuperAdminExport';
import SuperAdminAnnouncement from '../components/admin/SuperAdminAnnouncement';
import SuperAdminAbout from '../components/admin/SuperAdminAbout';
import SuperAdminHelp from '../components/admin/SuperAdminHelp';
import AdminDashboard from '../components/admin/AdminDashboard';
import UsersManagement from '../components/admin/UsersManagement';
import Municipalities from '../components/admin/Municipalities';
import DataQualityDashboard from '../components/admin/DataQualityDashboard';
import GenerateReports from '../components/admin/GenerateReports';
import ProducerMasterList from '../components/ProducerMasterList';
import ValidationQueue from '../components/admin/ValidationQueue';
import ForecastDashboard from '../components/admin/ForecastDashboard';
import TargetEvaluation from '../components/admin/target/TargetEvaluation';
import Settings from '../components/Settings';
import {
  getSuperAdminHealth,
  getSuperAdminSmtp,
  getSuperAdminUsers,
  getAuditLog,
  getAdminStats,
  getAdminUsers,
  resetSuperAdminPassword,
  getAdminMunicipalities,
  getAdminRecords,
  getAdminRecord,
  getDataQuality,
  createReport,
  getReports,
  getReportDownloadUrl,
  deleteReport,
  getAdminMonths,
  getForecastRuns,
  evaluateTarget,
  getAdminSupplyDemand,
  getPublicMunicipalities,
  getAdminDescriptive,
} from '../services/dataService';

vi.mock('leaflet', () => {
  const Map = function () { this._layers = []; };
  Map.prototype.setView = function () { return this; };
  Map.prototype.addLayer = function () { return this; };
  Map.prototype.removeLayer = function () { return this; };
  Map.prototype.invalidateSize = function () { return this; };
  Map.prototype.on = function () { return this; };
  Map.prototype.off = function () { return this; };
  Map.prototype.addTo = function () { return this; };
  return {
    __esModule: true,
    default: {
      map: () => new Map(),
      tileLayer: () => ({ addTo: () => {} }),
      marker: () => ({ addTo: () => {}, setLatLng: () => {}, bindPopup: () => {} }),
      circle: () => ({ addTo: () => {}, setLatLng: () => {}, setRadius: () => {} }),
      polygon: () => ({ addTo: () => {}, setLatLngs: () => {}, bindPopup: () => {} }),
      geoJSON: () => ({
        addTo: () => {},
        clearLayers: () => {},
        getBounds: () => ({ getSouthWest: () => ({ lat: () => 0, lng: () => 0 }), getNorthEast: () => ({ lat: () => 0, lng: () => 0 }) }),
        eachLayer: (cb) => {},
      }),
      divIcon: () => ({ options: { html: '' } }),
      latLng: () => ({ lat: 0, lng: 0, distanceTo: () => 0 }),
      layerGroup: () => ({ addTo: () => {}, clearLayers: () => {}, addLayer: () => {} }),
      DomEvent: { on: () => {}, off: () => {}, disableClickPropagation: () => {} },
      DomUtil: {
        get: () => null, getStyle: () => '', create: () => document.createElement('div'),
        setPosition: () => {}, getPosition: () => ({ x: 0, y: 0 }),
        getViewportOffset: () => ({ x: 0, y: 0 }),
      },
      Browser: { ie: false, ielt9: false, webkit: false },
      version: '1.9.4',
    },
    Map,
    tileLayer: () => ({ addTo: () => {} }),
    marker: () => ({ addTo: () => {} }),
    circle: () => ({ addTo: () => {} }),
    polygon: () => ({ addTo: () => {} }),
    geoJSON: () => ({
      addTo: () => {},
      clearLayers: () => {},
      getBounds: () => ({ getSouthWest: () => ({ lat: () => 0, lng: () => 0 }), getNorthEast: () => ({ lat: () => 0, lng: () => 0 }) }),
      eachLayer: (cb) => {},
    }),
    divIcon: () => ({}),
    latLng: () => ({}),
    layerGroup: () => ({}),
    DomEvent: { on: () => {}, off: () => {}, disableClickPropagation: () => {} },
    DomUtil: { get: () => null, create: () => document.createElement('div') },
    Browser: {},
  };
});

const ADMIN_USER = { role: 'admin', email: 'admin@example.com', name: 'Admin User' };
const SA_USER = { role: 'superadmin', email: 'sa@example.com', name: 'Super Admin' };

const SuperAdminGuard = ({ children }) => (
  <RequireSuperAdmin user={SA_USER} isLoading={false} setUser={vi.fn()}>{children}</RequireSuperAdmin>
);
const AdminGuard = ({ children }) => (
  <ErrorBoundary>
    <RequireAdmin user={ADMIN_USER} isLoading={false} setUser={vi.fn()}>{children}</RequireAdmin>
  </ErrorBoundary>
);

function renderRoute(path, element, GuardComp = SuperAdminGuard) {
  const { container } = render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="*" element={<GuardComp>{element}</GuardComp>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
  return container;
}

const SUPERADMIN_ROUTES = [
  ['/superadmin', <SuperAdminOverview />, /Overview/i],
  ['/superadmin/users', <SuperAdminUsers />, /User Management/i],
  ['/superadmin/records', <SuperAdminRecords />, /Records/i],
  ['/superadmin/audit-log', <SuperAdminAuditLog />, /Audit Log/i],
  ['/superadmin/policies', <SuperAdminPolicies />, /Policies/i],
  ['/superadmin/config', <SuperAdminConfig />, /Configuration/i],
  ['/superadmin/export', <SuperAdminExport />, /Export & Backup/i],
  ['/superadmin/announcement', <SuperAdminAnnouncement />, /Announcement/i],
  ['/superadmin/about', <SuperAdminAbout />, /About PangAsin/i],
  ['/superadmin/help', <SuperAdminHelp />, /Help Center/i],
];

const ADMIN_ROUTES = [
  ['/admin', <AdminDashboard />, /Dashboard/i],
  ['/admin/users', <UsersManagement />, /User Management/i],
  ['/admin/municipalities', <Municipalities />, /Municipalities/i],
  ['/admin/master-list', <ProducerMasterList user={ADMIN_USER} isAdmin />, /Master List/i],
  ['/admin/validation', <ValidationQueue />, /Validation Queue/i],
  ['/admin/data-quality', <DataQualityDashboard />, /Data Quality/i],
  ['/admin/forecast', <ForecastDashboard />, /Forecast/i],
  ['/admin/forecast/target', <TargetEvaluation />, /Target Evaluation/i],
  ['/admin/reports', <GenerateReports />, /Generate Reports/i],
  ['/admin/settings/account', <Settings user={ADMIN_USER} />, /Account/i],
];

vi.mock('../services/dataService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSuperAdminHealth: vi.fn(() => Promise.resolve({
      pending_validations: 0, failed_logins_24h: 0, users_by_role: { encoder: 2 },
      last_forecast_run: null, last_approved_update: null, db_size: '0.00 MB',
      db_type: 'SQLite', app_version: '1.0.0',
    })),
    getSuperAdminSmtp: vi.fn(() => Promise.resolve({ smtp_configured: true })),
    getSuperAdminUsers: vi.fn(() => Promise.resolve({ users: [], total: 0 })),
    getAuditLog: vi.fn(() => Promise.resolve({ entries: [], total: 0 })),
    getLoginEvents: vi.fn(() => Promise.resolve({ entries: [], total: 0 })),
    getAdminMunicipalities: vi.fn(() => Promise.resolve({ municipalities: [] })),
    getAdminRecords: vi.fn(() => Promise.resolve({ records: [], total: 0 })),
    getAdminRecord: vi.fn(() => Promise.resolve({})),
    getSuperAdminContent: vi.fn(() => Promise.resolve({})),
    getSuperAdminSettings: vi.fn(() => Promise.resolve({})),
    getPublicContent: vi.fn(() => Promise.resolve({})),
    getHelpFaqs: vi.fn(() => Promise.resolve({ faqs: [] })),
    getSuperAdminAnnouncement: vi.fn(() => Promise.resolve({ announcement: null })),
    createSuperAdminUser: vi.fn(() => Promise.resolve({ user: {} })),
    deactivateUser: vi.fn(() => Promise.resolve({})),
    reactivateUser: vi.fn(() => Promise.resolve({})),
    resetSuperAdminPassword: vi.fn(() => Promise.resolve({})),
    forceLogoutUser: vi.fn(() => Promise.resolve({})),
    unlockUser: vi.fn(() => Promise.resolve({})),
    changeUserMunicipality: vi.fn(() => Promise.resolve({})),
    exportRecords: vi.fn(() => Promise.resolve(new Blob())),
    downloadBlob: vi.fn(() => Promise.resolve(new Blob())),
    downloadBackup: vi.fn(() => Promise.resolve(new Blob())),
    exportCsv: vi.fn(() => Promise.resolve(new Blob())),
    softDeleteRecord: vi.fn(() => Promise.resolve({})),
    restoreRecord: vi.fn(() => Promise.resolve({})),
    editRecord: vi.fn(() => Promise.resolve({})),
    permanentDeleteRecord: vi.fn(() => Promise.resolve({})),
    putSuperAdminContent: vi.fn(() => Promise.resolve({})),
    resetSuperAdminContent: vi.fn(() => Promise.resolve({})),
    putSuperAdminSetting: vi.fn(() => Promise.resolve({})),
    createHelpFaq: vi.fn(() => Promise.resolve({ id: 1 })),
    updateHelpFaq: vi.fn(() => Promise.resolve({})),
    deleteHelpFaq: vi.fn(() => Promise.resolve({})),
    reorderHelpFaqs: vi.fn(() => Promise.resolve({})),
    putSuperAdminAnnouncement: vi.fn(() => Promise.resolve({})),
    runSuperAdminForecast: vi.fn(() => Promise.resolve({ run_id: 1 })),
    sendSmtpTest: vi.fn(() => Promise.resolve({})),
    // Admin mocks
    getAdminStats: vi.fn(() => Promise.resolve({ pending_validation_count: 0 })),
    getAdminSupplyDemand: vi.fn(() => Promise.resolve(null)),
    getAdminUsers: vi.fn(() => Promise.resolve({ users: [], total: 0 })),
    resetSuperAdminPassword: vi.fn(() => Promise.resolve({})),
    getPublicMunicipalities: vi.fn(() => Promise.resolve({ municipalities: [] })),
    getAdminDescriptive: vi.fn(() => Promise.resolve({})),
    getDataQuality: vi.fn(() => Promise.resolve({
      kpis: { pending_total: 0, review_clearable_count: 0, oldest_pending_days: 0 },
      thresholds: {},
      fields: [],
      municipalities: [],
    })),
    createReport: vi.fn(() => Promise.resolve({ id: 1 })),
    getReports: vi.fn(() => Promise.resolve({ reports: [] })),
    getReportDownloadUrl: vi.fn(() => Promise.resolve('')),
    deleteReport: vi.fn(() => Promise.resolve({})),
    getAdminMonths: vi.fn(() => Promise.resolve([])),
    getForecastRuns: vi.fn(() => Promise.resolve({ runs: [] })),
    evaluateTarget: vi.fn(() => Promise.resolve({})),
  };
});

beforeEach(() => {
  getSuperAdminHealth.mockReset().mockImplementation(() => Promise.resolve({
    pending_validations: 0, failed_logins_24h: 0, users_by_role: { encoder: 2 },
    last_forecast_run: null, last_approved_update: null, db_size: '0.00 MB',
    db_type: 'SQLite', app_version: '1.0.0',
  }));
  getAdminStats.mockReset().mockImplementation(() => Promise.resolve({ pending_validation_count: 0 }));
  getAdminUsers.mockReset().mockImplementation(() => Promise.resolve({ users: [], total: 0 }));
  resetSuperAdminPassword.mockReset().mockImplementation(() => Promise.resolve({}));
  getAdminMunicipalities.mockReset().mockImplementation(() => Promise.resolve({ municipalities: [] }));
  getAdminRecords.mockReset().mockImplementation(() => Promise.resolve({ records: [], total: 0 }));
  getAdminRecord.mockReset().mockImplementation(() => Promise.resolve({}));
  getAdminSupplyDemand.mockReset().mockImplementation(() => Promise.resolve(null));
  getPublicMunicipalities.mockReset().mockImplementation(() => Promise.resolve({ municipalities: [] }));
  getAdminDescriptive.mockReset().mockImplementation(() => Promise.resolve({}));
  getDataQuality.mockReset().mockImplementation(() => Promise.resolve({
    kpis: { pending_total: 0, review_clearable_count: 0, oldest_pending_days: 0 },
    thresholds: {},
    fields: [],
    municipalities: [],
  }));
  createReport.mockReset().mockImplementation(() => Promise.resolve({ id: 1 }));
  getReports.mockReset().mockImplementation(() => Promise.resolve({ reports: [] }));
  getReportDownloadUrl.mockReset().mockImplementation(() => Promise.resolve(''));
  deleteReport.mockReset().mockImplementation(() => Promise.resolve({}));
  getAdminMonths.mockReset().mockImplementation(() => Promise.resolve([]));
  getForecastRuns.mockReset().mockImplementation(() => Promise.resolve({ runs: [] }));
  evaluateTarget.mockReset().mockImplementation(() => Promise.resolve({}));
});

describe('SuperAdmin routes render without crashing or going blank', () => {
  for (const [path, element, marker] of SUPERADMIN_ROUTES) {
    it(`${path} renders non-empty content with no ErrorBoundary`, async () => {
      let container;
      expect(() => {
        container = renderRoute(path, element);
      }).not.toThrow();

      await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(30), { timeout: 15000 });
      expect(container.textContent.trim().length).toBeGreaterThan(30);
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  }
});

describe('Admin routes render without crashing or going blank', () => {
  for (const [path, element, marker] of ADMIN_ROUTES) {
    it(`${path} renders non-empty content with no ErrorBoundary`, async () => {
      let container;
      expect(() => {
        container = renderRoute(path, element, AdminGuard);
      }).not.toThrow();

      await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(30), { timeout: 15000 });
      expect(container.textContent.trim().length).toBeGreaterThan(30);
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  }

  it('User Management shows table and reset password form', async () => {
    let container = renderRoute('/admin/users', <UsersManagement />, AdminGuard);
    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(30), { timeout: 15000 });
    expect(container.textContent.trim().length).toBeGreaterThan(30);
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('Dashboard shows KPI cards', async () => {
    let container = renderRoute('/admin', <AdminDashboard />, AdminGuard);
    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(30), { timeout: 15000 });
    expect(container.textContent.trim().length).toBeGreaterThan(30);
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('Data Quality shows dashboard', async () => {
    let container = renderRoute('/admin/data-quality', <DataQualityDashboard />, AdminGuard);
    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(30), { timeout: 15000 });
    expect(container.textContent.trim().length).toBeGreaterThan(30);
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('opens a pending Bolinao report and renders its review actions', async () => {
    getAdminRecords.mockResolvedValue({
      records: [{
        id: 101,
        municipality_name: 'Bolinao',
        barangay: 'Goyoden',
        record_date: '2026-10-01',
        production_volume_mt: 125,
        status: 'pending',
      }],
      total: 1,
      pages: 1,
    });
    getAdminRecord.mockResolvedValue({
      id: 101,
      municipality_name: 'Bolinao',
      barangay: 'Goyoden',
      record_date: '2026-10-01',
      production_method: 'solar',
      production_volume_mt: 125,
      status: 'pending',
    });

    renderRoute('/admin/validation', <ValidationQueue />, AdminGuard);

    fireEvent.click(await screen.findByRole('button', { name: 'Review record 101' }));

    expect(await screen.findByText('Production Method')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
