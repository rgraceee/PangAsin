import React, { useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logoutAPI } from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import AppShell from '../shell/AppShell';
import AdminSidebar, { HIDDEN_FROM_SUPERADMIN_ROUTES } from './AdminSidebar';

export default function AdminLayout({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef(null);
  const { toastInfo } = useToast();

  useEffect(() => {
    /* WHAT: I-redirect ang superadmin sa /admin kapag nakatunggal sa lumang
       ruta na ngayong nakatago sa sidebar (validation, reports, master list,
       municipalities, audit logs, user management). WHY: frontend-only guard;
       admin/encoder behavior ay hindi nabago. */
    if (user?.role === 'superadmin' && HIDDEN_FROM_SUPERADMIN_ROUTES.includes(location.pathname)) {
      navigate('/admin', { replace: true });
      return;
    }

    const target = location.state?.scrollTo;
    if (!target) return;
    const scroller = scrollRef.current;
    const el = scroller?.querySelector(`#${target}`);
    if (scroller && el) {
      const top = (el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12);
      scroller.scrollTo({ top, behavior: 'auto' });
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, user]);

  const handleLogout = async () => {
    await confirmAction({
      title: 'Log out of PangAsin?',
      text: 'You will need to sign in again to manage data.',
      confirmText: 'Log out',
      onConfirm: async () => {
        try {
          await logoutAPI();
        } catch {
          // The session may already be gone; sign out locally anyway.
        }
        if (setUser) setUser(null);
        toastInfo('You have been signed out.', 'Signed out');
        navigate('/login');
      },
    });
  };

  return (
    <AppShell scrollRef={scrollRef}>
      {({ collapsed, onToggle, closeMobile }) => (
        <AdminSidebar
          user={user}
          collapsed={collapsed}
          onToggle={onToggle}
          onLogout={handleLogout}
          closeMobile={closeMobile}
        />
      )}
    </AppShell>
  );
}
