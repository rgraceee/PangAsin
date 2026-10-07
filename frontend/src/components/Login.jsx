import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, Container, Form, Row } from 'react-bootstrap';
import { CalendarDays, Mail, MapPin, Phone, Scale, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { loadPublicDashboardData, loginAPI } from '../services/dataService';
import { useToast } from './Toast';
import AdminKpiCard from './admin/AdminKpiCard';

function formatProductionYears(records) {
  const years = [...new Set(
    (records || [])
      .map((record) => Number(record.year))
      .filter((year) => Number.isInteger(year)),
  )].sort((a, b) => a - b);

  if (!years.length) return null;

  const ranges = [];
  let start = years[0];
  let previous = years[0];

  years.slice(1).forEach((year) => {
    if (year === previous + 1) {
      previous = year;
      return;
    }
    ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = year;
    previous = year;
  });
  ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
  return ranges.join(', ');
}

function formatKpiNumber(value, suffix = '') {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString()}${suffix}` : null;
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [kpiData, setKpiData] = useState(null);
  const [kpiError, setKpiError] = useState(false);
  const navigate = useNavigate();
  const { toastSuccess } = useToast();

  useEffect(() => {
    let active = true;

    loadPublicDashboardData()
      .then((data) => {
        if (active) setKpiData(data || {});
      })
      .catch(() => {
        if (active) setKpiError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const kpis = useMemo(() => {
    if (kpiError) {
      return {
        municipalities: { value: 'Data unavailable', supporting: 'Public dashboard data could not be loaded.' },
        years: { value: 'Data unavailable', supporting: 'Public dashboard data could not be loaded.' },
        production: { value: 'Data unavailable', supporting: 'Public dashboard data could not be loaded.' },
      };
    }

    if (!kpiData) {
      return {
        municipalities: { value: 'Loading…', supporting: 'Approved production records from the public dashboard.' },
        years: { value: 'Loading…', supporting: 'Years with approved monthly production records.' },
        production: { value: 'Loading…', supporting: 'Approved production recorded in the public dashboard.' },
      };
    }

    const municipalities = Array.isArray(kpiData.municipalities) ? kpiData.municipalities : [];
    const production = kpiData.production || {};
    const records = Array.isArray(production.records) ? production.records : [];
    const productionYears = formatProductionYears(records);
    const totalProduction = records.length ? formatKpiNumber(production.provinceTotalMT, ' MT') : null;

    return {
      municipalities: {
        value: municipalities.length ? municipalities.length.toLocaleString() : 'No data yet',
        supporting: 'Municipalities with approved production records',
      },
      years: {
        value: productionYears || 'No data yet',
        supporting: 'Years with approved monthly production records',
      },
      production: {
        value: totalProduction || 'No data yet',
        supporting: 'Approved production recorded in the public dashboard',
      },
    };
  }, [kpiData, kpiError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await loginAPI(email, password);
      if (user.role !== 'admin' && user.role !== 'encoder') {
        throw Object.assign(new Error('This account cannot sign in to PangAsin.'), { status: 403 });
      }
      onLogin(user);
      toastSuccess('Log in successful.', 'Welcome back');
      navigate(user.role === 'admin' ? '/admin' : '/encoder');
    } catch (err) {
      const message = err.message || 'Login failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="login-hero-media">
          <div className="login-hero-overlay" aria-hidden="true" />
          <div className="login-hero-content">
            <img src="/static/brand/PangAsin_Logo.png" alt="PangAsin" className="login-hero-logo" />
            <h1 className="login-hero-title">PangAsin</h1>
            <p className="login-hero-tagline">
              The Accelerating Salt Research and Innovation (ASIN) Center at Pangasinan State University
              supports the Philippine salt industry through research, innovation, and data-driven
              planning under RA 11985.
            </p>
          </div>
        </div>

        <div className="login-form-region">
          <main className="login-form-card">
            <div className="encoder-login-eyebrow">Secure sign in</div>
            <h2 className="encoder-login-title">Welcome back</h2>
            <p className="encoder-login-sub">
              Sign in with your encoder or admin account to continue.
            </p>

            {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="loginEmail">
                <Form.Label className="encoder-login-field-label">Email</Form.Label>
                <Form.Control
                  type="email"
                  className="encoder-login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@pangasin.gov.ph"
                  required
                />
              </Form.Group>
              <Form.Group className="mb-4" controlId="loginPassword">
                <Form.Label className="encoder-login-field-label">Password</Form.Label>
                <Form.Control
                  type="password"
                  className="encoder-login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Form.Group>
              <Button type="submit" className="w-100 encoder-login-btn" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </Form>

            <div className="encoder-login-footer">
              <Link to="/">← Back to public dashboard</Link>
            </div>
          </main>
        </div>
      </section>

      <section className="login-about" aria-labelledby="login-about-title">
        <Container>
          <div className="login-about-header">
            <div className="login-about-eyebrow">About the ASIN Center</div>
            <h2 id="login-about-title" className="login-about-title">
              Accelerating the Philippine Salt Industry
            </h2>
            <p className="login-about-description">
              The Accelerating Salt Research and Innovation (ASIN) Center at Pangasinan State University
              supports the Philippine salt industry through research, innovation, and data-driven planning
              under RA 11985. This dashboard presents approved and aggregated salt production information
              from the salt-producing municipalities of Pangasinan.
            </p>
          </div>

          <Row className="g-3 g-lg-4 login-about-grid">
            <Col xs={12} sm={6} lg={3}>
              <AdminKpiCard
                className="login-about-kpi"
                icon={MapPin}
                title="Municipalities covered"
                value={kpis.municipalities.value}
                supporting={kpis.municipalities.supporting}
                accent="ocean"
              />
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <AdminKpiCard
                className="login-about-kpi"
                icon={CalendarDays}
                title="Years of data tracked"
                value={kpis.years.value}
                supporting={kpis.years.supporting}
                accent="gold"
              />
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <AdminKpiCard
                className="login-about-kpi"
                icon={Scale}
                title="Recorded production"
                value={kpis.production.value}
                supporting={kpis.production.supporting}
                accent="green"
              />
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <AdminKpiCard
                className="login-about-kpi"
                icon={ShieldCheck}
                title="Policy mandate"
                value="RA 11985"
                supporting="ASIN Center mandate for salt research and innovation"
                accent="brown"
              />
            </Col>
          </Row>
        </Container>
      </section>

      {/*
        PLACEHOLDER CONTENT — must be replaced with real values before deployment:
        1. Contact details below (email, phone, office address) are PLACEHOLDERS
           pending the official ASIN Center contact information.
        2. Developer credits are PLACEHOLDERS pending the real names, programs,
           and graduation year of the system's creators.
      */}
      <footer className="login-footer">
        <Container>
          <div className="login-footer-grid">
            <div className="login-footer-block">
              <div className="login-footer-eyebrow" id="login-footer-contact">
                Contact
              </div>
              <p className="login-footer-org">
                Accelerating Salt Research and Innovation (ASIN) Center,
                Pangasinan State University
              </p>
              <p className="login-footer-support">
                Supported by the DOST NICER Program.
              </p>
              {/* PLACEHOLDER — swap for the official ASIN Center contact details. */}
              <ul className="login-footer-details">
                <li>
                  <Mail size={13} aria-hidden="true" />
                  <span>contact@pangasin.gov.ph</span>
                </li>
                <li>
                  <Phone size={13} aria-hidden="true" />
                  <span>(075) XXX-XXXX</span>
                </li>
                <li>
                  <MapPin size={13} aria-hidden="true" />
                  <span>ASIN Center, PSU [campus], Pangasinan</span>
                </li>
              </ul>
            </div>

            <div className="login-footer-block">
              <div className="login-footer-eyebrow">Developed by</div>
              {/* PLACEHOLDER — replace with the real developer names, programs, and year. */}
              <p className="login-footer-credits">
                [Developer Name 1], [Developer Name 2] — BS [Program],
                Pangasinan State University, [Year]
              </p>
              <p className="login-footer-meta">
                PangAsin — salt production monitoring, forecasting, and decision
                support system.
              </p>
            </div>
          </div>

          <div className="login-footer-bottom">
            <span>© 2026 PangAsin / ASIN Center</span>
          </div>
        </Container>
      </footer>
    </div>
  );
}