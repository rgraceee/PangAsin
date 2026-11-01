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
} from '../../services/dataService';
import { useToast } from '../Toast';
import {
  Plus,
  Trash2,
  RotateCw,
  Save,
  Edit3,
  FileText,
  Users,
} from 'lucide-react';

const LABELS = {
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
  about: 'About',
  faq_admin: 'Admin FAQ',
  faq_encoder: 'Encoder FAQ',
  faq_public: 'Public FAQ',
};

const ICONS = {
  privacy: <FileText size={16} strokeWidth={2} />,
  terms: <FileText size={16} strokeWidth={2} />,
  about: <Users size={16} strokeWidth={2} />,
  faq_admin: <Edit3 size={16} strokeWidth={2} />,
  faq_encoder: <Edit3 size={16} strokeWidth={2} />,
  faq_public: <Edit3 size={16} strokeWidth={2} />,
};

export default function ContentEditor({ key, defaultContent, open, onClose }) {
  const { toastSuccess, toastError } = useToast();
  const [content, setContent] = useState(defaultContent);
  const [initialContent, setInitialContent] = useState(JSON.stringify(defaultContent));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const type = content.sections ? 'sections' : content.items ? 'faq' : 'about';

  const loadContent = useCallback(() => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    getSuperAdminContent(key)
      .then((data) => {
        const merged = { ...defaultContent, ...data };
        setContent(merged);
        setInitialContent(JSON.stringify(merged));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Could not load content.');
        setLoading(false);
      });
  }, [key, defaultContent]);

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
      await putSuperAdminContent(key, content);
      setInitialContent(JSON.stringify(content));
      setSuccess(true);
      toastSuccess(`${LABELS[key]} updated.`, 'Content saved');
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

  const handleReset = () => {
    if (!window.confirm(`Reset ${LABELS[key]} to its default content? This is audited.`)) return;
    setContent(JSON.parse(JSON.stringify(defaultContent)));
    setError(null);
    setSuccess(false);
  };

  const close = () => onClose();

  return (
    <Modal show={open} onHide={close} centered dialogClassName="content-modal" aria-labelledby="content-editor-title">
      <Modal.Header closeButton closeLabel="Close editor" className="content-modal__header">
        <Modal.Title id="content-editor-title" className="content-modal__title">
          {ICONS[key]} Edit {LABELS[key]}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSave} className="content-modal__form">
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-3">Loading content…</div>}
          {!loading && (
            <>
              <p className="text-muted small mb-3">
                Changes are saved to the database and audited. Reset restores the bundled default.
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
      <Form.Group className="mb-3">
        <Form.Label>Title <span className="text-danger">*</span></Form.Label>
        <Form.Control value={content.title || ''} onChange={(e) => setField('title', e.target.value)} required />
        <Form.Text className="text-muted">Required.</Form.Text>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Last updated</Form.Label>
        <Form.Control value={content.last_updated || ''} onChange={(e) => setField('last_updated', e.target.value)} />
        <Form.Text className="text-muted">Shown at the end of the document.</Form.Text>
      </Form.Group>
      <h5 className="content-editor-sub mb-2">Sections</h5>
      {sections.map((section, si) => (
        <Card key={si} className="content-section-card mb-3 p-3">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <Form.Control value={section.title || ''} onChange={(e) => setField(`sections.${si}.title`, e.target.value)} className="content-section-title-input" />
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => spliceAt('sections', si)}>
              <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <div className="mb-2">
            <span className="content-sub-label">Paragraphs</span>
            {(section.paragraphs || []).map((p, pi) => (
              <div key={pi} className="content-field-row">
                <Form.Control value={p} onChange={(e) => setField(`sections.${si}.paragraphs.${pi}`, e.target.value)} />
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => spliceAt(`sections.${si}.paragraphs`, pi)}>
                  <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-outline-secondary mt-1" onClick={() => pushAt(`sections.${si}.paragraphs`, '')}>
              <Plus size={14} strokeWidth={2} aria-hidden="true" /> Add paragraph
            </button>
          </div>
          <div className="mb-2">
            <span className="content-sub-label">Bullets</span>
            {(section.bullets || []).map((b, bi) => (
              <div key={bi} className="content-field-row">
                <Form.Control value={b} onChange={(e) => setField(`sections.${si}.bullets.${bi}`, e.target.value)} />
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => spliceAt(`sections.${si}.bullets`, bi)}>
                  <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-outline-secondary mt-1" onClick={() => pushAt(`sections.${si}.bullets`, '')}>
              <Plus size={14} strokeWidth={2} aria-hidden="true" /> Add bullet
            </button>
          </div>
        </Card>
      ))}
      <button type="button" className="btn btn-sm btn-outline-secondary mt-3" onClick={() => pushAt('sections', { title: '', paragraphs: [], bullets: [] })}>
        <Plus size={14} strokeWidth={2} aria-hidden="true" /> Add section
      </button>
    </div>
  );
}

/* ---------- FAQ editor ---------- */

function FaqEditor({ content, setField, spliceAt, pushAt }) {
  const categories = content.items || [];
  return (
    <div className="content-faq-editor">
      <h5 className="content-editor-sub mb-2">Categories &amp; questions</h5>
      {categories.map((cat, ci) => (
        <Card key={ci} className="content-section-card mb-3 p-3">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <Form.Control value={cat.category || ''} onChange={(e) => setField(`items.${ci}.category`, e.target.value)} className="content-section-title-input" />
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => spliceAt('items', ci)}>
              <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          {(cat.items || []).map((item, ii) => (
            <div key={ii} className="content-faq-item mb-2 p-2 border rounded">
              <div className="d-flex justify-content-between mb-1">
                <Form.Control value={item.q || ''} onChange={(e) => setField(`items.${ci}.items.${ii}.q`, e.target.value)} placeholder="Question" />
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => spliceAt(`items.${ci}.items`, ii)}>
                  <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
              <Form.Control as="textarea" rows={2} value={item.a || ''} onChange={(e) => setField(`items.${ci}.items.${ii}.a`, e.target.value)} placeholder="Answer" />
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-outline-secondary mt-1" onClick={() => pushAt(`items.${ci}.items`, { q: '', a: '' })}>
            <Plus size={14} strokeWidth={2} aria-hidden="true" /> Add question
          </button>
        </Card>
      ))}
      <button type="button" className="btn btn-sm btn-outline-secondary mt-3" onClick={() => pushAt('items', { category: 'New category', items: [] })}>
        <Plus size={14} strokeWidth={2} aria-hidden="true" /> Add category
      </button>
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
      {fields.map((f) => (
        <Form.Group key={f.key} className="mb-3">
          <Form.Label>{f.label} {f.required && <span className="text-danger">*</span>}</Form.Label>
          <Form.Control value={content[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} required={f.required} />
        </Form.Group>
      ))}
    </div>
  );
}
