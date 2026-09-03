import React from 'react';
import { Navbar, Container, Nav, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { logoutAPI } from '../../services/dataService';
import AdminPage from './AdminPage';

export default function AdminLayout({ user, setUser }) {
  const navigate = useNavigate();

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
      <Navbar bg="dark" variant="dark" className="admin-navbar">
        <Container fluid>
          <Navbar.Brand href="#/admin" className="encoder-brand">
            PangAsin <span className="encoder-brand-sub">ASIN Center</span>
          </Navbar.Brand>
          <Nav className="ms-auto">
            <div className="encoder-user">
              <span className="encoder-user-name">{user?.name}</span>
              <span className="encoder-user-muni">Admin · ASIN Center</span>
            </div>
            <Button variant="outline-light" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </Nav>
        </Container>
      </Navbar>
      <Container fluid className="encoder-content admin-content">
        <AdminPage user={user} />
      </Container>
    </div>
  );
}
