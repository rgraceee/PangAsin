import React, { useEffect, useRef } from 'react';
import { Container } from 'react-bootstrap';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useSidebarState } from './sidebarKit';

/* WHAT: Shared shell para sa admin at encoder (dock, top strip, drawer, content).
   WHY: isang lugar lang ang mobile/focus logic para parehas ang behavior. */
export default function AppShell({ scrollRef, outletContext, children }) {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen, isDesktop } = useSidebarState();
  /* WHAT: Sa mobile, laging expanded ang drawer. WHY: drawer mode, hindi collapse. */
  const effectiveCollapsed = collapsed && isDesktop;
  const location = useLocation();
  const hamburgerRef = useRef(null);
  const dockRef = useRef(null);
  const wasOpenRef = useRef(false);

  /* WHAT: Isara ang drawer tuwing magbabago ang route.
     WHY: bawal manatiling bukas ang drawer pagkatapos mag-navigate. */
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, setMobileOpen]);

  /* WHAT: Ibalik ang focus sa hamburger kapag nagsara ang drawer.
     WHY: kailangan ng keyboard user ang tamang focus pagkatapos. */
  useEffect(() => {
    if (mobileOpen) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      hamburgerRef.current?.focus();
    }
  }, [mobileOpen]);

  /* WHAT: Ilipat ang focus papasok sa drawer + i-trap ang Tab at Escape.
     WHY: fully keyboard-accessible ang off-canvas drawer. */
  useEffect(() => {
    if (!mobileOpen || !dockRef.current) return undefined;

    const getFocusable = () => {
      const nodes = dockRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      return nodes ? Array.from(nodes).filter((n) => !n.disabled && n.offsetParent !== null) : [];
    };

    const focusables = getFocusable();
    (focusables[0] || dockRef.current).focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, setMobileOpen]);

  return (
    <div className="p-app">
      {/* WHAT: Minimal top strip, mobile lang. WHY: dito nakatago ang hamburger. */}
      <header className="p-topstrip">
        <button
          ref={hamburgerRef}
          type="button"
          className="p-hamburger"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        <span className="p-hamburger-label">PangAsin</span>
      </header>

      <div
        className="p-shell"
        data-collapsed={effectiveCollapsed ? 'true' : 'false'}
        data-mobile-open={mobileOpen ? 'true' : 'false'}
      >
        <div className="p-dock" ref={dockRef}>
          {children({
            collapsed: effectiveCollapsed,
            onToggle: toggleCollapsed,
            mobileOpen,
            closeMobile: () => setMobileOpen(false),
          })}
        </div>

        <div
          className="p-backdrop"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />

        <div className="p-main">
          <div className="p-scroll" ref={scrollRef}>
            {/* WHAT: p-content para sa shared shell padding token. WHY: pantay sa sidebar. */}
            <Container fluid className="encoder-content admin-content p-content">
              <Outlet context={outletContext} />
            </Container>
          </div>
        </div>
      </div>
    </div>
  );
}
