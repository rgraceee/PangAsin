import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Table } from 'react-bootstrap';
import { getSuperAdminContent } from '../../services/dataService';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import ContentEditor from './ContentEditor';
import CONTENT_DEFAULTS from './contentDefaults';
import { Users, Edit3 } from 'lucide-react';

export default function SuperAdminAbout() {
  const { toastSuccess, toastError } = useToast();
  const [content, setContent] = useState(CONTENT_DEFAULTS.about);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openEdit, setOpenEdit] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSuperAdminContent('about')
      .then((data) => {
        setContent(data || CONTENT_DEFAULTS.about);
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load About content.'); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = () => {
    toastSuccess('About updated.', 'About saved');
    load();
    setOpenEdit(false);
  };

  const rows = [
    { label: 'App name', value: content.name || '—', key: 'name' },
    { label: 'Version', value: content.version || '—', key: 'version' },
    { label: 'Data partners', value: content.partners || '—', key: 'partners' },
    { label: 'Credit', value: content.credit || '—', key: 'credit' },
    { label: 'Note', value: content.note || '—', key: 'note' },
  ];

  return (
    <>
      <PageHeader id="superadmin-about" variant="clean" title="About" subtitle="Application name, version, partners, and credit." />
      {error && <Alert variant="danger">{error}</Alert>}
      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <Users size={16} strokeWidth={2} aria-hidden="true" />
                <h5 className="card-title mb-0">About PangAsin</h5>
              </div>
              <div className="text-muted small">Edit application metadata shown in Settings &gt; About and public pages.</div>
            </div>
            <button type="button" className="ui-btn-outline ui-btn--sm" onClick={() => setOpenEdit(true)} disabled={loading}>
              <Edit3 size={14} strokeWidth={2} aria-hidden="true" /> Edit
            </button>
          </div>
          {loading && <div className="text-muted small">Loading…</div>}
          {!loading && (
            <Table responsive hover size="sm" className="mb-0 encoder-table admin-table muni-admin-table">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="fw-medium text-muted">{r.label}</td>
                    <td className="text-break">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <ContentEditor contentKey="about" defaultContent={CONTENT_DEFAULTS.about} open={openEdit} onClose={() => setOpenEdit(false)} />
    </>
  );
}
