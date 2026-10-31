import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from 'react-bootstrap';
import {
  Settings as SettingsIcon,
  User,
  ShieldCheck,
  HelpCircle,
  Archive,
  Eye,
  EyeOff,
} from 'lucide-react';
import { changePassword } from '../services/dataService';
import { useToast } from './Toast';
import { adminFaq, encoderFaq } from './support/faqData';
import FaqList from './support/FaqList';
import { UserAvatar } from './shell/sidebarUi';

// WHAT: Halaga ng app version mula sa package.json.
// WHY: Isang lugar lang ang source of truth para sa version na ipakit sa Settings > About.
import pkg from '../../package.json';
const APP_VERSION = pkg.version || '0.0.0';

// WHAT: Contact email na ginamit na rin ng Help Manual at Privacy Policy.
// WHY: Isang lugar lang ang contact email para madaling i-update.
const CONTACT_EMAIL = 'pang.asin26@gmail.com';

// WHAT: Mga section ng Settings page sa order na ipakita.
// WHY: Isa lamang ang listahan para consistent ang sidebar sub-items at content panels.
const SECTIONS = [
  { id: 'account', label: 'Account', Icon: User, subtitle: 'Your profile details' },
  { id: 'security', label: 'Security', Icon: ShieldCheck, subtitle: 'Update your password' },
  { id: 'help', label: 'Help & Support', Icon: HelpCircle, subtitle: 'Guides, FAQ and contact' },
  { id: 'legal', label: 'Legal', Icon: Archive, subtitle: 'Privacy and terms' },
  { id: 'about', label: 'About', Icon: SettingsIcon, subtitle: 'About PangAsin' },
];

// WHAT: Section head card (icon tile + title + subtitle) na katulad ng Forecasting page.
// WHY: pare-pareho ang hitsura ng section header sa lahat ng pages.
function SectionHead({ icon: Icon, title, subtitle }) {
  return (
    <div className="settings-section-head">
      <span className="settings-section-chip" aria-hidden="true">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <div>
        <h2 className="settings-section-title">{title}</h2>
        {subtitle && <p className="settings-section-sub">{subtitle}</p>}
      </div>
    </div>
  );
}

// WHAT: Pangunahing component ng Settings page — content-only layout.
//       Navigation lives only in the sidebar; this component shows the selected section panel.
// WHY: paliparin ang layout, alisin ang duplicate left nav.
export default function Settings({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toastSuccess, toastError } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // WHAT: Derive ang active section mula sa URL pathname
  //       (/admin/settings/account -> account).
  // WHY: Nested routes ang nagsasabi ng section na ipapakita.
  const [section, setSection] = useState('account');
  useEffect(() => {
    const parts = location.pathname.split('/');
    const last = parts[parts.length - 1];
    const valid = SECTIONS.map((s) => s.id);
    setSection(valid.includes(last) ? last : 'account');
  }, [location.pathname]);

  const role = user?.role === 'admin' ? 'admin' : 'encoder';
  const homePath = role === 'admin' ? '/admin' : '/encoder';
  const isEncoder = role === 'encoder';
  const roleFaq = role === 'admin' ? adminFaq : encoderFaq;

  // WHAT: Gumagamit ng existing changePassword endpoint mula sa dataService —
//       parehong logic na ginagamit ng ChangePassword page.
// WHY: Reuse lang ang existing logic; hindi kinakopya o inirerewrite.
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
      {/* ===== Section panels ===== */}
      <main className="settings-section-panel">

        {/* Account */}
        {section === 'account' && (
          <>
            <SectionHead icon={User} title="Account" subtitle="Your profile details" />
            <Card className="settings-card">
              <Card.Body className="settings-card-body">
                <div className="settings-account-grid">
                  <div className="settings-account-avatar">
                    <UserAvatar user={user} size={56} />
                  </div>
                  <div className="settings-account-meta">
                    <div className="settings-account-name">{user?.name || '—'}</div>
                    <div className="settings-account-email">{user?.email || '—'}</div>
                    <span className="settings-role-chip">
                      {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—'}
                    </span>
                  </div>
                </div>
                <dl className="settings-account-list">
                  {user?.last_login && (
                    <>
                      <dt>Last login</dt>
                      <dd>{user.last_login}</dd>
                    </>
                  )}
                  {isEncoder && (
                    <>
                      <dt>Assigned municipality</dt>
                      <dd>{user?.municipality_name || 'Not assigned'}</dd>
                    </>
                  )}
                  <dt>Role</dt>
                  <dd>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—'}</dd>
                  <dt>Email</dt>
                  <dd>{user?.email || '—'}</dd>
                </dl>
                <p className="settings-account-note">
                  Account details cannot be edited here. Contact your administrator to change your name, email, role, or municipality assignment.
                </p>
              </Card.Body>
            </Card>
          </>
        )}

        {/* Security */}
        {section === 'security' && (
          <>
            <SectionHead icon={ShieldCheck} title="Security" subtitle="Update your password" />
            <Card className="settings-card">
              <Card.Body className="settings-card-body">
                {error && <div className="settings-error">{error}</div>}
                <form onSubmit={handleChangePassword} className="settings-security-form">
                  <div className="settings-field">
                    <label className="settings-field-label">Current password</label>
                    <div className="settings-input-wrap">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        name="current_password"
                        className="settings-form-control"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        className="settings-toggle-visibility"
                        onClick={() => setShowCurrent((s) => !s)}
                        aria-label={showCurrent ? 'Hide password' : 'Show password'}
                      >
                        {showCurrent ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">New password</label>
                    <div className="settings-input-wrap">
                      <input
                        type={showNew ? 'text' : 'password'}
                        name="new_password"
                        className="settings-form-control"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        minLength="6"
                        required
                      />
                      <button
                        type="button"
                        className="settings-toggle-visibility"
                        onClick={() => setShowNew((s) => !s)}
                        aria-label={showNew ? 'Hide password' : 'Show password'}
                      >
                        {showNew ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                      </button>
                    </div>
                    <div className="settings-field-hint">At least 6 characters.</div>
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">Confirm new password</label>
                    <div className="settings-input-wrap">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        name="confirm_password"
                        className="settings-form-control"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        minLength="6"
                        required
                      />
                      <button
                        type="button"
                        className="settings-toggle-visibility"
                        onClick={() => setShowConfirm((s) => !s)}
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary settings-save-btn"
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Update password'}
                  </button>
                  <p className="settings-security-note mt-3">
                    This uses the same change-password endpoint as the forced first-login password change. Your session stays active after updating.
                  </p>
                </form>
              </Card.Body>
            </Card>
          </>
        )}

        {/* Help & Support */}
        {section === 'help' && (
          <>
            <SectionHead icon={HelpCircle} title="Help &amp; Support" subtitle="Guides, FAQ and contact" />
            <FaqList
              faqs={roleFaq}
              contactEmail={CONTACT_EMAIL}
              manualUrl="/help/manual"
              reportUrl="/help/report"
            />
          </>
        )}

        {/* Legal */}
        {section === 'legal' && (
          <>
            <SectionHead icon={Archive} title="Legal" subtitle="Privacy and terms" />
            <Card className="settings-card">
              <Card.Body className="settings-card-body">
                <ul className="settings-legal-list">
                  <li>
                    <a href="/privacy" className="settings-legal-link">
                      <span className="settings-link-icon" aria-hidden="true">
                        <Archive size={14} strokeWidth={1.5} />
                      </span>
                      <div>
                        <div className="settings-link-title">Privacy Policy</div>
                        <div className="settings-link-desc">How PangAsin collects, uses, and protects your data.</div>
                      </div>
                      <span className="settings-link-chevron" aria-hidden="true">›</span>
                    </a>
                  </li>
                  <li>
                    <a href="/privacy" className="settings-legal-link">
                      <span className="settings-link-icon" aria-hidden="true">
                        <Archive size={14} strokeWidth={1.5} />
                      </span>
                      <div>
                        <div className="settings-link-title">Terms &amp; Conditions</div>
                        <div className="settings-link-desc">Terms of use for the PangAsin dashboard.</div>
                      </div>
                      <span className="settings-link-chevron" aria-hidden="true">›</span>
                    </a>
                  </li>
                </ul>
                <p className="settings-legal-note">
                  Terms &amp; Conditions shares the Privacy Policy page until a separate terms page is published.
                </p>
              </Card.Body>
            </Card>
          </>
        )}

        {/* About */}
        {section === 'about' && (
          <>
            <SectionHead icon={SettingsIcon} title="About" subtitle="About PangAsin" />
            <Card className="settings-card">
              <Card.Body className="settings-card-body">
                <dl className="settings-about-list">
                  <dt>App name</dt>
                  <dd>PangAsin</dd>
                  <dt>Version</dt>
                  <dd>
                    <span className="settings-version-chip">{APP_VERSION}</span>
                  </dd>
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
          </>
        )}
      </main>
    </div>
  );
}
