import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Table, Form, Badge, Alert } from 'react-bootstrap';
import { getSuperAdminSettings, putSuperAdminSetting, getSuperAdminSmtp, sendSmtpTest } from '../../services/dataService';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import { ShieldAlert, Mailbox, Clock, Key, Database, Edit3, Activity } from 'lucide-react';

const SETTINGS = [
  { key: 'min_password_length', label: 'Minimum password length', type: 'number', icon: <ShieldAlert size={15} strokeWidth={2} />, desc: 'Shortest password an account may set.' },
  { key: 'lockout_attempts', label: 'Lockout after failed attempts', type: 'number', icon: <ShieldAlert size={15} strokeWidth={2} />, desc: 'Failed logins before the account is locked.' },
  { key: 'lockout_minutes', label: 'Lockout duration (minutes)', type: 'number', icon: <Clock size={15} strokeWidth={2} />, desc: 'How long a locked account stays locked.' },
  { key: 'default_password_length', label: 'Default generated password length', type: 'number', icon: <Key size={15} strokeWidth={2} />, desc: 'Length of system-generated temporary passwords.' },
  { key: 'forgot_password_validity_minutes', label: 'Forgot-password link validity (minutes)', type: 'number', icon: <Clock size={15} strokeWidth={2} />, desc: 'How long a reset link remains valid.' },
  { key: 'forgot_password_request_limit_per_hour', label: 'Reset requests per hour per email/IP', type: 'number', icon: <Mailbox size={15} strokeWidth={2} />, desc: 'Rate limit for forgot-password requests.' },
  { key: 'forgot_password_email_subject', label: 'Forgot-password email subject', type: 'text', icon: <Mailbox size={15} strokeWidth={2} />, desc: 'Subject line of the reset email.' },
  { key: 'forgot_password_email_message', label: 'Forgot-password email message', type: 'textarea', icon: <Mailbox size={15} strokeWidth={2} />, desc: 'Body of the reset email.' },
  { key: 'forecast_horizon', label: 'Default forecast horizon (months)', type: 'number', icon: <Activity size={15} strokeWidth={2} />, desc: 'How many months ahead forecasts project.' },
  { key: 'production_methods', label: 'Production methods', type: 'json', icon: <Database size={15} strokeWidth={2} />, desc: 'Allowed production methods (JSON array).' },
];

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

  const load = useCallback(() => {
    setLoading(true);
    getSuperAdminSettings().then((r) => {
      const map = {};
      (r.settings || []).forEach((s) => { map[s.key] = { value: s.value, type: s.type, default: s.default }; });
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
    if (!window.confirm(`Reset “${spec.label}” to its default (${JSON.stringify(spec.default)})? This is audited.`)) return;
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

  return (
    <>
      <PageHeader id="superadmin-config" title="Configuration" subtitle="Typed, validated settings. Defaults equal current behavior; every change is audited." art={<></>}>
        <div className="admin-page-hero-control">
          <Badge className="text-bg-light text-dark border">Changes are audited with old and new values</Badge>
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          {loading && <div className="text-center py-3">Loading settings…</div>}
          {!loading && (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
              <thead>
                <tr><th>Setting</th><th>Value</th><th>Default</th><th>Type</th><th></th></tr>
              </thead>
              <tbody>
                {SETTINGS.map((spec) => {
                  const cur = settings[spec.key];
                  const value = cur ? cur.value : spec.default;
                  const isEditing = editing === spec.key;
                  return (
                    <tr key={spec.key}>
                      <td>
                        <div className="d-flex align-items-center gap-2">{spec.icon} <span className="fw-medium">{spec.label}</span></div>
                        <div className="text-muted small">{spec.desc}</div>
                      </td>
                      <td>
                        {isEditing ? (
                          spec.type === 'textarea' ? (
                            <Form.Control as="textarea" rows={3} value={values[spec.key] || ''} onChange={(e) => handleChange(spec.key, e)} />
                          ) : (
                            <Form.Control value={values[spec.key] || ''} onChange={(e) => handleChange(spec.key, e)} />
                          )
                        ) : (
                          <span className="text-break" style={{ maxWidth: '260px' }}>{value === undefined || value === null ? '—' : JSON.stringify(value)}</span>
                        )}
                        {errors[spec.key] && <div className="text-danger small mt-1">{errors[spec.key]}</div>}
                      </td>
                      <td>{cur ? JSON.stringify(cur.default) : JSON.stringify(spec.default)}</td>
                      <td><span className="text-muted small">{spec.type}</span></td>
                      <td className="text-nowrap">
                        {isEditing ? (
                          <>
                            <Button variant="primary" size="sm" onClick={() => save(spec.key)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                            <Button variant="outline-secondary" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline-primary" size="sm" onClick={() => startEdit(spec.key)}>Edit</Button>
                            <Button variant="outline-danger" size="sm" onClick={() => resetToDefault(spec.key)}>Reset to default</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* SMTP section */}
      <Card className="encoder-card admin-card mt-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h5 className="card-title mb-1"><Edit3 size={16} strokeWidth={2} className="me-2" /> SMTP Configuration</h5>
              <div className="text-muted small">Read-only display from environment variables. Password is never shown.</div>
            </div>
            {smtp?.smtp_configured && (
              <Button variant="outline-primary" size="sm" onClick={handleSmtpTest} disabled={smtpLoading}>
                {smtpLoading ? 'Testing…' : 'Send test email'}
              </Button>
            )}
          </div>
          {smtpLoading && <div className="text-muted small">Testing SMTP…</div>}
          {!smtpLoading && smtp && (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
              <tbody>
                <tr><td className="fw-medium">Mail server</td><td>{smtp.mail_server || '—'}</td></tr>
                <tr><td className="fw-medium">Mail port</td><td>{smtp.mail_port ?? '—'}</td></tr>
                <tr><td className="fw-medium">Use TLS</td><td>{String(smtp.mail_use_tls)}</td></tr>
                <tr><td className="fw-medium">Use SSL</td><td>{String(smtp.mail_use_ssl)}</td></tr>
                <tr><td className="fw-medium">Username</td><td>{smtp.mail_username || '—'}</td></tr>
                <tr><td className="fw-medium">Default sender</td><td>{smtp.mail_default_sender || '—'}</td></tr>
                <tr><td className="fw-medium">Configured</td><td><Badge className={`text-bg-${smtp.smtp_configured ? 'success' : 'warning'}`}>{smtp.smtp_configured ? 'Yes' : 'No'}</Badge></td></tr>
              </tbody>
            </Table>
          )}
          {!smtp && !smtpLoading && <div className="text-muted small">SMTP configuration unavailable.</div>}
        </Card.Body>
      </Card>
    </>
  );
}
