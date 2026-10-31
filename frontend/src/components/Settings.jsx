import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Col, Row } from 'react-bootstrap';
import { Settings as SettingsIcon, User, Mail, ShieldCheck, Lock, Key, AtSign, Building, FileText, HelpCircle, HardHat, Archive } from 'lucide-react';
import { changePassword } from '../services/dataService';
import { useToast } from './Toast';

// WHAT: Halaga ng app version mula sa package.json.
// WHY: Isang lugar lang ang source of truth para sa version na ipakit sa Settings > About.
import pkg from '../../package.json';
const APP_VERSION = pkg.version || '0.0.0';

// WHAT: Contact email na ginamit na rin ng Help Manual at Privacy Policy.
// WHY: Isang lugar lang ang contact email para madaling i-update.
const CONTACT_EMAIL = 'pang.asin26@gmail.com';

// WHAT: Mga tanong at sagot sa Help Center batay sa tunay na feature ng sistema.
// WHY: 5-8 na madaling tanong para sa mga nagtatanong kung paano gumamit ng PangAsin.
const FAQS = [
  {
    q: 'How do I submit a production record?',
    a: 'Open Production Records from the sidebar, choose New report, pick the barangay and production month, enter each salt bed’s volume and method, then select Submit. The report goes to the validation queue.',
  },
  {
    q: 'What happens in the validation queue?',
    a: 'Administrators review submitted reports and select Approve or Reject. A comment is required when rejecting. Approved reports are included in production totals and dashboards.',
  },
  {
    q: 'How do I generate a report?',
    a: 'Open Generate Reports, choose the content sections, scope (province or municipality), and time period, then select PDF or Word and Generate. Preview before downloading.',
  },
  {
    q: 'I forgot my password. What do I do?',
    a: 'On the sign-in page, select Forgot password and enter your email. You will receive a reset link. If you do not receive it, contact your administrator or the ASIN Center.',
  },
  {
    q: 'How do I change my password?',
    a: 'Go to Settings > Security and enter your current password and a new password (at least 6 characters). If your account was created with a temporary password, you must change it before opening any other page.',
  },
  {
    q: 'Can encoders see data from other municipalities?',
    a: 'No. Encoders can only see and submit records for the municipality assigned to them. Administrators see data across all municipalities.',
  },
  {
    q: 'What is an environment report?',
    a: 'An environment report records readings and observations for a period (for example, water salinity or weather conditions). Open Environment Records from the sidebar to file one.',
  },
  {
    q: 'Who do I contact for help?',
    a: 'Email the ASIN Center at pang.asin26@gmail.com with your name, municipality, and a short description of the problem. Screenshots help us respond faster.',
  },
];

// WHAT: Halimbawa ng pag-set ng estado para sa buong Settings page — user data,
//       saving flag, error message, at open FAQ index. Isa lamang ang state
//       para simple at predictable ang behavior.
// WHY: centralized state para madaling i-debug kung ano ang nagkakabago sa page.
// WHAT: Pangunahing component ng Settings page para sa admin at encoder.
//       Naglalaman ng Account, Security, Help & Support, Legal, at About sections,
//       kasama ang Help Center FAQ na naka-inline.
// WHY: Isang settings page lang para sa dalawang role; walang role-specific na
//      section maliban sa assigned municipality sa Account section.
export default function Settings({ user }) {
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
// WHAT: Isa lamang ang open FAQ index para sa accordion-style Help Center.
// WHY: Simple at hindi kailangan ng karagdagang library para sa accordion behavior.
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const role = user?.role === 'admin' ? 'admin' : 'encoder';
  const homePath = role === 'admin' ? '/admin' : '/encoder';
  const isEncoder = role === 'encoder';

// WHAT: Gumagamit ng existing changePassword endpoint mula sa dataService —
//       parehong logic na ginagamit ng ChangePassword page (forced first-login
//       password change). Hindi nababago ang backend o endpoint.
// WHY: Reuse lang ang existing logic; hindi kinakopya o inirerewrite ang
//      ChangePassword component.
  const handleChangePassword = async (event) => {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const currentPassword = form.elements.current_password.value;
    const newPassword = form.elements.new_password.value;
    const confirmPassword = form.elements.confirm_password.value;

    if (newPassword.length < 6) {
      setError('The new password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('The new password must be different from the current password.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      toastSuccess('Your new password is now active.', 'Password updated');
      navigate(homePath, { replace: true });
    } catch (err) {
      const message = err.data?.errors
        ? err.data.errors.join(', ')
        : (err.message || 'Could not update the password.');
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <Link to={homePath} className="settings-back">
          <span aria-hidden="true">←</span> Back to dashboard
        </Link>
        <h1 className="settings-title">Settings</h1>
      </div>

      <Row className="g-4">
        {/* ===== Account ===== */}
        <Col lg={4}>
          <Card className="settings-card h-100">
            <Card.Header className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                <User size={16} strokeWidth={1.75} />
              </span>
              <h5 className="settings-card-title">Account</h5>
              <span className="settings-readonly-badge">Read-only</span>
            </Card.Header>
            <Card.Body className="settings-card-body">
              <dl className="settings-account-list">
                <dt>Name</dt>
                <dd>{user?.name || '—'}</dd>
                <dt>Email</dt>
                <dd>{user?.email || '—'}</dd>
                <dt>Role</dt>
                <dd>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—'}</dd>
                {isEncoder && (
                  <>
                    <dt>Assigned municipality</dt>
                    <dd>{user?.municipality_name || 'Not assigned'}</dd>
                  </>
                )}
                {user?.last_login && (
                  <>
                    <dt>Last login</dt>
                    <dd>{user.last_login}</dd>
                  </>
                )}
              </dl>
              <p className="settings-account-note">
                Account details cannot be edited here. Contact your administrator to change your name, email, role, or municipality assignment.
              </p>
            </Card.Body>
          </Card>
        </Col>

        {/* ===== Security ===== */}
        <Col lg={4}>
          <Card className="settings-card h-100">
            <Card.Header className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                <ShieldCheck size={16} strokeWidth={1.75} />
              </span>
              <h5 className="settings-card-title">Security</h5>
            </Card.Header>
            <Card.Body className="settings-card-body">
              <form onSubmit={handleChangePassword} className="settings-security-form">
                {error && <div className="settings-error">{error}</div>}
                <div className="mb-3">
                  <label className="form-label">Current password</label>
                  <input
                    type="password"
                    name="current_password"
                    className="form-control"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">New password</label>
                  <input
                    type="password"
                    name="new_password"
                    className="form-control"
                    autoComplete="new-password"
                    minLength="6"
                    required
                  />
                  <div className="form-text">At least 6 characters.</div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Confirm new password</label>
                  <input
                    type="password"
                    name="confirm_password"
                    className="form-control"
                    autoComplete="new-password"
                    minLength="6"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary settings-save-btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Update password'}
                </button>
              </form>
              <p className="settings-security-note mt-3">
                This uses the same change-password endpoint as the forced first-login password change. Your session stays active after updating.
              </p>
            </Card.Body>
          </Card>
        </Col>

        {/* ===== Help & Support ===== */}
        <Col lg={4}>
          <Card className="settings-card h-100">
            <Card.Header className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                <HelpCircle size={16} strokeWidth={1.75} />
              </span>
              <h5 className="settings-card-title">Help &amp; Support</h5>
            </Card.Header>
            <Card.Body className="settings-card-body">
              <ul className="settings-help-list">
                <li>
                  <Link to="/help" className="settings-help-link">
                    <FileText size={14} strokeWidth={1.5} aria-hidden="true" /> User Manual
                  </Link>
                </li>
                <li>
                  <Link to="/help#faq" className="settings-help-link">
                    <HelpCircle size={14} strokeWidth={1.5} aria-hidden="true" /> Help Center (FAQ)
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="settings-help-link">
                    <Mail size={14} strokeWidth={1.5} aria-hidden="true" /> Report a problem / Contact ASIN Center
                  </a>
                </li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ===== Legal ===== */}
      <Row className="g-4 mt-4">
        <Col lg={4}>
          <Card className="settings-card h-100">
            <Card.Header className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                <Archive size={16} strokeWidth={1.75} />
              </span>
              <h5 className="settings-card-title">Legal</h5>
            </Card.Header>
            <Card.Body className="settings-card-body">
              <ul className="settings-legal-list">
                <li>
                  <Link to="/privacy" className="settings-legal-link">Privacy Policy</Link>
                </li>
                <li>
                  <Link to="/privacy" className="settings-legal-link">Terms &amp; Conditions</Link>
                </li>
              </ul>
              <p className="settings-legal-note">
                Terms &amp; Conditions shares the Privacy Policy page until a separate terms page is published.
              </p>
            </Card.Body>
          </Card>
        </Col>

        {/* ===== About ===== */}
        <Col lg={4}>
          <Card className="settings-card h-100">
            <Card.Header className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                <SettingsIcon size={16} strokeWidth={1.75} />
              </span>
              <h5 className="settings-card-title">About</h5>
            </Card.Header>
            <Card.Body className="settings-card-body">
              <dl className="settings-about-list">
                <dt>App name</dt>
                <dd>PangAsin</dd>
                <dt>Version</dt>
                <dd>{APP_VERSION}</dd>
                <dt>Data partners</dt>
                <dd>DOST NICER ASIN Center · BFAR Regional Field Office 1</dd>
                <dt>Credit</dt>
                <dd>PangAsin, BS Information Technology, Pangasinan State University - Urdaneta City Campus</dd>
              </dl>
              <p className="settings-about-note">
                Salt production monitoring system for the province of Pangasinan.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ===== Help Center FAQ (inline accordion) ===== */}
      <section className="settings-faq-section" id="faq">
        <h2 className="settings-faq-heading">Help Center</h2>
        <p className="settings-faq-sub">
          Short answers to common questions about using PangAsin.
        </p>
        <div className="settings-faq-list">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={index} className="settings-faq-item">
                <button
                  type="button"
                  className={`settings-faq-question${isOpen ? ' active' : ''}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-${index}`}
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                >
                  {faq.q}
                  <span className="settings-faq-toggle" aria-hidden="true">
                    {isOpen ? '▸' : '▾'}
                  </span>
                </button>
                <div id={`faq-${index}`} className="settings-faq-answer" hidden={!isOpen}>
                  {faq.a}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
