import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Table, Modal, Form } from 'react-bootstrap';
import {
  getSuperAdminUsers, createSuperAdminUser, deactivateUser, reactivateUser,
  resetSuperAdminPassword, forceLogoutUser, unlockUser, changeUserMunicipality,
  getAdminMunicipalities,
} from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import TablePagination from '../ui/TablePagination';
import { Plus, ShieldAlert, Lock, LogOut, Key, RefreshCw } from 'lucide-react';

const PER_PAGE = 25;
const REASON_MIN = 10;

const ROLE_CHIPS = { admin: 'primary', encoder: 'success', superadmin: 'secondary' };
const STATUS_CHIPS = { active: 'success', inactive: 'secondary', locked: 'danger' };

export default function SuperAdminUsers() {
  const { toastSuccess } = useToast();
  const [users, setUsers] = useState([]);
  const [munis, setMunis] = useState([]);
  const [filters, setFilters] = useState({ role: '', status: '', municipality_id: '' });
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

  const openReasonAction = (kind, user, municipality_id = '') => {
    setActionForm({ kind, targetUser: user, reason: '', municipality_id: municipality_id || '' });
    setOpenAction(true);
    setError(null);
    document.getElementById('sa-reason')?.focus();
  };

  const runAction = async () => {
    const { kind, targetUser, reason, municipality_id } = actionForm;
    if (!reason || reason.length < REASON_MIN) { setError(`Reason must be at least ${REASON_MIN} characters.`); return; }
    setSubmitting(true);
    try {
      let resetResult = null;
      if (kind === 'deactivate') await deactivateUser(targetUser.id, reason);
      else if (kind === 'reactivate') await reactivateUser(targetUser.id, reason);
      else if (kind === 'reset') resetResult = await resetSuperAdminPassword(targetUser.id, reason);
      else if (kind === 'unlock') await unlockUser(targetUser.id, reason);
      else if (kind === 'force-logout') await forceLogoutUser(targetUser.id, reason);
      else if (kind === 'municipality') await changeUserMunicipality(targetUser.id, municipality_id || null, reason);
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

  const handleDeactivate = async (user) => {
    const confirmed = await confirmAction({
      title: `Deactivate account for ${user.name}?`,
      text: `The account will be marked inactive and cannot sign in. Reason is required and will be recorded in the audit log.`,
      confirmText: 'Deactivate',
      danger: true,
    });
    if (!confirmed) return;
    openReasonAction('deactivate', user);
  };

  const handleReactivate = async (user) => {
    const confirmed = await confirmAction({
      title: `Reactivate account for ${user.name}?`,
      text: `The account will be marked active again. Reason is required and will be recorded in the audit log.`,
      confirmText: 'Reactivate',
      danger: false,
    });
    if (!confirmed) return;
    openReasonAction('reactivate', user);
  };

  const handleUnlock = async (user) => {
    const confirmed = await confirmAction({
      title: `Unlock account for ${user.name}?`,
      text: `The lockout will be cleared and the failed login counter reset. Reason is required and will be recorded in the audit log.`,
      confirmText: 'Unlock',
      danger: false,
    });
    if (!confirmed) return;
    openReasonAction('unlock', user);
  };

  const handleForceLogout = async (user) => {
    const confirmed = await confirmAction({
      title: `Force logout ${user.name}?`,
      text: `All sessions for this account will be invalidated. Reason is required and will be recorded in the audit log.`,
      confirmText: 'Force logout',
      danger: true,
    });
    if (!confirmed) return;
    openReasonAction('force-logout', user);
  };

  const handleChangeMunicipality = async (user) => {
    const confirmed = await confirmAction({
      title: `Change municipality for ${user.name}?`,
      text: `The encoder will be moved to a different municipality. Reason is required and will be recorded in the audit log.`,
      confirmText: 'Change',
      danger: true,
    });
    if (!confirmed) return;
    openReasonAction('municipality', user, user.municipality_id || '');
  };

  const handleResetPassword = async (user) => {
    const confirmed = await confirmAction({
      title: `Reset password for ${user.name}?`,
      text: `A temporary password will be generated and shown once. ${user.name} must change it on next login.`,
      confirmText: 'Generate password',
      danger: true,
    });
    if (!confirmed) return;
    openReasonAction('reset', user);
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

  const hasFilter = Boolean(filters.role || filters.status || filters.municipality_id);
  const total = users.length;
  const pageStart = (page - 1) * perPage;
  const paged = users.slice(pageStart, pageStart + perPage);

  return (
    <>
      <PageHeader
        id="superadmin-users"
        variant="clean"
        className="ui-pageheader--admin"
        title="User Management"
        subtitle="Every account across the system. SuperAdmin only."
      >
        <div className="muni-header-actions">
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
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">{total} account{total === 1 ? '' : 's'}</span>
            {hasFilter && (
              <button type="button" className="ui-btn-outline ui-btn--sm" onClick={() => { setPage(1); setFilters({ role: '', status: '', municipality_id: '' }); }}>
                Clear filters
              </button>
            )}
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-2"><span className="muni-status-badge muni-status-badge--status-secondary">Loading…</span></div>}
          {!loading && total === 0 && (
            <div className="muni-empty-state">
              <p className="mb-2">{hasFilter ? 'No accounts match the current filter.' : 'No accounts yet.'}</p>
            </div>
          )}
          {!loading && total > 0 && (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table muni-admin-table superadmin-user-table">
              <thead>
                <tr>
                  <th className="muni-col-secondary text-nowrap">Name</th>
                  <th className="muni-col-secondary text-nowrap">Email</th>
                  <th className="muni-col-secondary text-nowrap">Role</th>
                  <th className="muni-col-secondary text-nowrap">Municipality</th>
                  <th className="muni-col-secondary text-nowrap">Status</th>
                  <th className="muni-col-secondary text-nowrap">Last login</th>
                  <th className="muni-col-secondary text-nowrap">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u) => (
                  <tr key={u.id}>
                    <td className="text-truncate" title={u.name}>
                      <span>{u.name}</span>
                    </td>
                    <td className="text-truncate" title={u.email}>
                      <span>{u.email}</span>
                    </td>
                    <td>
                      <span className={`muni-status-badge muni-status-badge--role-${ROLE_CHIPS[u.role] || 'secondary'}`}>{u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span>
                    </td>
                    <td className="text-truncate" title={u.municipality_name || ''}>
                      <span>{u.municipality_name || '—'}</span>
                    </td>
                    <td>
                      <span className={`muni-status-badge muni-status-badge--status-${STATUS_CHIPS[u.status] || 'secondary'}`}>{u.status.charAt(0).toUpperCase() + u.status.slice(1)}</span>
                    </td>
                    <td className="text-nowrap small">
                      {u.last_login ? new Date(u.last_login).toLocaleString() : '—'}
                    </td>
                    <td className="muni-actions-cell">
                      <div className="muni-row-actions superadmin-user-actions" role="group" aria-label={`Actions for ${u.name}`}>
                        {/* Slot 1: Reset Password */}
                        <button type="button" className="muni-action-btn muni-action-btn--reset" onClick={() => handleResetPassword(u)} title={`Reset password ${u.name}`} aria-label={`Reset password ${u.name}`}>
                          <Key size={16} strokeWidth={2} aria-hidden="true" />
                        </button>
                        {/* Slot 2: Account Status (Deactivate / Reactivate) */}
                        {u.status === 'active' ? (
                          <button type="button" className="muni-action-btn muni-action-btn--deactivate" onClick={() => handleDeactivate(u)} title={`Deactivate ${u.name}`} aria-label={`Deactivate ${u.name}`}>
                            <ShieldAlert size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                        ) : (
                          <button type="button" className="muni-action-btn muni-action-btn--activate" onClick={() => handleReactivate(u)} title={`Reactivate ${u.name}`} aria-label={`Reactivate ${u.name}`}>
                            <RefreshCw size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                        )}
                        {/* Slot 3: Force Logout */}
                        <button type="button" className="muni-action-btn muni-action-btn--force" onClick={() => handleForceLogout(u)} title={`Force logout ${u.name}`} aria-label={`Force logout ${u.name}`}>
                          <LogOut size={16} strokeWidth={2} aria-hidden="true" />
                        </button>
                        {/* Slot 4: Account Management */}
                        {u.role === 'encoder' ? (
                          <button type="button" className="muni-action-btn muni-action-btn--municipality" onClick={() => handleChangeMunicipality(u)} title={`Change municipality ${u.name}`} aria-label={`Change municipality ${u.name}`}>
                            <ShieldAlert size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                        ) : u.locked_until ? (
                          <button type="button" className="muni-action-btn muni-action-btn--unlock" onClick={() => handleUnlock(u)} title={`Unlock ${u.name}`} aria-label={`Unlock ${u.name}`}>
                            <Lock size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                        ) : (
                          <button type="button" className="muni-action-btn muni-action-btn--reset" disabled title="No additional action available" aria-label="No additional action available">
                            <Lock size={16} strokeWidth={2} aria-hidden="true" style={{opacity: 0.4}} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {!loading && total > 0 && (
            <div className="px-3 pb-3">
              <TablePagination page={page} pages={Math.ceil(total / perPage) || 1} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} itemLabel="accounts" />
            </div>
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
