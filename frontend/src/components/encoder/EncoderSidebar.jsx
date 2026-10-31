import React, { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ContactRound, ClipboardList, LayoutDashboard, Leaf, Settings } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  CollapseControl, Divider, NavGroup, NavItem, SectionLabel, SidebarLogo, UserBlock,
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

const SETTINGS_GROUP = {
  id: 'settings',
  label: 'Settings',
  icon: Settings,
  items: [
    { id: 'account', label: 'Account', path: '/encoder/settings/account' },
    { id: 'security', label: 'Security', path: '/encoder/settings/security' },
    { id: 'help', label: 'Help & Support', path: '/encoder/settings/help' },
    { id: 'legal', label: 'Legal', path: '/encoder/settings/legal' },
    { id: 'about', label: 'About', path: '/encoder/settings/about' },
  ],
};

export default function EncoderSidebar({ user, collapsed, onToggle, onLogout, closeMobile }) {
  const navigate = useNavigate();
  const location = useLocation();
  /* WHAT: Derive ang active item direkta sa pathname, walang useState.
     WHY: hindi nag-i-stale ang highlight sa back/forward. */
  const pathname = location.pathname;
  const isActive = (item) => (
    item.path === '/encoder' ? pathname === '/encoder' : pathname === item.path
  );
  const isSettingsActive = () => pathname === '/encoder/settings' || pathname.startsWith('/encoder/settings/');
  const settingsActiveId = () => {
    if (pathname.startsWith('/encoder/settings/account')) return 'account';
    if (pathname.startsWith('/encoder/settings/security')) return 'security';
    if (pathname.startsWith('/encoder/settings/help')) return 'help';
    if (pathname.startsWith('/encoder/settings/legal')) return 'legal';
    if (pathname.startsWith('/encoder/settings/about')) return 'about';
    return null;
  };

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
            <NavGroup
              id={SETTINGS_GROUP.id}
              icon={SETTINGS_GROUP.icon}
              label={SETTINGS_GROUP.label}
              items={SETTINGS_GROUP.items}
              activeId={settingsActiveId()}
              collapsed={collapsed}
              onNavigate={handleItem}
            />
          </div>
          <CollapseControl collapsed={collapsed} onToggle={onToggle} />
          <UserBlock user={user} collapsed={collapsed} onLogout={onLogout} />
        </div>
      </div>
    </aside>
  );
}
