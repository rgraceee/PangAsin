import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardCheck, DatabaseCheck, Zap, FileDown, ContactRound, Users,
} from 'lucide-react';
import { getAdminStats } from '../../services/dataService';
import {
  CollapseControl, Divider, NavGroup, NavItem, SectionLabel, SidebarLogo, UserBlock,
} from '../shell/sidebarKit';

const MAIN_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
  { id: 'validation', label: 'Validation Queue', icon: ClipboardCheck, path: '/admin/validation' },
  { id: 'data-quality', label: 'Data Quality', icon: DatabaseCheck, path: '/admin/data-quality' },
];

const FORECAST_GROUP = {
  id: 'forecast',
  label: 'Forecasting',
  icon: Zap,
  items: [
    { id: 'forecast', label: 'Forecast', path: '/admin/forecast' },
    { id: 'forecast-target', label: 'Target Evaluation', path: '/admin/forecast/target' },
  ],
};

const MANAGE_ITEMS = [
  { id: 'reports', label: 'Generate Reports', icon: FileDown, path: '/admin/reports' },
  { id: 'master-list', label: 'Producer Master List', icon: ContactRound, path: '/admin/master-list' },
  { id: 'users', label: 'User Management', icon: Users, path: '/admin/users' },
];

/* WHAT: I-map ang kasalukuyang URL papunta sa active nav id.
   WHY: pathname lang ang basehan, kaya simple at walang IntersectionObserver. */
function activeIdFromPath(pathname) {
  if (pathname === '/admin/validation') return 'validation';
  if (pathname === '/admin/data-quality') return 'data-quality';
  if (pathname === '/admin/forecast/target') return 'forecast-target';
  if (pathname === '/admin/forecast') return 'forecast';
  if (pathname === '/admin/reports') return 'reports';
  if (pathname === '/admin/master-list') return 'master-list';
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
        <SidebarLogo collapsed={collapsed} homePath="/admin" />

        {/* WHAT: Pangunahing nav. WHY: aria-label="Main" para sa screen readers. */}
        <nav className="p-nav" aria-label="Main">
          <div className="p-navlist">
            <SectionLabel collapsed={collapsed}>Main</SectionLabel>
            {MAIN_ITEMS.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeId === item.id}
                badge={item.id === 'validation' ? pendingCount : 0}
                collapsed={collapsed}
                onClick={go(item.path)}
              />
            ))}

            <Divider />

            <SectionLabel collapsed={collapsed}>Manage</SectionLabel>
            <NavGroup
              id={FORECAST_GROUP.id}
              icon={FORECAST_GROUP.icon}
              label={FORECAST_GROUP.label}
              items={FORECAST_GROUP.items}
              activeId={activeId}
              collapsed={collapsed}
              onNavigate={goItem}
            />
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
          </div>
        </nav>

        <div className="p-bottom">
          <CollapseControl collapsed={collapsed} onToggle={onToggle} />
          <UserBlock user={user} collapsed={collapsed} onLogout={onLogout} />
        </div>
      </div>
    </aside>
  );
}
