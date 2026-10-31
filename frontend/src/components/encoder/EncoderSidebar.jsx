import React, { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, ContactRound, ClipboardList, LayoutDashboard, Leaf, ShieldCheck } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  CollapseControl, Divider, NavItem, SectionLabel, SidebarLogo, UserBlock,
} from '../shell/sidebarUi';

/* WHAT: Mga page sa /encoder. Main = Dashboard, Manage = records pages.
   WHY: may sariling route na ang bawat manage page, kaya exact/prefix match
        ang active state — hindi na scroll target. */
const MAIN_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: '/encoder' },
];

const MANAGE_ITEMS = [
  { id: 'production-records', label: 'Production Records', icon: ClipboardList, path: '/encoder/production-records' },
  { id: 'master-list', label: 'Salt Farmer Master List', icon: ContactRound, path: '/encoder/master-list' },
  { id: 'environment-records', label: 'Environment Records', icon: Leaf, path: '/encoder/environment-records' },
];

export default function EncoderSidebar({ user, collapsed, onToggle, onLogout, closeMobile }) {
  const navigate = useNavigate();
  const location = useLocation();
  /* WHAT: Derive ang active item direkta sa pathname, walang useState.
     WHY: hindi nag-i-stale ang highlight sa back/forward. */
  const pathname = location.pathname;
  const isActive = (item) => (
    item.path === '/encoder' ? pathname === '/encoder' : pathname === item.path
  );

  const muni = user?.municipality_name;
  usePageTitle(muni || 'Encoder Dashboard', muni ? { prefix: '' } : undefined);

  const handleItem = useCallback((item) => {
    if (closeMobile) closeMobile();
    navigate(item.path);
  }, [navigate, closeMobile]);

  return (
    <aside className="p-sidebar" aria-label="Encoder navigation">
      <div className="p-sidebar-inner">
        <SidebarLogo collapsed={collapsed} homePath="/encoder" />

        <nav className="p-nav" aria-label="Main">
          <div className="p-navlist">
            <SectionLabel collapsed={collapsed}>Main</SectionLabel>
            {MAIN_ITEMS.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={isActive(item)}
                collapsed={collapsed}
                onClick={() => handleItem(item)}
              />
            ))}

            <Divider />

            <SectionLabel collapsed={collapsed}>Manage</SectionLabel>
            {MANAGE_ITEMS.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={isActive(item)}
                collapsed={collapsed}
                onClick={() => handleItem(item)}
              />
            ))}
          </div>
        </nav>

        <div className="p-bottom">
          <div className="p-sidebar-support">
            <NavItem
              icon={BookOpen}
              label="User Manual"
              active={pathname === '/help'}
              collapsed={collapsed}
              onClick={() => handleItem({ path: '/help' })}
            />
            <NavItem
              icon={ShieldCheck}
              label="Privacy Policy"
              active={pathname === '/privacy'}
              collapsed={collapsed}
              onClick={() => handleItem({ path: '/privacy' })}
            />
          </div>
          <CollapseControl collapsed={collapsed} onToggle={onToggle} />
          <UserBlock user={user} collapsed={collapsed} onLogout={onLogout} />
        </div>
      </div>
    </aside>
  );
}
