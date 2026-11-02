import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Form } from 'react-bootstrap';
import {
  getHelpFaqs,
  createHelpFaq,
  updateHelpFaq,
  deleteHelpFaq,
  reorderHelpFaqs,
  getSuperAdminSettings,
  putSuperAdminSetting,
} from '../../services/dataService';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import { Edit3, BookOpen, Mail, Trash2 } from 'lucide-react';
import { confirmAction } from '../../services/feedback';

const CATEGORIES = ['General', 'About PangAsin', 'Understanding the dashboard', 'Accounts', 'Feedback'];

function sortFaqs(faqs) {
  return [...faqs].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.sort_order - b.sort_order || a.id - b.id);
}

export default function SuperAdminHelp() {
  const { toastSuccess, toastError } = useToast();
  const [faqs, setFaqs] = useState([]);
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ question: '', answer: '', category: 'General', sort_order: 0, active: true });
  const [deleting, setDeleting] = useState(null);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getHelpFaqs().then((r) => setFaqs(Array.isArray(r.faqs) ? r.faqs : [])).catch(() => setFaqs([])),
      getSuperAdminSettings().then((s) => {
        const map = {};
        Object.entries(s || {}).forEach(([k, v]) => { map[k] = v.value; });
        setContactEmail(map.help_contact_email || '');
      }).catch(() => setContactEmail('')),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveContact = async () => {
    try {
      await putSuperAdminSetting('help_contact_email', contactEmail.trim());
      toastSuccess('Contact email saved.', 'Contact info');
    } catch (err) { toastError(err.message || 'Failed to save contact email.'); }
  };

  const startEdit = (f) => setEditing({ id: f.id, question: f.question, answer: f.answer, category: f.category, active: f.active });
  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.question.trim() || !editing.answer.trim()) { toastError('Question and answer are required.'); return; }
    setLoading(true);
    try {
      await updateHelpFaq(editing.id, { question: editing.question, answer: editing.answer, category: editing.category, active: editing.active });
      setEditing(null);
      toastSuccess('FAQ updated.', 'FAQ saved');
      load();
    } catch (err) { toastError(err.message || 'Update failed.'); }
    finally { setLoading(false); }
  };

  const createFaq = async () => {
    if (!form.question.trim() || !form.answer.trim()) { toastError('Question and answer are required.'); return; }
    setLoading(true);
    try {
      await createHelpFaq({ question: form.question.trim(), answer: form.answer.trim(), category: form.category, sort_order: form.sort_order, active: form.active });
      setForm({ question: '', answer: '', category: 'General', sort_order: 0, active: true });
      toastSuccess('FAQ created.', 'FAQ saved');
      load();
    } catch (err) { toastError(err.message || 'Create failed.'); }
    finally { setLoading(false); }
  };

  const confirmDelete = async (id) => {
    const ok = await confirmAction({ title: 'Delete FAQ?', text: 'This cannot be undone.', confirmText: 'Delete', danger: true });
    if (!ok) return;
    setDeleting(id);
    try {
      await deleteHelpFaq(id);
      toastSuccess('FAQ deleted.', 'FAQ deleted');
      load();
    } catch (err) { toastError(err.message || 'Delete failed.'); }
    finally { setDeleting(null); }
  };

  const handleReorder = async () => {
    const items = sortFaqs(faqs).map((f, i) => ({ id: f.id, sort_order: i }));
    setReordering(true);
    try {
      await reorderHelpFaqs(items);
      toastSuccess('Order saved.', 'Reordered');
    } catch (err) { toastError(err.message || 'Reorder failed.'); }
    finally { setReordering(false); }
  };

  const grouped = {};
  sortFaqs(faqs).forEach((f) => { (grouped[f.category || 'General'] = grouped[f.category || 'General'] || []).push(f); });

  if (loading) {
    return (
      <>
        <PageHeader id="superadmin-help" variant="clean" title="Help Center" subtitle="Create, edit, reorder, and delete FAQ items. Contact email is shown on the public Help Center." />
        <div className="text-center py-4"><p className="text-muted small">Loading Help Center…</p></div>
      </>
    );
  }

  return (
    <>
      <PageHeader id="superadmin-help" variant="clean" title="Help Center" subtitle="Create, edit, reorder, and delete FAQ items. Contact email is shown on the public Help Center." />
      {error && <Alert variant="danger">{error}</Alert>}
      <Card className="encoder-card admin-card mb-3">
        <Card.Body>
          <Form onSubmit={(e) => { e.preventDefault(); handleSaveContact(); }} className="row g-3">
            <Form.Group className="col-md-4">
              <Form.Label>Contact email (public Help Center)</Form.Label>
              <Form.Control type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </Form.Group>
            <Form.Group className="col-md-4 d-flex align-items-end">
              <button type="submit" className="ui-btn-primary" disabled={loading}>Save contact</button>
            </Form.Group>
          </Form>
        </Card.Body>
      </Card>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <BookOpen size={14} strokeWidth={2} aria-hidden="true" />
                <h5 className="card-title mb-0">Frequently asked questions</h5>
              </div>
              <div className="text-muted small">Create, edit, reorder, and delete FAQ items.</div>
            </div>
            <button type="button" className="ui-btn-outline ui-btn--sm" onClick={() => setEditing(null) && setForm({ question: '', answer: '', category: 'General', sort_order: 0, active: true })}>
              <Edit3 size={14} strokeWidth={2} aria-hidden="true" /> Add FAQ
            </button>
          </div>

          {/* Create / edit form */}
          <Card className="faq-form-card mb-3">
            <Card.Body>
              <Form onSubmit={(e) => { e.preventDefault(); editing ? saveEdit() : createFaq(); }}>
                <div className="row g-3">
                  <Form.Group className="col-md-4">
                    <Form.Label>Question</Form.Label>
                    <Form.Control required value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
                  </Form.Group>
                  <Form.Group className="col-md-4">
                    <Form.Label>Answer</Form.Label>
                    <Form.Control as="textarea" rows={3} required value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
                  </Form.Group>
                  <Form.Group className="col-md-3">
                    <Form.Label>Category</Form.Label>
                    <Form.Select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="col-md-1 d-flex align-items-end">
                    <button type="submit" className="ui-btn-primary" disabled={loading}>{editing ? 'Save changes' : 'Create FAQ'}</button>
                  </Form.Group>
                </div>
                {!editing && (
                  <div className="row g-3 mt-2">
                    <Form.Group className="col-md-2">
                      <Form.Label>Sort order</Form.Label>
                      <Form.Control type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} />
                    </Form.Group>
                    <Form.Group className="col-md-2 d-flex align-items-end">
                      <Form.Check type="checkbox" label="Active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                    </Form.Group>
                    <Form.Group className="col-md-2 d-flex align-items-end">
                      <button type="button" className="ui-btn-outline ui-btn--sm" onClick={() => setForm({ question: '', answer: '', category: 'General', sort_order: 0, active: true })}>Cancel</button>
                    </Form.Group>
                  </div>
                )}
                {editing && (
                  <div className="row g-3 mt-2">
                    <Form.Group className="col-md-3">
                      <Form.Label>Active</Form.Label>
                      <Form.Check type="checkbox" label="Show on public Help Center" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                    </Form.Group>
                    <Form.Group className="col-md-2 d-flex align-items-end">
                      <button type="button" className="ui-btn-outline ui-btn--sm" onClick={() => setEditing(null)}>Cancel</button>
                    </Form.Group>
                  </div>
                )}
              </Form>
            </Card.Body>
          </Card>

          {/* FAQ list grouped by category */}
          <Card className="mt-3">
            <Card.Body>
              <table className="table mb-0 encoder-table admin-table muni-admin-table">
                <tbody>
                  {Object.entries(grouped).map(([category, items]) => (
                    <React.Fragment key={category}>
                      <tr>
                        <td colSpan="2" className="faq-category-header" style={{ paddingTop: 16, paddingBottom: 8 }}>
                          <span className="muni-status-badge muni-status-badge--status-secondary small">{category}</span>{' '}
                          <span className="text-muted small">{items.length} question{items.length !== 1 ? 's' : ''}</span>
                        </td>
                      </tr>
                      {items.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <div className="faq-body">
                              <div className="d-flex align-items-start gap-2 mb-1">
                                <span className={`muni-status-badge ${f.active ? 'muni-status-badge--status-success' : 'muni-status-badge--status-secondary'} small`}>{f.active ? 'Active' : 'Inactive'}</span>
                                <span className="faq-sort text-muted small">{f.sort_order}</span>
                              </div>
                              <div className="faq-question">{f.question}</div>
                              <div className="faq-answer text-muted small">{f.answer}</div>
                            </div>
                          </td>
                          <td className="text-nowrap">
                            <div className="muni-row-actions" role="group" aria-label={`Actions for FAQ ${f.id}`}>
                              {editing && editing.id === f.id ? (
                                <>
                                  <button type="button" className="muni-action-btn muni-action-btn--activate" onClick={saveEdit} disabled={loading} title="Save" aria-label="Save">
                                    <Edit3 size={13} strokeWidth={2} aria-hidden="true" />
                                  </button>
                                  <button type="button" className="muni-action-btn" onClick={() => setEditing(null)} title="Cancel" aria-label="Cancel">
                                    <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" className="muni-action-btn muni-action-btn--edit" onClick={() => startEdit(f)} title={`Edit ${f.question}`} aria-label={`Edit ${f.question}`}>
                                    <Edit3 size={13} strokeWidth={2} aria-hidden="true" />
                                  </button>
                                  <button type="button" className="muni-action-btn muni-action-btn--delete" onClick={() => confirmDelete(f.id)} disabled={deleting === f.id} title={`Delete ${f.question}`} aria-label={`Delete ${f.question}`}>
                                    <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {faqs.length === 0 && (
                    <tr><td colSpan="2" className="text-center text-muted py-4">No FAQ items yet. Create one above.</td></tr>
                  )}
                </tbody>
              </table>
              {faqs.length > 0 && (
                <div className="mt-3 d-flex justify-content-end">
                  <button type="button" className="ui-btn-outline ui-btn--sm" onClick={handleReorder} disabled={reordering}>
                    Save order
                  </button>
                </div>
              )}
            </Card.Body>
          </Card>
        </Card.Body>
      </Card>
    </>
  );
}
