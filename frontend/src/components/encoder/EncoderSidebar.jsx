import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Gauge, ClipboardList, LayoutGrid, UserCog, LogOut } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';

const SECTIONS = [
  { id: 'encoder-overview', label: 'Overview', icon: Gauge },
  { id: 'encoder-submissions', label: 'Submissions', icon: ClipboardList },
];

const GROUPS = [
  { title: 'Overview', items: SECTIONS.slice(0, 1) },
  { title: 'Records', items: SECTIONS.slice(1, 2) },
];

const GROUP_ICONS = {
  Overview: LayoutGrid,
  Records: UserCog,
};

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function EncoderSidebar({ user, scrollRef, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeId, setActiveId] = useState('encoder-overview');

  const muni = user?.municipality_name;
  const muniTitle = muni || 'Encoder Dashboard';

  usePageTitle(muniTitle, muni ? { prefix: '' } : undefined);

  useEffect(() => {
    const scroller = scrollRef?.current;
    if (!scroller || typeof IntersectionObserver === 'undefined') return;

    const elements = SECTIONS
      .map((s) => scroller.querySelector(`#${s.id}`))
      .filter(Boolean);

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) {
        setActiveId(visible[0].target.id);
      }
    }, {
      root: scroller,
      rootMargin: '-10% 0px -75% 0px',
      threshold: 0,
    });

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [scrollRef, location.pathname]);

  const handleClick = useCallback((id) => {
    const scroller = scrollRef?.current;
    const el = scroller?.querySelector(`#${id}`);
    if (scroller && el) {
      const top = (el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12);
      scroller.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      setActiveId(id);
    }
  }, [scrollRef]);

  return (
    <aside className="admin-sidebar">
      <div className="admin-watermark" aria-hidden="true" />
      <div className="admin-sidebar-inner">
        <div className="admin-sidebar-header">
          <img
            src="/static/brand/Logo_with_PangAsin.png"
            alt="PangAsin ASIN Center"
            className="admin-logo-word"
          />
        </div>

        <div className="admin-checkerband" aria-hidden="true" />

        <nav aria-label="Encoder sections">
          {GROUPS.map((group) => {
            const GroupIcon = GROUP_ICONS[group.title];
            return (
            <div key={group.title}>
              <div className="admin-sidebar-section">
                <GroupIcon size={10} strokeWidth={2.5} className="me-1" />
                {group.title}
              </div>
              {group.items.map((s) => (
                <SidebarLink
                  key={s.id}
                  {...s}
                  active={activeId === s.id}
                  onClick={() => handleClick(s.id)}
                />
              ))}
            </div>
            );
          })}
        </nav>

        {user && (
          <div className="encoder-sidebar-user">
            <div className="encoder-sidebar-user-name">{user.name}</div>
            {user.municipality_name && <div className="encoder-sidebar-user-muni">{user.municipality_name}</div>}
          </div>
        )}

        <div className="admin-sidebar-footer">
          <button type="button" className="admin-logout" onClick={onLogout}>
            <LogOut size={16} strokeWidth={2} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({ id, label, icon: Icon, active, onClick }) {
  return (
    <button
      type="button"
      className={`admin-sidebar-link ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-label={`Jump to ${label}`}
      aria-current={active ? 'true' : undefined}
      tabIndex={0}
    >
      <Icon size={16} strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
}