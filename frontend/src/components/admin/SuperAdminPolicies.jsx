import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Modal } from 'react-bootstrap';
import { getSuperAdminContent } from '../../services/dataService';
import ContentEditor from './ContentEditor';
import CONTENT_DEFAULTS from './contentDefaults';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import { FileText, Users, ExternalLink, Edit3 } from 'lucide-react';
import { SkeletonTable } from '../Skeleton';

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

  return (
    <>
      <PageHeader id="superadmin-policies" variant="clean" title="Policies" subtitle="Edit Privacy Policy, Terms &amp; Conditions, and About content" />
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? (
        <SkeletonTable rows={3} />
      ) : (
        <Card className="encoder-card admin-card">
          <Card.Body>
            <table className="table mb-0 encoder-table admin-table muni-admin-table">
              <thead>
                <tr>
                  <th className="muni-col-secondary">Policy</th>
                  <th className="text-muted small">Last updated</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {POLICIES.map((p) => {
                  const data = contents[p.key];
                  const lastUpdated = data?.last_updated ? `Last updated: ${data.last_updated}` : 'Not yet saved';
                  const versionLine = data?.version ? `v${data.version}${data.effective_date ? ` · effective ${data.effective_date}` : ''}` : '';
                  return (
                    <tr key={p.key}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          {p.icon}
                          <span className="fw-bold">{p.label}</span>
                        </div>
                        <div className="text-muted small">{p.desc}</div>
                        <div className="text-muted small mt-1">{lastUpdated}{versionLine ? ` | ${versionLine}` : ''}</div>
                      </td>
                      <td className="muni-col-secondary text-nowrap small">{versionLine || '—'}</td>
                      <td className="text-nowrap">
                        <div className="muni-row-actions" role="group" aria-label={`Actions for ${p.label}`}>
                          <button type="button" className="muni-action-btn muni-action-btn--edit" onClick={() => { setPreviewKey(p.key); setEditKey(null); }} disabled={loading} title={`Preview ${p.label}`} aria-label={`Preview ${p.label}`}>
                            <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
                          </button>
                          <button type="button" className="muni-action-btn muni-action-btn--edit" onClick={() => { setEditKey(p.key); setPreviewKey(null); }} disabled={loading} title={`Edit ${p.label}`} aria-label={`Edit ${p.label}`}>
                            <Edit3 size={12} strokeWidth={2} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card.Body>
        </Card>
      )}

      {/* Edit modal */}
      {editKey && (
        <ContentEditor
          contentKey={editKey}
          defaultContent={CONTENT_DEFAULTS[editKey]}
          open={editKey !== null}
          onClose={() => setEditKey(null)}
        />
      )}

      {/* Preview modal */}
      {previewKey && (
        <Modal show={previewKey !== null} onHide={() => setPreviewKey(null)} centered size="lg" dialogClassName="muni-modal">
          <Modal.Header closeButton closeLabel="Close preview" className="muni-modal__header"><Modal.Title className="muni-modal__title">{POLICIES.find((p) => p.key === previewKey)?.label}</Modal.Title></Modal.Header>
          <Modal.Body>{renderPreview(previewKey)}</Modal.Body>
          <Modal.Footer className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-primary" onClick={() => setPreviewKey(null)}>Close</button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}
