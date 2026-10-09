import React, { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Leaf, Users, ContactRound, Boxes } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  CollapseControl, Divider, NavItem, SectionLabel, SidebarLogo, UserBlock,
} from '../shell/sidebarKit';

/* WHAT: Mga page/section link sa /encoder. section = scroll target sa dashboard.
   WHY: walang sariling route ang records kaya scroll ang behavior. */
const SECTION_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, section: 'encoder-overview' },
  { id: 'records', label: 'Production Records', icon: ClipboardList, section: 'encoder-submissions' },
];

/* WHAT: Mga action item na nagbubukas ng add-modal (hindi page).
   WHY: dati nasa dashboard ang 3 buttons, inilipat dito sa sidebar. */
const ACTION_ITEMS = [
  { id: 'add-production', label: 'Add Production Report', icon: Boxes, report: 'production', accent: true },
  { id: 'add-producer', label: 'Add Producer Report', icon: Users, report: 'producer' },
  { id: 'add-environment', label: 'Add Environment Report', icon: Leaf, report: 'environment' },
];

const MASTER_ITEM = { id: 'master-list', label: 'Master List', icon: ContactRound, path: '/encoder/master-list' };

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function EncoderSidebar({ user, scrollRef, collapsed, onToggle, onLogout, closeMobile }) {
  const navigate = useNavigate();
  const location = useLocation();
  /* WHAT: Derive ang active item direkta sa pathname, walang useState/scroll-spy.
     WHY: dati nag-i-stale ang activeId sa back/forward kaya mali ang highlight. */
  const activeId = location.pathname === '/encoder/master-list' ? 'master-list' : 'overview';

  const muni = user?.municipality_name;
  usePageTitle(muni || 'Encoder Dashboard', muni ? { prefix: '' } : undefined);

  /* WHAT: Page/section shortcut handler. WHY: Production Records ay scroll lang, hindi active. */
  const handleItem = useCallback((item) => {
    if (closeMobile) closeMobile();
    if (item.path) {
      navigate(item.path);
      return;
    }
    if (location.pathname !== '/encoder') {
      navigate('/encoder', { state: { scrollTo: item.section } });
      return;
    }
    const scroller = scrollRef?.current;
    const el = scroller?.querySelector(`#${item.section}`);
    if (scroller && el) {
      const top = (el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12);
      scroller.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }, [navigate, scrollRef, location.pathname, closeMobile]);

  /* WHAT: Buksan ang add-modal kahit saang encoder route. WHY: action item, hindi page (walang active highlight). */
  const openReport = useCallback((report) => {
    if (closeMobile) closeMobile();
    navigate('/encoder', { state: { openReport: report } });
  }, [navigate, closeMobile]);

  return (
    <aside className="p-sidebar" aria-label="Encoder navigation">
      <div className="p-sidebar-inner">
        <SidebarLogo collapsed={collapsed} homePath="/encoder" />

        <nav className="p-nav" aria-label="Main">
          <div className="p-navlist">
            <SectionLabel collapsed={collapsed}>Main</SectionLabel>
            {SECTION_ITEMS.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeId === item.id}
                collapsed={collapsed}
                onClick={() => handleItem(item)}
              />
            ))}

            <Divider />

            <SectionLabel collapsed={collapsed}>Reports</SectionLabel>
            {ACTION_ITEMS.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                iconAccent={item.accent}
                collapsed={collapsed}
                onClick={() => openReport(item.report)}
              />
            ))}

            <Divider />

            <SectionLabel collapsed={collapsed}>Manage</SectionLabel>
            <NavItem
              icon={MASTER_ITEM.icon}
              label={MASTER_ITEM.label}
              active={activeId === MASTER_ITEM.id}
              collapsed={collapsed}
              onClick={() => handleItem(MASTER_ITEM)}
            />
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
