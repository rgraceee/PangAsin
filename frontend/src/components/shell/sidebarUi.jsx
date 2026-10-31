import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export const SIDEBAR_COLLAPSE_KEY = 'pangasin.sidebar.collapsed';

/* WHAT: Safe reader ng collapsed flag mula localStorage.
   WHY: bawal sumabog ang app kapag blocked o walang storage access. */
function readCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/* WHAT: Safe writer ng collapsed flag.
   WHY: i-default lang sa expanded kapag hindi ma-persist. */
function writeCollapsed(value) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    /* swallow - bawal mag-crash kapag walang storage */
  }
}

/* WHAT: State para sa collapse + mobile drawer ng sidebar.
   WHY: isang shared hook para parehas ang behavior ng admin at encoder. */
export function useSidebarState() {
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsDesktop(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const setCollapsed = useCallback((value) => {
    setCollapsedState(value);
    writeCollapsed(value);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  return { collapsed, setCollapsed, toggleCollapsed, mobileOpen, setMobileOpen, isDesktop };
}

export function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* WHAT: Normalize a municipality name into a logo filename key.
   WHY: Handle case, spaces, accents and suffixes like "City" so every one of
   the 7 municipalities with a logo asset resolves to a real file. */
function normalizeMunicipalityName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bcity\b/g, '')
    .trim()
    .replace(/\s+/g, '');
}

/* WHAT: Pampublikong map ng munisipyo pangalan patungo sa logo file.
   WHY: Isa lamang ang source of truth para sa avatar ng naka-login na user. */
const MUNICIPALITY_LOGOS = {
  alaminos: 'alaminos.png',
  anda: 'anda.png',
  bani: 'bani.png',
  bolinao: 'bolinao.png',
  dasol: 'dasol.png',
  infanta: 'infanta.png',
  sanfabian: 'sanfabian.png',
};

/* WHAT: URL ng logo ng munisipyo, o kung wala ay null. */
export function municipalityLogoUrl(name) {
  const file = MUNICIPALITY_LOGOS[normalizeMunicipalityName(name)];
  return file ? `/static/municipalities_logo/${file}` : null;
}

/* WHAT: Logo URL para sa avatar ng naka-login na user.
   WHY: Admin ay nagagamit ang ASIN center logo; encoder ay nagagamit ang
   logo ng kaniyang munisipyo. Kung walang logo, balik-null para makita ang
   initials fallback. */
export function getUserLogoUrl(user) {
  if (!user) return null;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return '/static/brand/asin_center_logo.png';
  if (role === 'encoder') return municipalityLogoUrl(user.municipality_name);
  return null;
}

/* WHAT: Avatar ng user na nagpapakita ng logo, at kung wala ay initials.
   WHY: Isa lamang ang avatar component para sa sidebar at Settings. */
export function UserAvatar({ user, size = 36 }) {
  const [showInitials, setShowInitials] = useState(false);
  const src = getUserLogoUrl(user);
  const name = user?.name || 'User';
  const showLogo = !showInitials && Boolean(src);

  return (
    <span
      className="user-avatar-wrap"
      style={{ width: size, height: size }}
      aria-label={name}
    >
      {showLogo ? (
        <img
          src={src}
          alt={`${name} logo`}
          className="user-avatar-img"
          width={size}
          height={size}
          loading="eager"
          decoding="async"
          onError={() => setShowInitials(true)}
        />
      ) : (
        <span className="user-avatar-initials" aria-hidden="true">
          {getInitials(name)}
        </span>
      )}
    </span>
  );
}

/* WHAT: Generic tooltip na naka-portal sa body para hindi maputol ng nav scroll.
   WHY: kailangan lalabas sa hover at keyboard focus kapag collapsed. */
function Tip({ label, disabled, children }) {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);

  const show = () => {
    if (disabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setTip({ top: r.top + r.height / 2, left: r.right + 10 });
  };
  const hide = () => setTip(null);

  useEffect(() => {
    if (disabled) setTip(null);
  }, [disabled]);

  return (
    <span
      ref={ref}
      style={{ display: 'contents' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {tip
        ? createPortal(
            <div className="p-tip-float" role="tooltip" style={{ top: tip.top, left: tip.left }}>
              {label}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

export function SidebarLogo({ homePath = '/' }) {
  /* WHAT: Totoong PangAsin logo (full kapag expanded, mark kapag collapsed).
     WHY: gamitin ang orihinal na file, hindi redrawn icon, at maging home link. */
  return (
    <Link to={homePath} className="p-logo" aria-label="PangAsin home">
      <img
        className="p-logo-img p-logo-full"
        src="/static/brand/Logo_with_PangAsin.png"
        alt="PangAsin"
        width={705}
        height={217}
      />
      <img
        className="p-logo-img p-logo-markonly"
        src="/static/brand/PangAsin_Logo.png"
        alt="PangAsin"
        width={230}
        height={186}
      />
    </Link>
  );
}

export function SectionLabel({ children, collapsed }) {
  if (collapsed) return null;
  return <div className="p-section-label">{children}</div>;
}

export function Divider() {
  return <div className="p-divider" role="separator" />;
}

export function NavItem({ icon: Icon, label, active, badge = 0, onClick, collapsed }) {
  const showBadge = badge > 0;
  const tipText = showBadge ? `${label} (${badge})` : label;

  return (
    <Tip label={tipText} disabled={!collapsed}>
      <button
        type="button"
        className={`p-row${active ? ' active' : ''}`}
        onClick={onClick}
        aria-label={collapsed ? tipText : undefined}
        aria-current={active ? 'page' : undefined}
      >
        {Icon ? <Icon className="p-row-icon" size={20} strokeWidth={1.5} /> : null}
        <span className="p-row-label">{label}</span>
        {showBadge ? <span className="p-badge">{badge}</span> : null}
      </button>
    </Tip>
  );
}

export function NavGroup({ id, icon: Icon, label, items, activeId, collapsed, onNavigate }) {
  const hasActive = items.some((it) => it.id === activeId);
  const [open, setOpen] = useState(hasActive);
  const listId = `${id}-list`;

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  /* WHAT: Kapag collapsed, diretso sa unang child imbes na flyout.
     WHY: mas simple at fully keyboard-accessible, wala ring positioning bugs. */
  const handleParent = () => {
    if (collapsed) {
      onNavigate(items[0]);
      return;
    }
    setOpen((o) => !o);
  };

  return (
    <div>
      <Tip label={label} disabled={!collapsed}>
        <button
          type="button"
          className={`p-row${hasActive && (collapsed || !open) ? ' active' : ''}`}
          onClick={handleParent}
          aria-expanded={collapsed ? undefined : open}
          aria-controls={collapsed ? undefined : listId}
          aria-label={collapsed ? label : undefined}
        >
          {Icon ? <Icon className="p-row-icon" size={20} strokeWidth={1.5} /> : null}
          <span className="p-row-label">{label}</span>
          <ChevronRight className="p-row-chevron" size={16} strokeWidth={1.5} />
        </button>
      </Tip>
      {!collapsed && open ? (
        <div className="p-sublist" id={listId}>
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              className={`p-subrow${activeId === it.id ? ' active' : ''}`}
              onClick={() => onNavigate(it)}
              aria-current={activeId === it.id ? 'page' : undefined}
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CollapseControl({ collapsed, onToggle }) {
  return (
    <div className="p-collapse-slot">
      <NavItem
        icon={collapsed ? PanelLeftOpen : PanelLeftClose}
        label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggle}
        collapsed={collapsed}
      />
    </div>
  );
}

export function UserBlock({ user, collapsed, onLogout }) {
  const name = user?.name || 'User';
  const roleRaw = (user?.role || '').toString();
  const roleLabel = roleRaw ? roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1) : 'Signed in';

  return (
      <div className="p-user">
        <Tip label={name} disabled={!collapsed}>
          <UserAvatar user={user} size={36} />
        </Tip>
      <div className="p-user-meta">
        <div className="p-user-name" title={name}>{name}</div>
        <div className="p-user-role">{roleLabel}</div>
      </div>
      <button
        type="button"
        className="p-user-logout"
        onClick={onLogout}
        aria-label="Log out"
        title="Log out"
      >
        <LogOut size={18} strokeWidth={1.5} />
      </button>
    </div>
  );
}
