import React, { useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logoutAPI } from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import AppShell from '../shell/AppShell';
import EncoderSidebar from './EncoderSidebar';

export default function EncoderLayout({ user }) {
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
    await confirmAction({
      title: 'Log out of PangAsin?',
      text: 'You will need to sign in again to file production reports.',
      confirmText: 'Log out',
      onConfirm: async () => {
        try {
          await logoutAPI();
        } catch (e) {
          // The session may already be gone; sign out locally anyway.
        }
        toastInfo('You have been signed out.', 'Signed out');
        navigate('/login');
      },
    });
  };

  return (
    <AppShell scrollRef={scrollRef} outletContext={{ user }}>
      {({ collapsed, onToggle, closeMobile }) => (
        <EncoderSidebar
          user={user}
          scrollRef={scrollRef}
          collapsed={collapsed}
          onToggle={onToggle}
          onLogout={handleLogout}
          closeMobile={closeMobile}
        />
      )}
    </AppShell>
  );
}
