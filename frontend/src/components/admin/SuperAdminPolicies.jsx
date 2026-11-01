import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, ListGroup, Modal } from 'react-bootstrap';
import { getSuperAdminContent } from '../../services/dataService';
import ContentEditor from './ContentEditor';
import CONTENT_DEFAULTS from './contentDefaults';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import { FileText, Users, ExternalLink } from 'lucide-react';

const POLICIES = [
  { key: 'privacy', label: 'Privacy Policy', icon: <FileText size={16} strokeWidth={2} />, desc: 'How PangAsin collects, uses, and protects personal data.' },
  { key: 'terms', label: 'Terms & Conditions', icon: <FileText size={16} strokeWidth={2} />, desc: 'Terms of use for the PangAsin dashboard.' },
  { key: 'about', label: 'About', icon: <Users size={16} strokeWidth={2} />, desc: 'Application name, version, partners, and credit.' },
];

export default function SuperAdminPolicies() {
  const { toastSuccess, toastError } = useToast();
  const [contents, setContents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editKey, setEditKey] = useState(null);
  const [previewKey, setPreviewKey] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all(POLICIES.map((p) =>
      getSuperAdminContent(p.key).then((data) => ({ key: p.key, data })).catch((err) => ({ key: p.key, data: CONTENT_DEFAULTS[p.key], err }))
    ))
      .then((results) => {
        const next = {};
        results.forEach((r) => { next[r.key] = r.data; });
        setContents(next);
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load policies.'); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = (key) => {
    toastSuccess(`${POLICIES.find((p) => p.key === key)?.label || key} updated.`, 'Policy saved');
    load();
  };

  const renderPreview = (key) => {
    const data = contents[key];
    if (!data) return <div className="text-muted small">No content available.</div>;

    if (key === 'privacy' || key === 'terms') {
      const sections = data.sections || [];
      return (
        <div className="policy-preview">
          <h2 className="policy-preview-title">{data.title || POLICIES.find((p) => p.key === key)?.label}</h2>
          {data.last_updated && <p className="policy-preview-updated">Last updated: {data.last_updated}</p>}
          {sections.map((section, si) => (
            <div key={si} className="policy-section">
              <h3 className="policy-section-title">{section.title || 'Untitled section'}</h3>
              {(section.paragraphs || []).map((p, pi) => (
                <p key={pi} className="policy-paragraph">{p}</p>
              ))}
              {(section.bullets || []).length > 0 && (
                <ul className="policy-bullets">
                  {(section.bullets || []).map((b, bi) => (
                    <li key={bi} className="policy-bullet">{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (key === 'about') {
      return (
        <div className="policy-preview">
          <h2 className="policy-preview-title">{data.name || 'PangAsin'}</h2>
          {data.version && <p className="policy-preview-updated">Version: {data.version}</p>}
          {data.partners && <p className="policy-paragraph"><strong>Partners:</strong> {data.partners}</p>}
          {data.credit && <p className="policy-paragraph"><strong>Credit:</strong> {data.credit}</p>}
          {data.note && <p className="policy-note">{data.note}</p>}
        </div>
      );
    }

    return <div className="text-muted small">Preview not available for this content type.</div>;
  };

  if (loading) return <PageHeader title="Policies" subtitle="Edit Privacy Policy, Terms &amp; Conditions, and About content" />;

  return (
    <div className="content-page">
      <PageHeader title="Policies" subtitle="Edit Privacy Policy, Terms &amp; Conditions, and About content" />
      {error && <Alert variant="danger">{error}</Alert>}
      <Card className="policies-card">
        <ListGroup className="list-group-flush">
          {POLICIES.map((p) => {
            const data = contents[p.key];
            const lastUpdated = data?.last_updated ? `Last updated: ${data.last_updated}` : 'Not yet saved';
            return (
              <ListGroup.Item key={p.key} className="policy-item d-flex justify-content-between align-items-start">
                <div className="policy-info">
                  <div className="d-flex align-items-center mb-1">
                    {p.icon}
                    <span className="ms-2 fw-bold">{p.label}</span>
                  </div>
                  <div className="text-muted small">{p.desc}</div>
                  <div className="text-muted smaller mt-1">{lastUpdated}</div>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setPreviewKey(p.key)}
                    disabled={loading}
                  >
                    <ExternalLink size={14} strokeWidth={2} aria-hidden="true" /> Preview
                  </Button>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setEditKey(p.key)}
                    disabled={loading}
                  >
                    Edit
                  </Button>
                </div>
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      </Card>

      {/* Edit modal */}
      {editKey && (
        <Modal show={editKey !== null} onHide={() => setEditKey(null)} centered>
          <ContentEditor
            key={editKey}
            defaultContent={CONTENT_DEFAULTS[editKey]}
            open={editKey !== null}
            onClose={() => setEditKey(null)}
          />
        </Modal>
      )}

      {/* Preview modal */}
      {previewKey && (
        <Modal show={previewKey !== null} onHide={() => setPreviewKey(null)} centered size="lg">
          <Modal.Header closeButton closeLabel="Close preview">
            <Modal.Title>{POLICIES.find((p) => p.key === previewKey)?.label}</Modal.Title>
          </Modal.Header>
          <Modal.Body>{renderPreview(previewKey)}</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setPreviewKey(null)}>Close</Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}
