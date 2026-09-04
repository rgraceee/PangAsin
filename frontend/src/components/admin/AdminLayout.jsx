import React, { useRef, useEffect } from 'react';
import { Container } from 'react-bootstrap';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { logoutAPI } from '../../services/dataService';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef(null);

  useEffect(() => {
    const target = location.state?.scrollTo;
    if (!target) return;
    const el = scrollRef.current?.querySelector(`#${target}`);
    if (scrollRef.current && el) {
      const scroller = scrollRef.current;
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
    navigate('/login');
  };

  return (
    <div className="encoder-layout admin-layout">
      <div className="admin-shell">
        <div className="admin-dock">
          <AdminSidebar scrollRef={scrollRef} onLogout={handleLogout} />
        </div>
        <div className="admin-main-content">
          <div className="admin-page-scroll" ref={scrollRef}>
            <Container fluid className="encoder-content admin-content">
              <Outlet />
            </Container>
          </div>
        </div>
      </div>
    </div>
  );
}
