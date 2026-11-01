import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Table, Modal, Form, Badge } from 'react-bootstrap';
import {
  getSuperAdminUsers, createSuperAdminUser, deactivateUser, reactivateUser,
  resetSuperAdminPassword, forceLogoutUser, unlockUser, changeUserMunicipality,
  getAdminMunicipalities,
} from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import IconButton from '../IconButton';
import PageHeader from './PageHeader';
import TablePagination from '../ui/TablePagination';
import { Plus, ShieldAlert, Lock, LogOut, Key, UserPlus, RefreshCw } from 'lucide-react';

const PER_PAGE = 25;
const REASON_MIN = 10;

const ROLE_CHIPS = { admin: 'primary', encoder: 'success', superadmin: 'secondary' };
const STATUS_CHIPS = { active: 'success', inactive: 'secondary', locked: 'danger' };

function chip(label, variant) {
  return <Badge pill className={`bg-${variant}`}>{label}</Badge>;
}

export default function SuperAdminUsers() {
  const { toastSuccess } = useToast();
  const [users, setUsers] = useState([]);
  const [munis, setMunis] = useState([]);
  const [filters, setFilters] = useState({ role: '', status: '', municipality_id: '', q: '' });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const [openCreate, setOpenCreate] = useState(false);
  const [openAction, setOpenAction] = useState(null);
  const [actionForm, setActionForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);
  const [openTemp, setOpenTemp] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, per_page: perPage, ...filters };
    getSuperAdminUsers(params)
      .then((r) => {
        const list = r.users || [];
        setUsers(list);
        setPage(Math.min(page, Math.ceil((r.total || 0) / perPage) || 1));
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load users.'); setLoading(false); });
  }, [page, perPage, filters]);

  useEffect(() => {
    getAdminMunicipalities().then((res) => setMunis(res.municipalities || [])).catch(() => {});
    load();
  }, [load]);

  const handleFilter = (e) => {
    setPage(1);
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const openCreateForm = () => {
    setActionForm({ name: '', email: '', role: 'encoder', municipality_id: '', password: '' });
    setOpenCreate(true);
    setError(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    const { name, email, role, municipality_id } = actionForm;
    if (!name || !email || !role) { setError('Name, email and role are required.'); return; }
    if (role === 'encoder' && !municipality_id) { setError('Municipality is required for encoders.'); return; }
    setSubmitting(true);
    try {
      await createSuperAdminUser({ name, email, role, municipality_id: municipality_id || null });
      setOpenCreate(false);
      toastSuccess('Account created. Share the temporary password once.', 'User created');
      load();
    } catch (err) {
      setError(err.data?.errors ? err.data.errors.join(', ') : (err.message || 'Could not create account.'));
    } finally { setSubmitting(false); }
  };

  const openReasonAction = (title, kind, user) => {
    setActionForm({ kind, targetUser: user, reason: '', confirmText: '' });
    setOpenAction(true);
    setError(null);
    document.getElementById('sa-reason').focus();
  };

  const runAction = async () => {
    const { kind, targetUser, reason } = actionForm;
    if (!reason || reason.length < REASON_MIN) { setError(`Reason must be at least ${REASON_MIN} characters.`); return; }
    setSubmitting(true);
    try {
      let resetResult = null;
      if (kind === 'deactivate') await deactivateUser(targetUser.id);
      else if (kind === 'reactivate') await reactivateUser(targetUser.id);
      else if (kind === 'reset') resetResult = await resetSuperAdminPassword(targetUser.id);
      else if (kind === 'unlock') await unlockUser(targetUser.id);
      else if (kind === 'force-logout') await forceLogoutUser(targetUser.id);
      else if (kind === 'municipality') await changeUserMunicipality(targetUser.id, actionForm.municipality_id || null);
      setOpenAction(false);
      if (resetResult && resetResult.temporary_password) {
        setTempPassword(resetResult.temporary_password);
        setOpenTemp(true);
      }
      toastSuccess(`${kind.replace('-', ' ')} done.`, 'Action complete');
      load();
    } catch (err) {
      setError(err.data?.errors ? err.data.errors.join(', ') : (err.message || 'Action failed.'));
    } finally { setSubmitting(false); }
  };

  const handleResetPassword = async (user) => {
    const confirmed = await confirmAction({
      title: `Reset password for ${user.name}?`,
      text: `A temporary password will be generated and shown once. ${user.name} must change it on next login.`,
      confirmText: 'Generate password',
      danger: true,
    });
    if (!confirmed) return;
    openReasonAction('Reset password', 'reset', user);
  };

  const copyPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toastSuccess('Temporary password copied to clipboard.', 'Copied');
    } catch {
      /* clipboard unavailable; user can copy manually */
    }
  };

  const hasFilter = Boolean(filters.role || filters.status || filters.municipality_id || filters.q);
  const total = users.length;
  const pageStart = (page - 1) * perPage;
  const paged = users.slice(pageStart, pageStart + perPage);

  return (
    <>
      <PageHeader
        id="superadmin-users"
        title="User Management"
        subtitle="Every account across the system. SuperAdmin only."
        art={<></>}
      >
        <div className="admin-page-hero-control">
          <button type="button" className="ui-btn-primary ui-btn--sm" onClick={openCreateForm}>
            <Plus size={15} strokeWidth={2} aria-hidden="true" /> Add account
          </button>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sa-role">Role</label>
          <select id="sa-role" className="form-select admin-page-hero-select" name="role" value={filters.role} onChange={handleFilter}>
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="encoder">Encoder</option>
            <option value="superadmin">SuperAdmin</option>
          </select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sa-status">Status</label>
          <select id="sa-status" className="form-select admin-page-hero-select" name="status" value={filters.status} onChange={handleFilter}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="locked">Locked</option>
          </select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sa-muni">Municipality</label>
          <select id="sa-muni" className="form-select admin-page-hero-select" name="municipality_id" value={filters.municipality_id} onChange={handleFilter}>
            <option value="">All municipalities</option>
            {munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">{total} account{total === 1 ? '' : 's'}</span>
            {hasFilter && <Button variant="link" className="p-0 text-muted small" onClick={() => { setPage(1); setFilters({ role: '', status: '', municipality_id: '', q: '' }); }}>Clear filters</Button>}
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-2"><SkeletonList rows={6} cols={6} /></div>}
          {!loading && total === 0 && <Alert variant="info">No accounts match the current filters.</Alert>}
          {!loading && total > 0 && (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Role</th><th>Municipality</th>
                  <th>Status</th><th>Last login</th><th>Failed logins</th><th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td><td>{u.email}</td>
                    <td>{chip(u.role, ROLE_CHIPS[u.role] || 'secondary')}</td>
                    <td>{u.municipality_name || '—'}</td>
                    <td>{chip(u.status, STATUS_CHIPS[u.status] || 'secondary')}</td>
                    <td>{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                    <td>{u.failed_login_count ?? 0}</td>
                    <td className="text-nowrap">
                      <IconButton icon={<UserPlus size={14} strokeWidth={2} />} label={`View ${u.name}`} variant="outline-primary" onClick={() => {}} />
                      {u.role !== 'superadmin' && (
                        <>
                          {u.status === 'active' && (
                            <IconButton icon={<ShieldAlert size={14} strokeWidth={2} />} label={`Deactivate ${u.name}`} variant="outline-danger" onClick={() => openReasonAction('Deactivate account', 'deactivate', u)} />
                          )}
                          {u.status !== 'active' && (
                            <IconButton icon={<RefreshCw size={14} strokeWidth={2} />} label={`Reactivate ${u.name}`} variant="outline-success" onClick={() => openReasonAction('Reactivate account', 'reactivate', u)} />
                          )}
                          <IconButton icon={<Key size={14} strokeWidth={2} />} label={`Reset password ${u.name}`} variant="outline-primary" onClick={() => handleResetPassword(u)} />
                          {u.locked_until && <IconButton icon={<Lock size={14} strokeWidth={2} />} label={`Unlock ${u.name}`} variant="outline-warning" onClick={() => openReasonAction('Unlock account', 'unlock', u)} />}
                          <IconButton icon={<LogOut size={14} strokeWidth={2} />} label={`Force logout ${u.name}`} variant="outline-secondary" onClick={() => openReasonAction('Force logout', 'force-logout', u)} />
                          {u.role === 'encoder' && (
                            <IconButton icon={<ShieldAlert size={14} strokeWidth={2} />} label={`Change municipality ${u.name}`} variant="outline-secondary" onClick={() => { setActionForm({ kind: 'municipality', targetUser: u, reason: '', municipality_id: u.municipality_id || '' }); setOpenAction(true); }} />
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {!loading && total > 0 && (
            <TablePagination page={page} pages={Math.ceil(total / perPage) || 1} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} itemLabel="accounts" />
          )}
        </Card.Body>
      </Card>

      <Modal show={openCreate} onHide={() => setOpenCreate(false)} centered dialogClassName="muni-modal" aria-labelledby="sa-create-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header">
          <Modal.Title id="sa-create-title" className="muni-modal__title">Create account</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreate} className="muni-modal-form">
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3"><Form.Label>Name <span className="text-danger">*</span></Form.Label><Form.Control value={actionForm.name} onChange={(e) => setActionForm({ ...actionForm, name: e.target.value })} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Email <span className="text-danger">*</span></Form.Label><Form.Control type="email" value={actionForm.email} onChange={(e) => setActionForm({ ...actionForm, email: e.target.value })} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Role <span className="text-danger">*</span></Form.Label><Form.Select value={actionForm.role} onChange={(e) => setActionForm({ ...actionForm, role: e.target.value })} required><option value="admin">Admin</option><option value="encoder">Encoder</option></Form.Select></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Municipality {actionForm.role === 'encoder' && <span className="text-danger">*</span>}</Form.Label><Form.Select value={actionForm.municipality_id} onChange={(e) => setActionForm({ ...actionForm, municipality_id: e.target.value })}><option value="">Select municipality…</option>{munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Form.Select></Form.Group>
            <Form.Text className="text-muted">A temporary password is generated and shown once after creation.</Form.Text>
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-outline" onClick={() => setOpenCreate(false)}>Cancel</button>
            <button type="submit" className="ui-btn-primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create account'}</button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={openAction} onHide={() => setOpenAction(false)} centered dialogClassName="muni-modal" aria-labelledby="sa-action-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header">
          <Modal.Title id="sa-action-title" className="muni-modal__title">{actionForm.kind ? actionForm.kind.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Action'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={(e) => { e.preventDefault(); runAction(); }} className="muni-modal-form">
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <p className="text-muted">Reason is required and will be recorded in the audit log.</p>
            <Form.Group className="mb-3"><Form.Label>Reason <span className="text-danger">*</span></Form.Label><Form.Control as="textarea" id="sa-reason" rows={3} value={actionForm.reason} onChange={(e) => setActionForm({ ...actionForm, reason: e.target.value })} required /></Form.Group>
            {actionForm.kind === 'municipality' && (
              <Form.Group className="mb-3"><Form.Label>New municipality <span className="text-danger">*</span></Form.Label><Form.Select value={actionForm.municipality_id} onChange={(e) => setActionForm({ ...actionForm, municipality_id: e.target.value })} required><option value="">Select municipality…</option>{munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Form.Select></Form.Group>
            )}
            <Form.Text className="text-muted">Generated passwords are shown once and cannot be recovered.</Form.Text>
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-outline" onClick={() => setOpenAction(false)}>Cancel</button>
            <button type="submit" className="ui-btn-primary" disabled={submitting}>{submitting ? 'Processing…' : 'Confirm'}</button>
          </Modal.Footer>
        </Form>
      </Modal>
      {openTemp && tempPassword && (
        <Modal show onHide={() => setOpenTemp(false)} centered dialogClassName="muni-modal" aria-labelledby="sa-tmp-title">
          <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header"><Modal.Title id="sa-tmp-title" className="muni-modal__title">Temporary password</Modal.Title></Modal.Header>
          <Modal.Body className="muni-modal__body">
            <p>Share this temporary password with <strong>{actionForm.targetUser?.name}</strong> once. They must change it on next login.</p>
            <div className="input-group mb-3">
              <Form.Control readOnly value={tempPassword} />
              <button type="button" className="btn btn-outline-secondary" onClick={copyPassword}>Copy</button>
            </div>
            <Form.Text className="text-muted">This is the only time the password is shown.</Form.Text>
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-primary" onClick={() => setOpenTemp(false)}>OK, I saved it</button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}
