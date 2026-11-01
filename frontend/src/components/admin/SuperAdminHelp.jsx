import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, ListGroup, Modal } from 'react-bootstrap';
import { getSuperAdminContent } from '../../services/dataService';
import ContentEditor from './ContentEditor';
import CONTENT_DEFAULTS from './contentDefaults';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import { Edit3, BookOpen, Mail } from 'lucide-react';

const FAQ_KEYS = [
  { key: 'faq_public', label: 'Public FAQ', icon: <BookOpen size={16} strokeWidth={2} />, desc: 'FAQ shown on the public Help Center (no login required).' },
  { key: 'faq_admin', label: 'Admin FAQ', icon: <Edit3 size={16} strokeWidth={2} />, desc: 'FAQ shown to administrators in Settings > Help & Support.' },
  { key: 'faq_encoder', label: 'Encoder FAQ', icon: <Edit3 size={16} strokeWidth={2} />, desc: 'FAQ shown to encoders in Settings > Help & Support.' },
];

export default function SuperAdminHelp() {
  const { toastSuccess, toastError } = useToast();
  const [contents, setContents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editKey, setEditKey] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all(FAQ_KEYS.map((f) =>
      getSuperAdminContent(f.key).then((data) => ({ key: f.key, data })).catch((err) => ({ key: f.key, data: CONTENT_DEFAULTS[f.key], err }))
    ))
      .then((results) => {
        const next = {};
        results.forEach((r) => { next[r.key] = r.data; });
        setContents(next);
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load FAQ content.'); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = (key) => {
    toastSuccess(`${FAQ_KEYS.find((f) => f.key === key)?.label || key} updated.`, 'FAQ saved');
    load();
  };

  const countQuestions = (data) => {
    if (!data || !Array.isArray(data)) return 0;
    return data.reduce((sum, cat) => sum + ((cat.items || []).length), 0);
  };

  if (loading) return <PageHeader title="Help Center" subtitle="Edit FAQ entries for public, admin, and encoder audiences" />;

  return (
    <div className="content-page">
      <PageHeader title="Help Center" subtitle="Edit FAQ entries for public, admin, and encoder audiences" />
      {error && <Alert variant="danger">{error}</Alert>}
      <Card className="help-card">
        <ListGroup className="list-group-flush">
          {FAQ_KEYS.map((f) => {
            const data = contents[f.key];
            const questionCount = data ? countQuestions(data) : 0;
            return (
              <ListGroup.Item key={f.key} className="help-item d-flex justify-content-between align-items-start">
                <div className="help-info">
                  <div className="d-flex align-items-center mb-1">
                    {f.icon}
                    <span className="ms-2 fw-bold">{f.label}</span>
                    <span className="ms-2 badge bg-secondary text-light small">{questionCount} question{questionCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="text-muted small">{f.desc}</div>
                </div>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => setEditKey(f.key)}
                  disabled={loading}
                >
                  Edit
                </Button>
              </ListGroup.Item>
            );
          })}
        </ListGroup>
        <div className="card-footer text-muted small p-3">
          Edit a FAQ to add, edit, reorder, or remove categories and questions. Changes are saved to the database and audited.
        </div>
      </Card>

      {/* Edit modal */}
      {editKey && (
        <Modal show={editKey !== null} onHide={() => setEditKey(null)} centered size="xl">
          <ContentEditor
            key={editKey}
            defaultContent={CONTENT_DEFAULTS[editKey]}
            open={editKey !== null}
            onClose={() => setEditKey(null)}
          />
        </Modal>
      )}
    </div>
  );
}
