import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Gauge, Users, ClipboardCheck, DatabaseCheck, Building2, Boxes, Zap, FileDown, LayoutGrid, UserCog, ChartColumn, Compass, LogOut, Target } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';

const SECTIONS = [
  { id: 'admin-dashboard', label: 'Executive Dashboard', icon: Gauge },
  { id: 'admin-users', label: 'User Management', icon: Users },
  { id: 'admin-validation', label: 'Validation Queue', icon: ClipboardCheck },
  { id: 'admin-data-quality', label: 'Data Quality', icon: DatabaseCheck },
  { id: 'admin-municipality', label: 'Municipality Analytics', icon: Building2 },
  { id: 'admin-supply-demand', label: 'Supply & Demand', icon: Boxes },
  { id: 'admin-forecast', label: 'Forecasting', icon: Zap },
  { id: 'admin-forecast-target', label: 'Target Evaluation', icon: Target },
  { id: 'admin-reports', label: 'Generate Reports', icon: FileDown },
];

const GROUPS = [
  { title: 'Overview', items: SECTIONS.slice(0, 1) },
  { title: 'Manage', items: SECTIONS.slice(1, 4) },
  { title: 'Analytics', items: SECTIONS.slice(4, 6) },
  { title: 'Planning', items: SECTIONS.slice(6, 9) },
];

const GROUP_ICONS = {
  Overview: LayoutGrid,
  Manage: UserCog,
  Analytics: ChartColumn,
  Planning: Compass,
};

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function AdminSidebar({ scrollRef, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const onIndex = location.pathname === '/admin';
  const [activeId, setActiveId] = useState('admin-dashboard');
  usePageTitle(SECTIONS.find((s) => s.id === activeId)?.label);

  useEffect(() => {
    if (!onIndex) {
      const isForecast = location.pathname === '/admin/forecast';
      const isForecastTarget = location.pathname === '/admin/forecast/target';
      const isReports = location.pathname === '/admin/reports';
      const isValidation = location.pathname === '/admin/validation';
      const isDataQuality = location.pathname === '/admin/data-quality';
      let fallback = 'admin-dashboard';
      if (isValidation) fallback = 'admin-validation';
      else if (isDataQuality) fallback = 'admin-data-quality';
      else if (isForecastTarget) fallback = 'admin-forecast-target';
      else if (isForecast) fallback = 'admin-forecast';
      else if (isReports) fallback = 'admin-reports';
      setActiveId(fallback);
      return;
    }
    const scroller = scrollRef?.current;
    if (!scroller || typeof IntersectionObserver === 'undefined') return;

    const elements = SECTIONS
      .filter((s) => s.id !== 'admin-users' && s.id !== 'admin-forecast' && s.id !== 'admin-forecast-target' && s.id !== 'admin-reports' && s.id !== 'admin-validation' && s.id !== 'admin-data-quality')
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
  }, [scrollRef, onIndex]);

  const handleClick = useCallback((id) => {
    const scroller = scrollRef?.current;
    if (id === 'admin-users') {
      navigate('/admin/users');
      setActiveId(id);
      return;
    }
    if (id === 'admin-forecast') {
      navigate('/admin/forecast');
      setActiveId(id);
      return;
    }
    if (id === 'admin-forecast-target') {
      navigate('/admin/forecast/target');
      setActiveId(id);
      return;
    }
    if (id === 'admin-reports') {
      navigate('/admin/reports');
      setActiveId(id);
      return;
    }
    if (id === 'admin-validation') {
      navigate('/admin/validation');
      setActiveId(id);
      return;
    }
    if (id === 'admin-data-quality') {
      navigate('/admin/data-quality');
      setActiveId(id);
      return;
    }
    if (!onIndex) {
      navigate('/admin', { state: { scrollTo: id } });
      setActiveId(id);
      return;
    }
    const el = scroller?.querySelector(`#${id}`);
    if (scroller && el) {
      const top = (el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12);
      scroller.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      setActiveId(id);
    }
  }, [scrollRef, navigate, onIndex]);

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

        <nav aria-label="Admin sections">
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
