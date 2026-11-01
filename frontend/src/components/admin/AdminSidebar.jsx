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

/* WHAT: Isa lamang ang listahan ng System items para sa superadmin.
   WHY: Madaling i-appende ang Records, Export & Backup, Health, Configuration. */
const SYSTEM_ITEMS = [
  { id: 'account', label: 'Account', path: '/superadmin/settings/account' },
  { id: 'security', label: 'Security', path: '/superadmin/settings/security' },
  { id: 'legal', label: 'Legal', path: '/superadmin/settings/legal' },
  { id: 'help', label: 'Help & Support', path: '/superadmin/settings/help' },
  { id: 'about', label: 'About', path: '/superadmin/settings/about' },
  { id: 'system-section', label: 'System', labelOnly: true },
  { id: 'system-users', label: 'User Management', icon: Users, path: '/superadmin/users' },
  { id: 'system-audit-log', label: 'Audit Log', icon: ScrollText, path: '/superadmin/audit-log' },
  { id: 'system-records', label: 'Records', icon: FileText, path: '/superadmin/records' },
  { id: 'system-export', label: 'Export & Backup', icon: FileDown, path: '/superadmin/export' },
  { id: 'system-health', label: 'Health', icon: Activity, path: '/superadmin/health' },
  { id: 'system-config', label: 'Configuration', icon: Sliders, path: '/superadmin/config' },
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
  if (pathname.startsWith('/superadmin/users')) return 'system-users';
  if (pathname.startsWith('/superadmin/audit-log')) return 'system-audit-log';
  if (pathname.startsWith('/superadmin/records')) return 'system-records';
  if (pathname.startsWith('/superadmin/export')) return 'system-export';
  if (pathname.startsWith('/superadmin/health')) return 'system-health';
  if (pathname.startsWith('/superadmin/config')) return 'system-config';
  if (pathname === '/superadmin/dashboard') return 'dashboard';
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
            <SectionLabel collapsed={collapsed}>Main</SectionLabel>
            {MAIN_ITEMS.filter((item) => {
              if (user?.role === 'superadmin') {
                // SuperAdmin sees Dashboard and Data Quality (view-only),
                // but not Validation Queue.
                return item.id !== 'validation';
              }
              return true;
            }).map((item) => {
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
          </div>
        </nav>

        <div className="p-bottom">
          <div className="p-sidebar-support">
            <NavGroup
              id={SETTINGS_GROUP.id}
              icon={SETTINGS_GROUP.icon}
              label={SETTINGS_GROUP.label}
              items={user?.role === 'superadmin' ? SYSTEM_ITEMS : SETTINGS_BASE_ITEMS}
              activeId={activeId}
              collapsed={collapsed}
              onNavigate={goItem}
            />
          </div>
          <CollapseControl collapsed={collapsed} onToggle={onToggle} />
          <UserBlock user={user} collapsed={collapsed} onLogout={onLogout} />
        </div>
      </div>
    </aside>
  );
}
