// WHAT: SuperAdmin content editor for Privacy Policy, Terms, About, and FAQs.
//       Loads content from /api/content/<key>, edits structured fields, saves
//       via PUT /api/content/<key>. Reset restores bundled defaults.
// WHY: One reusable editor for all editable content keys, matching the
//      structured defaults already defined in app/services/content_service.py.
import React, { useCallback, useEffect, useState } from 'react';
import { Card, Form, Modal, Alert } from 'react-bootstrap';
import {
  getSuperAdminContent,
  putSuperAdminContent,
  resetSuperAdminContent,
} from '../../services/dataService';
import { useToast } from '../Toast';
import CONTENT_DEFAULTS from './contentDefaults';
import {
  Plus,
  Trash2,
  RotateCw,
  Save,
  Edit3,
  FileText,
  Users,
  Clock,
} from 'lucide-react';

const SUPPORTED_KEYS = ['privacy', 'terms', 'about', 'faq_admin', 'faq_encoder', 'faq_public'];

const LABELS = {
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
  about: 'About',
  faq_admin: 'Admin FAQ',
  faq_encoder: 'Encoder FAQ',
  faq_public: 'Public FAQ',
};

const ICONS = {
  privacy: FileText,
  terms: FileText,
  about: Users,
  faq_admin: Edit3,
  faq_encoder: Edit3,
  faq_public: Edit3,
};

export default function ContentEditor({ contentKey, defaultContent, open, onClose }) {
  const { toastSuccess, toastError } = useToast();
  const resolvedDefault = defaultContent || CONTENT_DEFAULTS[contentKey] || {};
  const [content, setContent] = useState(resolvedDefault);
  const [initialContent, setInitialContent] = useState(JSON.stringify(resolvedDefault));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const type = content.sections ? 'sections' : content.items ? 'faq' : 'about';

  const loadContent = useCallback(() => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    // If the key is not supported, do not attempt a server round-trip; use the
    // bundled default so the editor never crashes on an unknown content key.
    if (!contentKey || !SUPPORTED_KEYS.includes(contentKey)) {
      setContent(resolvedDefault);
      setInitialContent(JSON.stringify(resolvedDefault));
      setLoading(false);
      setError(`The document key "${contentKey || '(none)'}" is not a supported content type.`);
      return;
    }
    getSuperAdminContent(contentKey)
      .then((data) => {
        const merged = { ...resolvedDefault, ...data };
        setContent(merged);
        setInitialContent(JSON.stringify(merged));
        setLoading(false);
      })
      .catch((err) => {
        // Degrade gracefully to the bundled default so editing is never blocked
        // by a fetch failure or an unsupported content key.
        setContent(resolvedDefault);
        setInitialContent(JSON.stringify(resolvedDefault));
        setLoading(false);
        setError(err.message || 'Could not load content.');
      });
  }, [contentKey, resolvedDefault]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const isDirty = () => JSON.stringify(content) !== initialContent;

  const setField = useCallback((path, value) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let cursor = next;
      const parts = path.split('.');
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        cursor = p.match(/^\d+$/) ? cursor[parseInt(p, 10)] : cursor[p];
      }
      const last = parts[parts.length - 1];
      if (last.match(/^\d+$/)) next[parseInt(last, 10)] = value;
      else cursor[last] = value;
      return next;
    });
  }, []);

  const spliceAt = useCallback((path, index) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let cursor = next;
      const parts = path.split('.');
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        cursor = p.match(/^\d+$/) ? cursor[parseInt(p, 10)] : cursor[p];
      }
      const last = parts[parts.length - 1];
      cursor[last].splice(index, 1);
      return next;
    });
  }, []);

  const pushAt = useCallback((path, value) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let cursor = next;
      const parts = path.split('.');
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        cursor = p.match(/^\d+$/) ? cursor[parseInt(p, 10)] : cursor[p];
      }
      const last = parts[parts.length - 1];
      cursor[last] = cursor[last] || [];
      cursor[last].push(value);
      return next;
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (contentKey === 'privacy' || contentKey === 'terms') {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = now.toLocaleString('default', { month: 'long' });
        const year = now.getFullYear();
        setField('last_updated', `${day} ${month} ${year}`);
      }
      await putSuperAdminContent(contentKey, content);
      setInitialContent(JSON.stringify(content));
      setSuccess(true);
      toastSuccess(`${LABELS[contentKey]} updated.`, 'Content saved');
    } catch (err) {
      const message =
        err.data?.error ||
        (err.data?.errors ? err.data.errors.join(', ') : '') ||
        err.message ||
        'Save failed.';
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Reset ${LABELS[contentKey]} to its default content? This is audited.`)) return;
    setSaving(true);
    setError(null);
    try {
      await resetSuperAdminContent(contentKey);
      setSuccess(true);
      toastSuccess(`${LABELS[contentKey]} reset to default.`, 'Content reset');
      loadContent();
    } catch (err) {
      const message =
        err.data?.error ||
        (err.data?.errors ? err.data.errors.join(', ') : '') ||
        err.message ||
        'Reset failed.';
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const close = () => onClose();

  // Unsupported key: show a graceful state instead of crashing with "Unknown content key."
  if (!contentKey || !SUPPORTED_KEYS.includes(contentKey)) {
    return (
      <Modal show={open} onHide={close} centered dialogClassName="content-modal" aria-labelledby="content-editor-title">
        <Modal.Header closeButton closeLabel="Close editor" className="content-modal__header">
          <Modal.Title id="content-editor-title" className="content-modal__title">Document editor</Modal.Title>
        </Modal.Header>
        <Modal.Body className="content-modal__body">
          <Alert variant="warning">
            The document key <strong>{contentKey || '(none)'}</strong> is not a supported content type and cannot be edited here.
          </Alert>
        </Modal.Body>
        <Modal.Footer className="content-modal__footer-actions">
          <button type="button" className="btn btn-outline-secondary" onClick={close} disabled={saving}>
            Close
          </button>
        </Modal.Footer>
      </Modal>
    );
  }

  const DocumentIcon = ICONS[contentKey] || FileText;

  return (
    <Modal show={open} onHide={close} centered dialogClassName="content-modal" aria-labelledby="content-editor-title">
      <Modal.Header closeButton closeLabel="Close editor" className="content-modal__header">
        <div className="content-modal__head">
          <div className="content-modal__icon"><DocumentIcon size={16} strokeWidth={2} aria-hidden="true" /></div>
          <div className="content-modal__title-wrap">
            <Modal.Title id="content-editor-title" className="content-modal__title">
              Edit {LABELS[contentKey]}
            </Modal.Title>
          </div>
        </div>
      </Modal.Header>
      <Form onSubmit={handleSave} className="content-modal__form">
        <Modal.Body className="content-modal__body">
          {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
          {loading && <div className="text-center py-4">Loading content…</div>}
          {!loading && (
            <>
              <p className="content-modal__intro">
                Changes are saved to the database and audited. <strong>Reset</strong> restores the bundled default wording.
              </p>
              {type === 'sections' && (
                <SectionsEditor content={content} setField={setField} spliceAt={spliceAt} pushAt={pushAt} />
              )}
              {type === 'faq' && <FaqEditor content={content} setField={setField} spliceAt={spliceAt} pushAt={pushAt} />}
              {type === 'about' && <AboutEditor content={content} setField={setField} />}
              {success && <Alert variant="success" className="mt-3">Content saved successfully.</Alert>}
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="content-modal__footer-actions">
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={handleReset}
            disabled={saving || !isDirty()}
          >
            <RotateCw size={14} strokeWidth={2} aria-hidden="true" />{' '}
            Reset to default
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !isDirty()}>
            <Save size={14} strokeWidth={2} aria-hidden="true" />{' '}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/* ---------- Sections editor (privacy / terms) ---------- */

function SectionsEditor({ content, setField, spliceAt, pushAt }) {
  const sections = content.sections || [];
  return (
    <div className="content-sections-editor">
      <Card className="content-doc-card">
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>Document title <span className="text-danger">*</span></Form.Label>
            <Form.Control value={content.title || ''} onChange={(e) => setField('title', e.target.value)} required />
            <Form.Text className="text-muted">Required. Shown at the top of the published document.</Form.Text>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Last updated</Form.Label>
            <Form.Control value={content.last_updated || ''} readOnly />
            <Form.Text className="text-muted">Set automatically on save.</Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>

      <div className="content-section-group">
        <div className="d-flex justify-content-between align-items-baseline mb-3">
          <h5 className="content-editor-sub mb-0">Sections</h5>
          <button type="button" className="content-add-btn" onClick={() => pushAt('sections', { title: '', paragraphs: [], bullets: [] })}>
            <Plus size={14} strokeWidth={2} aria-hidden="true" /> Add section
          </button>
        </div>
        {sections.map((section, si) => (
          <Card key={si} className="content-section-card">
            <Card.Body>
              <div className="content-section-header">
                <Form.Control value={section.title || ''} onChange={(e) => setField(`sections.${si}.title`, e.target.value)} className="content-section-title-input" />
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => spliceAt('sections', si)} title={`Delete section "${section.title || 'Untitled'}"`} aria-label={`Delete section ${si + 1}`}>
                  <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>

              <div className="content-block mb-3">
                <label className="content-block-label">Paragraphs</label>
                <div className="content-field-list">
                  {(section.paragraphs || []).map((p, pi) => (
                    <div key={pi} className="content-field-row">
                      <Form.Control as="textarea" rows={2} value={p} onChange={(e) => setField(`sections.${si}.paragraphs.${pi}`, e.target.value)} placeholder="Enter paragraph…" />
                      <button type="button" className="btn btn-outline-danger btn-sm content-del-btn" onClick={() => spliceAt(`sections.${si}.paragraphs`, pi)} title="Delete paragraph" aria-label={`Delete paragraph ${pi + 1}`}>
                        <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="content-add-row-btn" onClick={() => pushAt(`sections.${si}.paragraphs`, '')}>
                    <Plus size={13} strokeWidth={2} aria-hidden="true" /> Add paragraph
                  </button>
                </div>
              </div>

              <div className="content-block">
                <label className="content-block-label">Bulleted items</label>
                <div className="content-field-list">
                  {(section.bullets || []).map((b, bi) => (
                    <div key={bi} className="content-field-row">
                      <Form.Control value={b} onChange={(e) => setField(`sections.${si}.bullets.${bi}`, e.target.value)} placeholder="Bullet item…" />
                      <button type="button" className="btn btn-outline-danger btn-sm content-del-btn" onClick={() => spliceAt(`sections.${si}.bullets`, bi)} title="Delete bullet" aria-label={`Delete bullet ${bi + 1}`}>
                        <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="content-add-row-btn" onClick={() => pushAt(`sections.${si}.bullets`, '')}>
                    <Plus size={13} strokeWidth={2} aria-hidden="true" /> Add bullet
                  </button>
                </div>
              </div>
            </Card.Body>
          </Card>
        ))}
        {sections.length === 0 && (
          <div className="content-empty">
            <Clock size={20} strokeWidth={2} className="text-muted mb-2" aria-hidden="true" />
            <p className="text-muted small">No sections yet. Add a section to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- FAQ editor ---------- */

function FaqEditor({ content, setField, spliceAt, pushAt }) {
  const categories = content.items || [];
  return (
    <div className="content-faq-editor">
      <div className="d-flex justify-content-between align-items-baseline mb-3">
        <h5 className="content-editor-sub mb-0">Categories &amp; questions</h5>
        <button type="button" className="content-add-btn" onClick={() => pushAt('items', { category: 'New category', items: [] })}>
          <Plus size={14} strokeWidth={2} aria-hidden="true" /> Add category
        </button>
      </div>
      {categories.map((cat, ci) => (
        <Card key={ci} className="content-section-card">
          <Card.Body>
            <div className="content-section-header">
              <Form.Control value={cat.category || ''} onChange={(e) => setField(`items.${ci}.category`, e.target.value)} className="content-section-title-input" placeholder="Category name" />
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => spliceAt('items', ci)} title={`Delete category "${cat.category || 'Untitled'}"`} aria-label={`Delete category ${ci + 1}`}>
                <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="content-block mb-3">
              <label className="content-block-label">Questions &amp; answers</label>
              <div className="content-field-list">
                {(cat.items || []).map((item, ii) => (
                  <div key={ii} className="content-faq-item">
                    <div className="content-field-row">
                      <Form.Control value={item.q || ''} onChange={(e) => setField(`items.${ci}.items.${ii}.q`, e.target.value)} placeholder="Question" />
                      <button type="button" className="btn btn-outline-danger btn-sm content-del-btn" onClick={() => spliceAt(`items.${ci}.items`, ii)} title="Delete question" aria-label={`Delete question ${ii + 1}`}>
                        <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>
                    <Form.Control as="textarea" rows={2} value={item.a || ''} onChange={(e) => setField(`items.${ci}.items.${ii}.a`, e.target.value)} placeholder="Answer" />
                  </div>
                ))}
                <button type="button" className="content-add-row-btn" onClick={() => pushAt(`items.${ci}.items`, { q: '', a: '' })}>
                  <Plus size={13} strokeWidth={2} aria-hidden="true" /> Add question
                </button>
              </div>
            </div>
          </Card.Body>
        </Card>
      ))}
      {categories.length === 0 && (
        <div className="content-empty">
          <FileText size={20} strokeWidth={2} className="text-muted mb-2" aria-hidden="true" />
          <p className="text-muted small">No categories yet. Add a category to begin.</p>
        </div>
      )}
    </div>
  );
}

/* ---------- About editor ---------- */

function AboutEditor({ content, setField }) {
  const fields = [
    { key: 'name', label: 'App name', required: true },
    { key: 'version', label: 'Version', required: false },
    { key: 'partners', label: 'Data partners', required: false },
    { key: 'credit', label: 'Credit', required: false },
    { key: 'note', label: 'Note', required: false },
  ];
  return (
    <div className="content-about-editor">
      <div className="content-doc-intro">
        <FileText size={20} strokeWidth={2} className="text-muted mb-2" aria-hidden="true" />
      </div>
      {fields.map((f) => (
        <Form.Group key={f.key} className="mb-3">
          <Form.Label>{f.label} {f.required && <span className="text-danger">*</span>}</Form.Label>
          <Form.Control value={content[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} required={f.required} />
          <Form.Text className="text-muted">{f.key === 'note' ? 'Short note displayed under the app credit.' : ''}</Form.Text>
        </Form.Group>
      ))}
    </div>
  );
}
