import React from 'react';
import { Navbar, Container, Nav, Button } from 'react-bootstrap';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logoutAPI } from '../../services/dataService';

export default function EncoderLayout({ user }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutAPI();
    } catch (e) {
      // ignore
    }
    navigate('/encoder/login');
  };

  return (
    <div className="encoder-layout">
      <Navbar bg="dark" variant="dark" expand="lg" className="encoder-navbar">
        <Container fluid>
          <Navbar.Brand href="#/encoder" className="encoder-brand">
            PangAsin <span className="encoder-brand-sub">Encoder</span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="encoder-nav" />
          <Navbar.Collapse id="encoder-nav">
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="/encoder" end>Dashboard</Nav.Link>
              <Nav.Link as={NavLink} to="/encoder/records" end>Records</Nav.Link>
              <Nav.Link as={NavLink} to="/encoder/records/new" end>New Record</Nav.Link>
            </Nav>
            <Nav>
              <div className="encoder-user">
                <span className="encoder-user-name">{user?.name}</span>
                <span className="encoder-user-muni">{user?.municipality_name}</span>
              </div>
              <Button variant="outline-light" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container fluid className="encoder-content">
        <Outlet context={{ user }} />
      </Container>
    </div>
  );
}
