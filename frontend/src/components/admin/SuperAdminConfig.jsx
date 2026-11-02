import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Card, Table, Form } from 'react-bootstrap';
import { getSuperAdminSettings, putSuperAdminSetting, getSuperAdminSmtp, sendSmtpTest } from '../../services/dataService';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import { ShieldAlert, Mailbox, Clock, Key, Database, Edit3, Activity, RefreshCw } from 'lucide-react';

const SETTINGS = [
  { key: 'min_password_length', label: 'Minimum password length', type: 'number', icon: ShieldAlert, desc: 'Shortest password an account may set.' },
  { key: 'lockout_attempts', label: 'Lockout after failed attempts', type: 'number', icon: ShieldAlert, desc: 'Failed logins before the account is locked.' },
  { key: 'lockout_minutes', label: 'Lockout duration (minutes)', type: 'number', icon: Clock, desc: 'How long a locked account stays locked.' },
  { key: 'default_password_length', label: 'Default generated password length', type: 'number', icon: Key, desc: 'Length of system-generated temporary passwords.' },
  { key: 'forgot_password_validity_minutes', label: 'Forgot-password link validity (minutes)', type: 'number', icon: Clock, desc: 'How long a reset link remains valid.' },
  { key: 'forgot_password_request_limit_per_hour', label: 'Reset requests per hour per email/IP', type: 'number', icon: Mailbox, desc: 'Rate limit for forgot-password requests.' },
  { key: 'forgot_password_email_subject', label: 'Forgot-password email subject', type: 'text', icon: Mailbox, desc: 'Subject line of the reset email.' },
  { key: 'forgot_password_email_message', label: 'Forgot-password email message', type: 'textarea', icon: Mailbox, desc: 'Body of the reset email.' },
  { key: 'forecast_horizon', label: 'Default forecast horizon (months)', type: 'number', icon: Activity, desc: 'How many months ahead forecasts project.' },
  { key: 'production_methods', label: 'Production methods', type: 'json', icon: Database, desc: 'Allowed production methods (JSON array).' },
];

const TYPE_BADGE = { number: 'primary', text: 'secondary', textarea: 'info', json: 'warning' };

function formatValue(type, value) {
  if (value === undefined || value === null) return '—';
  if (type === 'json') {
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }
  return String(value);
}

function truncateValue(value, maxLen = 60) {
  const s = String(value);
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '…';
}

export default function SuperAdminConfig() {
  const { toastSuccess, toastError } = useToast();
  const [settings, setSettings] = useState({});
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [smtp, setSmtp] = useState(null);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [expandedValue, setExpandedValue] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getSuperAdminSettings().then((r) => {
      const map = {};
      Object.entries(r || {}).forEach(([key, s]) => {
        map[key] = { value: s.value, type: s.type, default: s.default };
      });
      setSettings(map);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadSmtp = useCallback(() => {
    setSmtpLoading(true);
    getSuperAdminSmtp()
      .then((s) => { setSmtp(s); setSmtpLoading(false); })
      .catch(() => { setSmtpLoading(false); });
  }, []);

  useEffect(() => { loadSmtp(); }, [loadSmtp]);

  const startEdit = (key) => {
    setEditing(key);
    setValues({ [key]: settings[key]?.value ?? '' });
    setErrors({});
  };

  const handleChange = (key, e) => { setValues({ ...values, [key]: e.target.value }); setErrors({ ...errors, [key]: null }); };

  const save = async (key) => {
    setErrors({});
    const spec = SETTINGS.find((s) => s.key === key);
    const raw = values[key] || '';
    let val = raw;
    if (spec.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) { setErrors({ ...errors, [key]: 'Must be a number.' }); return; }
      val = n;
    } else if (spec.type === 'json') {
      try {
        val = JSON.parse(raw);
        if (!Array.isArray(val)) throw new Error('must be an array');
      } catch { setErrors({ ...errors, [key]: 'Must be a JSON array, e.g. ["solar","cooked"].' }); return; }
    }
    const original = settings[key]?.value;
    const changed = JSON.stringify(val) !== JSON.stringify(original);
    if (!changed) { setEditing(null); load(); return; }
    setSaving(true);
    try {
      await putSuperAdminSetting(key, val);
      setEditing(null);
      toastSuccess(`${spec.label} updated.`, 'Setting saved');
      load();
    } catch (err) {
      const msg = err.data?.error || err.data?.errors?.join(', ') || err.message || 'Save failed.';
      setErrors({ ...errors, [key]: msg });
      toastError(msg);
    } finally { setSaving(false); }
  };

  const resetToDefault = async (key) => {
    const spec = SETTINGS.find((s) => s.key === key);
    if (!window.confirm(`Reset "${spec.label}" to its default (${JSON.stringify(spec.default)})? This is audited.`)) return;
    setSaving(true);
    try {
      await putSuperAdminSetting(key, spec.default);
      setEditing(null);
      toastSuccess(`Reset to default (${JSON.stringify(spec.default)}).`, 'Setting reset');
      load();
    } catch (err) { toastError(err.data?.error || err.message || 'Reset failed.'); }
    finally { setSaving(false); }
  };

  const handleSmtpTest = async () => {
    setSmtpLoading(true);
    try {
      await sendSmtpTest();
      toastSuccess('Test email sent.', 'SMTP test');
    } catch (err) { toastError(err.message || 'SMTP test failed.'); }
    finally { setSmtpLoading(false); }
  };

  const hasUnsaved = editing && JSON.stringify(values[editing] ?? '') !== JSON.stringify(settings[editing]?.value ?? '');

  return (
    <>
      <PageHeader id="superadmin-config" variant="clean" className="ui-pageheader--admin" title="Configuration" subtitle="Typed, validated system settings. Defaults equal current behavior; every change is audited.">
        <div className="muni-header-actions">
          {hasUnsaved && <span className="muni-status-badge muni-status-badge--action-warning">Unsaved changes</span>}
          <span className="muni-status-badge muni-status-badge--action-secondary">Changes are audited with old and new values</span>
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          {loading && <div className="text-center py-3">Loading settings…</div>}
          {!loading && (
            <div className="table-responsive">
              <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table muni-admin-table config-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Setting</th>
                    <th style={{ width: '26%' }}>Description</th>
                    <th style={{ width: '22%' }}>Current value</th>
                    <th style={{ width: '16%' }}>Default value</th>
                    <th style={{ width: '10%' }}>Type</th>
                    <th style={{ width: '4%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {SETTINGS.map((spec) => {
                    const cur = settings[spec.key];
                    const value = cur ? cur.value : spec.default;
                    const isEditing = editing === spec.key;
                    const isExpanded = expandedValue === spec.key;
                    const displayValue = value === undefined || value === null ? '—' : formatValue(spec.type, value);
                    const defaultDisplay = spec.default === undefined || spec.default === null ? '—' : JSON.stringify(spec.default);
                    return (
                      <tr key={spec.key}>
                        <td>
                          <div className="d-flex align-items-center gap-2">{spec.icon ? <spec.icon size={14} strokeWidth={2} className="text-muted" aria-hidden="true" /> : null} <span className="fw-medium">{spec.label}</span></div>
                          <div className="text-muted small">{spec.desc}</div>
                        </td>
                        <td className="text-break">
                          {isEditing ? (
                            spec.type === 'textarea' ? (
                              <Form.Control as="textarea" rows={3} value={values[spec.key] || ''} onChange={(e) => handleChange(spec.key, e)} />
                            ) : (
                              <Form.Control value={values[spec.key] || ''} onChange={(e) => handleChange(spec.key, e)} />
                            )
                          ) : (
                            <>
                              <span className="text-break config-value" style={{ maxWidth: '200px', display: 'block', whiteSpace: 'pre-wrap' }}>{truncateValue(displayValue, 80)}</span>
                              {displayValue.length > 80 && (
                                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setExpandedValue(spec.key)} title="View full value">
                                  View full
                                </button>
                              )}
                              {isExpanded && (
                                <div className="mt-2">
                                  <div className="config-value-full border rounded p-2 mb-2" style={{ maxWidth: '600px', whiteSpace: 'pre-wrap', fontSize: '0.85rem', fontFamily: 'monospace', background: '#f8fafc' }}>{displayValue}</div>
                                  <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setExpandedValue(null)}>Collapse</button>
                                </div>
                              )}
                            </>
                          )}
                          {errors[spec.key] && <div className="text-danger small mt-1">{errors[spec.key]}</div>}
                        </td>
                        <td className="text-break" style={{ maxWidth: '140px', whiteSpace: 'pre-wrap' }}>{defaultDisplay}</td>
                        <td className="text-nowrap">
                          <span className={`muni-status-badge muni-status-badge--status-${TYPE_BADGE[spec.type] || 'secondary'} small`}>{spec.type.charAt(0).toUpperCase() + spec.type.slice(1)}</span>
                        </td>
                        <td className="text-nowrap">
                          {isEditing ? (
                            <>
                              <button type="button" className="ui-btn-primary" onClick={() => save(spec.key)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                              <button type="button" className="ui-btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="muni-action-btn muni-action-btn--edit ui-btn--sm" onClick={() => startEdit(spec.key)} title={`Edit ${spec.label}`} aria-label={`Edit ${spec.label}`}>
                                <Edit3 size={12} strokeWidth={2} aria-hidden="true" />
                              </button>
                              <button type="button" className="muni-action-btn ui-btn--sm" onClick={() => resetToDefault(spec.key)} title={`Reset ${spec.label} to default`} aria-label={`Reset ${spec.label} to default`}>
                                <RefreshCw size={12} strokeWidth={2} aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* SMTP section */}
      <Card className="encoder-card admin-card mt-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <ShieldAlert size={16} strokeWidth={2} className="text-warning me-1" aria-hidden="true" />
                <h5 className="card-title mb-0">SMTP Configuration</h5>
              </div>
              <div className="text-muted small">Read-only display from environment variables. Password is never shown.</div>
            </div>
            {smtp?.smtp_configured && (
              <button type="button" className="ui-btn-outline ui-btn--sm" onClick={handleSmtpTest} disabled={smtpLoading}>
                {smtpLoading ? 'Testing…' : 'Send test email'}
              </button>
            )}
          </div>
          {smtpLoading && <div className="text-muted small">Testing SMTP…</div>}
          {!smtpLoading && smtp && (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table muni-admin-table">
              <tbody>
                <tr><td className="fw-medium" style={{ width: '35%' }}>Mail server</td><td>{smtp.mail_server || '—'}</td></tr>
                <tr><td className="fw-medium">Mail port</td><td>{smtp.mail_port ?? '—'}</td></tr>
                <tr><td className="fw-medium">Use TLS</td><td>{String(smtp.mail_use_tls)}</td></tr>
                <tr><td className="fw-medium">Use SSL</td><td>{String(smtp.mail_use_ssl)}</td></tr>
                <tr><td className="fw-medium">Username</td><td>{smtp.mail_username || '—'}</td></tr>
                <tr><td className="fw-medium">Default sender</td><td>{smtp.mail_default_sender || '—'}</td></tr>
                <tr><td className="fw-medium">Configured</td><td><Badge className={`muni-status-badge ${smtp.smtp_configured ? 'muni-status-badge--status-success' : 'muni-status-badge--status-warning'}`}>{smtp.smtp_configured ? 'Yes' : 'No'}</Badge></td></tr>
              </tbody>
            </Table>
          )}
          {!smtp && !smtpLoading && <div className="text-muted small">SMTP configuration unavailable.</div>}
        </Card.Body>
      </Card>
    </>
  );
}
