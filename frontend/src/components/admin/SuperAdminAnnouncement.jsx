import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Form } from 'react-bootstrap';
import {
  getSuperAdminAnnouncement,
  putSuperAdminAnnouncement,
} from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import ErrorBoundary from '../ErrorBoundary';
import { formatDateTimeManila } from '../../utils/superadminUi';
import { Bell, Clock } from 'lucide-react';

const LEVELS = [
  { value: 'info', label: 'Info', tone: 'info' },
  { value: 'warning', label: 'Warning', tone: 'warning' },
];

const LEVEL_BADGE = { info: 'muni-status-badge--action-info', warning: 'muni-status-badge--action-warning' };

export default function SuperAdminAnnouncement() {
  const { toastSuccess, toastError } = useToast();
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ message: '', level: 'info', active: false, starts_at: '', ends_at: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSuperAdminAnnouncement()
      .then((r) => {
        const a = r.announcement || null;
        setAnnouncement(a);
        if (a) {
          setForm({
            message: a.message || '',
            level: a.level || 'info',
            active: Boolean(a.active),
            starts_at: a.starts_at ? new Date(a.starts_at).toISOString().slice(0, 16) : '',
            ends_at: a.ends_at ? new Date(a.ends_at).toISOString().slice(0, 16) : '',
          });
        }
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load announcement.'); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveAnnouncement = async (payload) => {
    setSaving(true);
    try {
      const res = await putSuperAdminAnnouncement(payload);
      setAnnouncement(res.announcement || res);
      setForm((prev) => ({ ...prev, active: Boolean(res.announcement?.active ?? payload.active) }));
      toastSuccess('Announcement saved.', 'Announcement');
      load();
    } catch (err) { toastError(err.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!form.message.trim()) { toastError('Message is required.'); return; }
    await saveAnnouncement({
      message: form.message.trim(),
      level: form.level,
      active: form.active,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    });
  };

  const handleToggle = async () => {
    const next = !form.active;
    const ok = await confirmAction({
      title: next ? 'Activate announcement?' : 'Deactivate announcement?',
      text: next ? 'This announcement will be shown to all users.' : 'This announcement will be hidden from all users.',
      confirmText: next ? 'Activate' : 'Deactivate',
      danger: !next,
    });
    if (!ok) return;
    await saveAnnouncement({
      message: form.message.trim(),
      level: form.level,
      active: next,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    });
  };

  return (
    <ErrorBoundary>
      <PageHeader id="superadmin-announcement" variant="clean" title="Announcement" subtitle="Slim banner shown on public, admin, and encoder layouts" />
      {error && <Alert variant="danger">{error}</Alert>}
      <Card className="encoder-card admin-card">
        <Card.Body>
          <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="row g-3">
            <Form.Group className="col-md-6">
              <Form.Label>Message</Form.Label>
              <Form.Control as="textarea" rows={3} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              <Form.Text className="text-muted">Shown to all users when active. Keep it short.</Form.Text>
            </Form.Group>
            <Form.Group className="col-md-3">
              <Form.Label>Level</Form.Label>
              <Form.Select required value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="col-md-3">
              <Form.Label>Starts at</Form.Label>
              <Form.Control type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </Form.Group>
            <Form.Group className="col-md-3">
              <Form.Label>Ends at</Form.Label>
              <Form.Control type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </Form.Group>
            <Form.Group className="col-md-3 d-flex align-items-end">
              <Form.Check
                type="switch"
                label="Active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
            </Form.Group>
            <Form.Group className="col-md-3 d-flex align-items-end">
              <button type="submit" className="ui-btn-primary" disabled={saving || !form.message.trim()}>{saving ? 'Saving…' : 'Save announcement'}</button>
            </Form.Group>
          </Form>
        </Card.Body>
      </Card>

      {announcement && (
        <Card className="encoder-card admin-card mt-3">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <Bell size={16} strokeWidth={2} aria-hidden="true" />
                  <h5 className="card-title mb-0">Current announcement</h5>
                </div>
                <div className="text-muted small">Preview of what users see</div>
              </div>
              <button type="button" className={`ui-btn-${announcement.active ? 'danger' : 'outline-success'} ui-btn--sm`} onClick={handleToggle} disabled={saving}>
                {announcement.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
            <div className={`announcement-preview alert-${announcement.level} mb-3`}>
              <span aria-hidden="true">{announcement.level === 'warning' ? <Bell size={14} strokeWidth={2} /> : <Clock size={14} strokeWidth={2} />}</span>
              <span className="me-auto">{announcement.message}</span>
              <Badge className={`mt-0 ${LEVEL_BADGE[announcement.level] || 'muni-status-badge--action-info'}`}>{announcement.level === 'warning' ? 'Warning' : 'Info'}</Badge>
            </div>
            <div className="d-flex gap-2">
              <Badge className={`muni-status-badge ${announcement.active ? 'muni-status-badge--status-success' : 'muni-status-badge--status-secondary'} small me-2`}>{announcement.active ? 'Active' : 'Inactive'}</Badge>
              <span className="text-muted small">
                Level: {announcement.level}&nbsp;|&nbsp;Starts: {formatDateTimeManila(announcement.starts_at)}&nbsp;|&nbsp;Ends: {formatDateTimeManila(announcement.ends_at)}&nbsp;|&nbsp;Updated: {formatDateTimeManila(announcement.updated_at)}
              </span>
            </div>
          </Card.Body>
        </Card>
      )}
    </ErrorBoundary>
  );
}
