import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardCheck, DatabaseCheck, Zap, FileDown, ContactRound, Users, Map,
  ScrollText, Settings, Activity, Sliders, FileText,
} from 'lucide-react';
import { getAdminStats } from '../../services/dataService';
import {
  CollapseControl, Divider, NavGroup, NavItem, SectionLabel, SidebarLogo, UserBlock,
} from '../shell/sidebarUi';

const MAIN_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
  { id: 'validation', label: 'Validation Queue', icon: ClipboardCheck, path: '/admin/validation' },
  { id: 'data-quality', label: 'Data Quality', icon: DatabaseCheck, path: '/admin/data-quality' },
];

const FORECAST_GROUP = {
  id: 'forecast',
  label: 'Analytics',
  icon: Zap,
  items: [
    { id: 'forecast', label: 'Forecast', path: '/admin/forecast' },
    { id: 'forecast-target', label: 'Target Evaluation', path: '/admin/forecast/target' },
  ],
};

const MANAGE_ITEMS = [
  { id: 'reports', label: 'Generate Reports', icon: FileDown, path: '/admin/reports' },
  { id: 'master-list', label: 'Salt Farmer Master List', icon: ContactRound, path: '/admin/master-list' },
  { id: 'municipalities', label: 'Municipalities', icon: Map, path: '/admin/municipalities' },
  { id: 'users', label: 'User Management', icon: Users, path: '/admin/users' },
];

/* WHAT: Mga ruta na hindi dapat makita o ma-access ng superadmin sa admin sidebar.
   WHY: Isa lamang ang listahan para madaling i-reverse; gagamitin din
        ng AdminLayout para i-redirect sa /superadmin/health ang pamagat na ruta. */
export const HIDDEN_FROM_SUPERADMIN_ROUTES = [
  '/admin',
  '/admin/forecast',
  '/admin/forecast/target',
  '/admin/data-quality',
  '/admin/validation',
  '/admin/reports',
  '/admin/master-list',
  '/admin/municipalities',
  '/admin/users',
  '/admin/audit-logs',
  '/superadmin/accounts',
  '/superadmin/activity',
];

const SETTINGS_BASE_ITEMS = [
  { id: 'account', label: 'Account', path: '/admin/settings/account' },
  { id: 'security', label: 'Security', path: '/admin/settings/security' },
  { id: 'legal', label: 'Legal', path: '/admin/settings/legal' },
  { id: 'help', label: 'Help & Support', path: '/admin/settings/help' },
  { id: 'about', label: 'About', path: '/admin/settings/about' },
];

/* WHAT: SuperAdmin nav sections, ordered: Overview -> PEOPLE & DATA -> CONTENT -> SYSTEM.
   WHY: Single source of truth for the superadmin sidebar grouping and order.
   Account and Security are rendered in the profile/bottom area instead. */
const SUPERADMIN_GROUPS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/superadmin' },
  {
    id: 'people-data', label: 'PEOPLE & DATA', icon: Users,
    items: [
      { id: 'users', label: 'User Management', icon: Users, path: '/superadmin/users' },
      { id: 'records', label: 'Records', icon: FileText, path: '/superadmin/records' },
      { id: 'audit-log', label: 'Audit Log', icon: ScrollText, path: '/superadmin/audit-log' },
    ],
  },
  {
    id: 'content', label: 'CONTENT', icon: FileText,
    items: [
      { id: 'legal-documents', label: 'Legal Documents', icon: FileText, path: '/superadmin/policies' },
      { id: 'help-center', label: 'Help Center', icon: FileText, path: '/superadmin/help' },
      { id: 'about', label: 'About', icon: FileText, path: '/superadmin/about' },
      { id: 'announcements', label: 'Announcements', icon: FileText, path: '/superadmin/announcement' },
    ],
  },
  {
    id: 'system', label: 'SYSTEM', icon: Sliders,
    items: [
      { id: 'configuration', label: 'Configuration', icon: Sliders, path: '/superadmin/config' },
      { id: 'export-backup', label: 'Export & Backup', icon: FileDown, path: '/superadmin/export' },
    ],
  },
];

/* WHAT: Bottom profile items (Account, Security) rendered outside the main list. */
const SUPERADMIN_BOTTOM_ITEMS = [
  { id: 'account', label: 'Account', path: '/superadmin/settings/account' },
  { id: 'security', label: 'Security', path: '/superadmin/settings/security' },
];

const SETTINGS_GROUP = {
  id: 'settings',
  label: 'Settings',
  icon: Settings,
};

/* WHAT: I-map ang kasalukuyang URL papunta sa active nav id.
   WHY: pathname lang ang basehan, kaya simple at walang IntersectionObserver. */
function activeIdFromPath(pathname) {
  if (pathname === '/help') return 'help';
  if (pathname === '/privacy') return 'privacy';
  if (pathname.startsWith('/admin/settings/account')) return 'account';
  if (pathname.startsWith('/admin/settings/security')) return 'security';
  if (pathname.startsWith('/admin/settings/help')) return 'help';
  if (pathname.startsWith('/admin/settings/legal')) return 'legal';
  if (pathname.startsWith('/admin/settings/about')) return 'about';
  if (pathname.startsWith('/superadmin/users')) return 'users';
  if (pathname.startsWith('/superadmin/audit-log')) return 'audit-log';
  if (pathname.startsWith('/superadmin/records')) return 'records';
  if (pathname.startsWith('/superadmin/export')) return 'export-backup';
  if (pathname.startsWith('/superadmin/health')) return 'overview';
  if (pathname.startsWith('/superadmin/config')) return 'configuration';
  if (pathname === '/superadmin' || pathname === '/superadmin/') return 'overview';
  if (pathname === '/superadmin/dashboard') return 'overview';
  if (pathname === '/superadmin/announcement') return 'announcements';
  if (pathname === '/superadmin/about') return 'about';
  if (pathname === '/superadmin/policies') return 'legal-documents';
  if (pathname === '/superadmin/help') return 'help-center';
  if (pathname === '/superadmin/forecast') return 'forecast';
  if (pathname === '/superadmin/forecast/target') return 'forecast-target';
  if (pathname === '/superadmin/data-quality') return 'data-quality';
  if (pathname.startsWith('/superadmin/accounts') || pathname.startsWith('/admin/system/accounts') || pathname.startsWith('/admin/settings/system/accounts')) return 'system-users';
  if (pathname.startsWith('/superadmin/activity') || pathname.startsWith('/admin/system/activity') || pathname.startsWith('/admin/settings/system/activity')) return 'system-health';
  if (pathname.startsWith('/superadmin/settings/account')) return 'account';
  if (pathname.startsWith('/superadmin/settings/security')) return 'security';
  if (pathname.startsWith('/superadmin/settings/help')) return 'help';
  if (pathname.startsWith('/superadmin/settings/legal')) return 'legal';
  if (pathname.startsWith('/superadmin/settings/about')) return 'about';
  if (pathname.startsWith('/admin/settings/account')) return 'account';
  if (pathname === '/admin/data-quality') return 'data-quality';
  if (pathname === '/admin/forecast/target') return 'forecast-target';
  if (pathname === '/admin/forecast') return 'forecast';
  if (pathname === '/admin/reports') return 'reports';
  if (pathname === '/admin/master-list') return 'master-list';
  if (pathname === '/admin/municipalities') return 'municipalities';
  if (pathname === '/admin/master-list') return 'master-list';
  if (pathname === '/admin/municipalities') return 'municipalities';
  if (pathname === '/admin/users') return 'users';
  return 'dashboard';
}

export default function AdminSidebar({ user, collapsed, onToggle, onLogout, closeMobile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeId = activeIdFromPath(location.pathname);
  const [pendingCount, setPendingCount] = useState(0);

  /* WHAT: Kunin ang pending count mula sa existing /admin/stats.
     WHY: reuse lang ang endpoint na meron na, walang bagong API. */
  useEffect(() => {
    let cancelled = false;
    getAdminStats()
      .then((s) => {
        if (!cancelled) setPendingCount(s?.pending_validation_count ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  /* WHAT: Isara ang mobile drawer bago mag-navigate. WHY: para hindi manatiling bukas. */
  const go = useCallback((path) => () => {
    if (closeMobile) closeMobile();
    navigate(path);
  }, [navigate, closeMobile]);
  const goItem = useCallback((item) => {
    if (closeMobile) closeMobile();
    navigate(item.path);
  }, [navigate, closeMobile]);

  return (
    <aside className="p-sidebar" aria-label="Admin navigation">
      <div className="p-sidebar-inner">
        <SidebarLogo collapsed={collapsed} homePath={user?.role === 'superadmin' ? '/superadmin/health' : '/admin'} />

        {/* WHAT: Pangunahing nav. WHY: aria-label="Main" para sa screen readers. */}
        <nav className="p-nav" aria-label="Main">
          <div className="p-navlist">
            {user?.role !== 'superadmin' && (
              <>
                <SectionLabel collapsed={collapsed}>Main</SectionLabel>
                {MAIN_ITEMS.filter((item) => item.id !== 'validation').map((item) => {
                  // SuperAdmin routes live under /superadmin/* instead of /admin/*.
                  const path = user?.role === 'superadmin'
                    ? item.path.replace('/admin', '/superadmin')
                    : item.path;
                  return (
                    <NavItem
                      key={item.id}
                      icon={item.icon}
                      label={item.label}
                      active={activeId === item.id}
                      badge={item.id === 'validation' ? pendingCount : 0}
                      collapsed={collapsed}
                      onClick={go(path)}
                    />
                  );
                })}
              </>
            )}

            {user?.role === 'superadmin' ? (
              <>
                <NavItem
                  key="overview"
                  icon={LayoutDashboard}
                  label="Overview"
                  active={activeId === 'overview'}
                  collapsed={collapsed}
                  onClick={go('/superadmin')}
                />
                {SUPERADMIN_GROUPS.slice(1).map((group) => (
                  <React.Fragment key={group.id}>
                    <SectionLabel collapsed={collapsed}>{group.label}</SectionLabel>
                    {group.items.map((item) => (
                      <NavItem
                        key={item.id}
                        icon={item.icon}
                        label={item.label}
                        active={activeId === item.id}
                        collapsed={collapsed}
                        onClick={go(item.path)}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </>
            ) : (
              <>
                <Divider />
                <SectionLabel collapsed={collapsed}>Manage</SectionLabel>
                <NavGroup
                  id={FORECAST_GROUP.id}
                  icon={FORECAST_GROUP.icon}
                  label={FORECAST_GROUP.label}
                  items={FORECAST_GROUP.items.map((item) => ({
                    ...item,
                    path: user?.role === 'superadmin'
                      ? item.path.replace('/admin', '/superadmin')
                      : item.path,
                  }))}
                  activeId={activeId}
                  collapsed={collapsed}
                  onNavigate={(item) => goItem({ ...item, path: user?.role === 'superadmin' ? item.path.replace('/admin', '/superadmin') : item.path })}
                />
                {user?.role !== 'superadmin' && (
                  <>
                    {MANAGE_ITEMS.map((item) => (
                      <NavItem
                        key={item.id}
                        icon={item.icon}
                        label={item.label}
                        active={activeId === item.id}
                        collapsed={collapsed}
                        onClick={go(item.path)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </nav>

        <div className="p-bottom">
          <div className="p-sidebar-support">
            {user?.role === 'superadmin' ? (
              <>
                {SUPERADMIN_BOTTOM_ITEMS.map((item) => (
                  <NavItem
                    key={item.id}
                    label={item.label}
                    active={activeId === item.id}
                    collapsed={collapsed}
                    onClick={go(item.path)}
                  />
                ))}
              </>
            ) : (
              <NavGroup
                id={SETTINGS_GROUP.id}
                icon={SETTINGS_GROUP.icon}
                label={SETTINGS_GROUP.label}
                items={SETTINGS_BASE_ITEMS}
                activeId={activeId}
                collapsed={collapsed}
                onNavigate={goItem}
              />
            )}
          </div>
          <CollapseControl collapsed={collapsed} onToggle={onToggle} />
          <UserBlock user={user} collapsed={collapsed} onLogout={onLogout} />
        </div>
      </div>
    </aside>
  );
}
