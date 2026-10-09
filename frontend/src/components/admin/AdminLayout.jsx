import React, { useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logoutAPI } from '../../services/dataService';
import { useToast } from '../Toast';
import AppShell from '../shell/AppShell';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef(null);
  const { toastInfo } = useToast();

  useEffect(() => {
    const target = location.state?.scrollTo;
    if (!target) return;
    const scroller = scrollRef.current;
    const el = scroller?.querySelector(`#${target}`);
    if (scroller && el) {
      const top = (el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12);
      scroller.scrollTo({ top, behavior: 'auto' });
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const handleLogout = async () => {
    try {
      await logoutAPI();
    } catch (e) {
      // ignore
    }
    if (setUser) setUser(null);
    toastInfo('You have been signed out.', 'Signed out');
    navigate('/login');
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
