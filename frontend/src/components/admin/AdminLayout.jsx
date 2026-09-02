import React from 'react';
import { Navbar, Container, Nav, Button } from 'react-bootstrap';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logoutAPI } from '../../services/dataService';

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
      <Navbar bg="dark" variant="dark" expand="lg" className="encoder-navbar admin-navbar">
        <Container fluid>
          <Navbar.Brand href="#/admin" className="encoder-brand">
            PangAsin <span className="encoder-brand-sub">ASIN Center</span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="admin-nav" />
          <Navbar.Collapse id="admin-nav">
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="/admin" end>Dashboard</Nav.Link>
              <Nav.Link as={NavLink} to="/admin/validation" end>Validation</Nav.Link>
              <Nav.Link as={NavLink} to="/admin/users" end>Users</Nav.Link>
              <Nav.Link as={NavLink} to="/admin/data-quality" end>Data Quality</Nav.Link>
              <Nav.Link as={NavLink} to="/admin/forecast" end>Forecast</Nav.Link>
              <Nav.Link as={NavLink} to="/admin/forecast/insights" end>Forecast Insights</Nav.Link>
              <Nav.Link as={NavLink} to="/admin/municipalities" end>Municipalities</Nav.Link>
            </Nav>
            <Nav>
              <div className="encoder-user">
                <span className="encoder-user-name">{user?.name}</span>
                <span className="encoder-user-muni">Admin · ASIN Center</span>
              </div>
              <Button variant="outline-light" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container fluid className="encoder-content admin-content">
        <Outlet context={{ user }} />
      </Container>
    </div>
  );
}