// WHAT: Glass split-screen login page na may salt background at normal na
//      layout. Ang hero ay 100% viewport na may salt_bg.jpg mismo (walang
//      rotate/parallax), at naka-flex ang dalawang kolumna (copy sa kaliwa,
//      login card sa kanan). Naka-scope sa .login-* na mga klase para hindi
//      epekto sa ibang pages (encoder, admin, at guest dashboard).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row } from 'react-bootstrap';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, MapPin, Phone, Scale, ShieldCheck, Trophy } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Reveal from './Reveal';
import { SkeletonBlock } from './Skeleton';
import { loadPublicDashboardData, loginAPI, getMunicipalityProduction } from '../services/dataService';
import { formatMT, formatMTWithUnit } from '../utils/volumeFormat';
import { useToast } from './Toast';
import AdminKpiCard from './admin/AdminKpiCard';
import useCountUp from '../hooks/useCountUp';

const POLICY_MANDATE = 'RA 11985';

function formatProductionYears(records) {
  const years = [...new Set(
    (records || [])
      .map((record) => Number(record.year))
      .filter((year) => Number.isInteger(year)),
  )].sort((a, b) => a - b);

  if (!years.length) return [];

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
  });
  ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
  return ranges;
}

/* WHAT: Logo file ng bawat salt-producing municipality.
   WHY: isang beses lang ideklara ang filename/extensions (may .jpeg ang Dasol);
        ang fallback ay initials para hindi mabasag ang card kapag kulang ang asset. */
const MUNICIPALITY_LOGOS = {
  alaminos: 'alaminos.png',
  'alaminos city': 'alaminos.png',
  anda: 'anda.png',
  bani: 'bani.png',
  bolinao: 'bolinao.png',
  dasol: 'dasol.png',
  infanta: 'infanta.png',
  'san fabian': 'sanfabian.png',
};

function municipalityLogoUrl(name) {
  const key = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const file = MUNICIPALITY_LOGOS[key];
  return file ? `/static/municipalities_logo/${file}` : null;
}

function municipalityInitials(name) {
  return String(name || '')
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/* WHAT: Logo crest ng munisipyo; initials ang fallback kapag walang asset. */
function MunicipalityLogo({ name, size = 'md' }) {
  const src = municipalityLogoUrl(name);
  return (
    <span className={`login-muni-logo-wrap login-muni-logo-wrap--${size}`}>
      {src ? (
        <img
          src={src}
          alt={`${name} logo`}
          className="login-muni-logo"
          width="84"
          height="84"
          loading={size === 'lg' ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <span className="login-muni-logo-initials" aria-hidden="true">{municipalityInitials(name)}</span>
      )}
    </span>
  );
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [kpiData, setKpiData] = useState(null);
  const [kpiError, setKpiError] = useState(false);
  const [errorKey, setErrorKey] = useState(0);
  const [heroReady, setHeroReady] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const resetSuccess = Boolean(location.state?.resetSuccess);
  const { toastSuccess } = useToast();

  const heroRef = useRef(null);
  const statsRef = useRef(null);

  // WHAT: I-mark ang hero na "ready" para sa staggered fade-up (transform lang).
  // WHY: Hindi libo-libo ang animasyon habang hindi pa visible ang hero. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setHeroReady(true);
    }, 60);
    return () => clearTimeout(timer);
  }, []);


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

  const isLoading = kpiData === null && !kpiError;

  /* WHAT: Numero ang kalkulahin mula sa totoong dashboard data.
     WHY: Kapag may totoong data, mula ito; kapag walang data o nag-error,
          hindi inuubos ang random na numero para maiwasan ang makabubulong
          na data sa UI. */
  const dashboardNumbers = useMemo(() => {
    if (kpiError || !kpiData) {
      return {
        municipalityCount: null,
        yearRange: null,
        totalMT: null,
        dataAvailable: false,
      };
    }

    const municipalities = Array.isArray(kpiData.municipalities) ? kpiData.municipalities : [];
    const production = kpiData.production || {};
    const records = Array.isArray(production.records) ? production.records : [];
    const years = formatProductionYears(records);
    const totalMT = Number.isFinite(Number(production.provinceTotalMT))
      ? Number(production.provinceTotalMT)
      : null;

    let yearRange = null;
    if (years.length > 0) {
      const start = years[0].includes('–') ? years[0].split('–')[0] : years[0];
      const end = years[years.length - 1].includes('–')
        ? years[years.length - 1].split('–')[1]
        : years[years.length - 1];
      yearRange = start === end ? start : `${start}–${end}`;
    }

    return {
      municipalityCount: municipalities.length,
      yearRange,
      totalMT,
      dataAvailable: true,
    };
  }, [kpiData, kpiError]);

  const municipalityCount = useCountUp(dashboardNumbers.municipalityCount, { containerRef: statsRef });
  const displayedYearRange = useCountUp(dashboardNumbers.yearRange, { containerRef: statsRef });
  const animatedTotal = useCountUp(dashboardNumbers.totalMT, { containerRef: statsRef });

  const kpis = useMemo(() => {
    const notAvailable = !dashboardNumbers.dataAvailable;

    return {
      municipalities: {
        value: notAvailable ? 'Data unavailable' : String(municipalityCount),
        supporting: 'Municipalities represented in the production dataset',
      },
      years: {
        value: notAvailable ? 'Data unavailable' : displayedYearRange,
        supporting: 'Distinct years represented in the monthly production dataset',
      },
      production: {
        value: notAvailable ? 'Data unavailable' : formatMTWithUnit(animatedTotal),
        supporting: 'Workbook-derived municipality production data',
      },
    };
  }, [municipalityCount, displayedYearRange, animatedTotal, dashboardNumbers.dataAvailable]);

  const municipalityCards = kpiData ? getMunicipalityProduction() : [];

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
      navigate(user.must_change_password ? '/change-password' : (user.role === 'admin' ? '/admin' : '/encoder'));
    } catch (err) {
      const message = err.message || 'Login failed.';
      // WHAT: Pagbubukas ng isang bagong error, ipapatay ang shake animation.
      setErrorKey((key) => key + 1);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section
        className={`login-hero${heroReady ? ' is-ready' : ''}`}
        ref={heroRef}
        id="login-hero"
      >
        <div className="login-hero-media" aria-hidden="true">
          <div className="login-hero-photo" />
        </div>
        <div className="login-hero-veil" />
        <div className="login-hero-content">
          <img
            src="/static/brand/PangAsin_Logo.png"
            alt="PangAsin"
            className="login-hero-logo"
          />
          <h1 className="login-hero-title">PangAsin</h1>
          <p className="login-hero-tagline">
            The Accelerating Salt Research and Innovation (ASIN) Center at Pangasinan State
            University supports the Philippine salt industry through research,
            innovation, and data-driven planning under RA 11985.
          </p>
          <a className="login-hero-scroll-hint" href="#login-about">
            <span>Scroll to explore</span>
            <svg
              className="login-hero-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </a>
        </div>

        <div className="login-form-region">
<div className="login-form-card">
  <Link to="/" className="auth-recovery-back">
    <ArrowLeft size={14} aria-hidden="true" />
    Back to public dashboard
  </Link>
  <h2 className="encoder-login-title">Welcome back</h2>
            <p className="encoder-login-sub">
              Sign in with your encoder or admin account to continue.
            </p>

            {resetSuccess && (
              <Alert variant="success" className="login-form-success">
                <ShieldCheck size={16} aria-hidden="true" className="login-form-error-icon" />
                <span>Password reset complete. Sign in with your new password.</span>
              </Alert>
            )}

            {error && (
              <Alert
                variant="danger"
                className="login-form-error is-shaking"
                key={errorKey}
              >
                <AlertCircle size={16} aria-hidden="true" className="login-form-error-icon" />
                <span>{error}</span>
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="loginEmail">
                <Form.Label className="encoder-login-field-label" htmlFor="loginEmail">
                  Email
                </Form.Label>
                <div className="encoder-login-input-wrap">
                  <Mail
                    size={18}
                    aria-hidden="true"
                    className="encoder-login-input-icon"
                  />
                  <Form.Control
                    id="loginEmail"
                    type="email"
                    className="encoder-login-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@pangasin.gov.ph"
                    autoComplete="username"
                    required
                  />
                </div>
              </Form.Group>
              <Form.Group className="mb-3" controlId="loginPassword">
                <Form.Label className="encoder-login-field-label" htmlFor="loginPassword">
                  Password
                </Form.Label>
                <div className="encoder-login-input-wrap">
                  <Lock size={18} aria-hidden="true" className="encoder-login-input-icon" />
                  <Form.Control
                    id="loginPassword"
                    type={showPassword ? 'text' : 'password'}
                    className="encoder-login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="encoder-login-password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
              </Form.Group>
              <div className="login-forgot-row">
                <Link
                  to="/forgot-password"
                  state={{ email }}
                  className="login-forgot-link"
                >
                  <KeyRound size={14} aria-hidden="true" />
                  Forgot password?
                </Link>
              </div>
              <Button
                type="submit"
                className="w-100 encoder-login-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={17} aria-hidden="true" className="encoder-login-spinner" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <span className="encoder-login-btn-arrow">
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </>
                )}
              </Button>
            </Form>
          </div>
        </div>
      </section>

      <section className="login-about" id="login-about">
        <Container>
          <div className="login-about-header">
            <div className="login-about-eyebrow">About the ASIN Center</div>
            <h2 id="login-about-title" className="login-about-title">
              Accelerating the Philippine Salt Industry
            </h2>
            <p className="login-about-description">
              The Accelerating Salt Research and Innovation (ASIN) Center at Pangasinan State
              University supports the Philippine salt industry through research,
              innovation, and data-driven planning under RA 11985. This dashboard presents
              source-labeled municipality production data and demand benchmarks for the
              salt-producing municipalities of Pangasinan.
            </p>
          </div>

          <div ref={statsRef} className="login-muni-grid-wrap">
            {municipalityCards.length === 0 ? (
              <div className="text-center text-muted">Municipality production data unavailable.</div>
            ) : (
              <>
                <div className="login-muni-top">
                  <Reveal className="login-about-reveal">
                    <Card className="login-muni-kpi login-muni-kpi--top">
                      <Card.Body className="login-muni-body login-muni-body--top">
                        <div className="login-muni-identity">
                          <MunicipalityLogo name={municipalityCards[0].name} size="lg" />
                          <div>
                            <div className="login-muni-eyebrow">
                              <Trophy size={13} aria-hidden="true" />
                              Top producing municipality
                            </div>
                            <div className="login-muni-name">{municipalityCards[0].name}</div>
                          </div>
                        </div>
                        <div className="login-muni-stats">
                          <div className="login-muni-value-row">
                            <span className="login-muni-value">{formatMT(municipalityCards[0].productionMT)}</span>
                            <span className="login-muni-unit">Metric Tons (MT)</span>
                          </div>
                          <div className="login-muni-bar" aria-hidden="true">
                            <span style={{ width: `${municipalityCards[0].percentageOfTotal || 0}%` }} />
                          </div>
                          <div className="login-muni-share">
                            {(municipalityCards[0].percentageOfTotal || 0).toFixed(1)}% of provincial total
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Reveal>
                </div>
                <div className="login-muni-grid">
                  {municipalityCards.slice(1).map((m) => (
                    <Reveal className="login-about-reveal" key={m.id}>
                      <Card className="login-muni-kpi">
                        <Card.Body className="login-muni-body">
                          <MunicipalityLogo name={m.name} />
                          <div className="login-muni-name">{m.name}</div>
                          <div className="login-muni-value-row">
                            <span className="login-muni-value">{formatMT(m.productionMT)}</span>
                            <span className="login-muni-unit">Metric Tons (MT)</span>
                          </div>
                          <div className="login-muni-bar" aria-hidden="true">
                            <span style={{ width: `${m.percentageOfTotal || 0}%` }} />
                          </div>
                          <div className="login-muni-share">{(m.percentageOfTotal || 0).toFixed(1)}% of provincial total</div>
                        </Card.Body>
                      </Card>
                    </Reveal>
                  ))}
                </div>
              </>
            )}
          </div>
        </Container>
      </section>

      {/*
        PLACEHOLDER CONTENT — must be replaced with real values before deployment:
        1. Contact details below (email, phone, office address) are PLACEHOLDERS
           pending the official ASIN Center contact information.
        2. Developer credits are PLACEHOLDERS pending the real names, programs,
           and graduation year of the system's creators.
        TODO(user): replace every item marked TODO(user) below with the official
        contact details and credits. Do not invent real people, phone numbers,
        or addresses.
      */}
      <footer className="login-footer">
        <Container>
          <div className="login-footer-grid">
            <div className="login-footer-brand">
              <div className="login-footer-brand-row" aria-hidden="true">
                <img
                  src="/static/brand/PangAsin_Logo.png"
                  alt=""
                  className="login-footer-brand-logo"
                />
                <span className="login-footer-brand-name">PangAsin</span>
              </div>
              <p className="login-footer-brand-desc">
                Salt production monitoring, forecasting, and decision support.
              </p>
              <p className="login-footer-brand-support">
                Supported by the DOST NICER Program
              </p>
            </div>

            <div className="login-footer-block">
              <div className="login-footer-eyebrow">Contact</div>
              <ul className="login-footer-details">
                <li>
                  <Mail size={18} aria-hidden="true" className="login-footer-icon" />
                  <a
                    href="mailto:pang.asin26@gmail.com"
                    className="login-footer-contact-link"
                  >
                    pang.asin26@gmail.com
                  </a>
                </li>
                <li>
                  <MapPin size={18} aria-hidden="true" className="login-footer-icon" />
                  <span>ASIN Center, PSU Binmaley, Pangasinan</span>
                </li>
                {/* TODO(user): add official phone number row here. Phone placeholder "(075) XXX-XXXX" intentionally hidden. */}
              </ul>
            </div>

            <div className="login-footer-block">
              <div className="login-footer-eyebrow">Developed by</div>
              <p className="login-footer-credits">
                <span className="login-footer-dev-name">PangAsin Development Team</span>
                <br />
                BS Information Technology, Major in Data Analytics,
                Pangasinan State University
              </p>
              <p className="login-footer-meta">Built for the ASIN Center</p>
            </div>
          </div>

          <div className="login-footer-bottom">
            <div className="login-footer-bottom-row">
              <span className="login-footer-copyright">
                © 2026 ASIN Center, Pangasinan State University
              </span>
              <span className="login-footer-policy">
                <Link to="/privacy" className="login-footer-contact-link">Privacy Policy</Link>
                {' · '}
                RA 11985
              </span>
            </div>
          </div>
        </Container>
      </footer>

    </div>
  );
}
