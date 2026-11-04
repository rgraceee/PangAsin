import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Table, Modal, Form } from 'react-bootstrap';
import {
  getAdminUsers, getAdminPasswordResetStats,
  getAdminMunicipalities, updateAdminUser, resetAdminUserPassword,
  deactivateAdminUser, reactivateAdminUser,
} from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import PageHeader from './PageHeader';
import TablePagination from '../ui/TablePagination';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';
import {
  Pencil, Key, User, Mail, Building2, Clock, UserRoundCheck, UserRoundX,
} from 'lucide-react';

const PER_PAGE = 25;
const REASON_MIN = 10;

const ROLE_TONE = { admin: 'primary', encoder: 'success' };

function roleBadge(role) {
  const tone = ROLE_TONE[role] || 'secondary';
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return <span className={`muni-status-badge muni-status-badge--role-${tone}`}>{label}</span>;
}

function statusBadge(status) {
  const active = status === 'active';
  return (
    <span className={`muni-status-badge muni-status-badge--${active ? 'active' : 'inactive'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function UsersManagement() {
  const { toastSuccess } = useToast();
  const { activeNames } = useMunicipalityDirectory();
  const [users, setUsers] = useState([]);
  const [munis, setMunis] = useState([]);
  const [resetStats, setResetStats] = useState({ total: 0, last_7_days: 0, failed: 0, used: 0 });
  const [filters, setFilters] = useState({ role: '', status: '', municipality_id: '' });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const [openEdit, setOpenEdit] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', municipality_id: '', status: 'active', role: '' });
  const [openAction, setOpenAction] = useState(null);
  const [actionForm, setActionForm] = useState({ kind: '', targetUser: null, reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);
  const [openTemp, setOpenTemp] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, per_page: perPage, ...filters };
    getAdminUsers(params)
      .then((r) => {
        const list = Array.isArray(r.users) ? r.users : [];
        setUsers(list);
        setPage(Math.min(page, Math.ceil((Number(r.total) || 0) / perPage) || 1));
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load users.'); setLoading(false); });
    getAdminPasswordResetStats()
      .then((r) => {
        setResetStats({
          total: Number(r.total || 0),
          last_7_days: Number(r.last_7_days || 0),
          failed: Number(r.failed || 0),
          used: Number(r.used || 0),
        });
      })
      .catch(() => { setResetStats({ total: 0, last_7_days: 0, failed: 0, used: 0 }); });
  }, [page, perPage, filters]);

  useEffect(() => {
    getAdminMunicipalities().then((res) => setMunis(res.municipalities || [])).catch(() => {});
    load();
  }, [load]);

  const handleFilter = (e) => {
    setPage(1);
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const openEditForm = (u) => {
    setEditForm({ name: u.name || '', municipality_id: u.municipality_id || '', status: u.status || 'active', role: u.role || '' });
    setOpenEdit(u);
    setError(null);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setError(null);
    const { name, municipality_id } = editForm;
    if (!name) { setError('Name is required.'); return; }
    if (!openEdit) return;
    setSubmitting(true);
    try {
      await updateAdminUser(openEdit.id, {
        name,
        municipality_id: municipality_id ? Number(municipality_id) : null,
      });
      setOpenEdit(null);
      toastSuccess('The user account has been updated.', 'User saved');
      load();
    } catch (err) {
      setError(err.data?.errors ? err.data.errors.join(', ') : (err.message || 'Could not save user.'));
    } finally { setSubmitting(false); }
  };

  const openReasonAction = (kind, user) => {
    setActionForm({ kind, targetUser: user, reason: '' });
    setOpenAction(true);
    setError(null);
    document.getElementById('au-reason')?.focus();
  };

  const runAction = async () => {
    const { kind, targetUser, reason } = actionForm;
    if (!reason || reason.length < REASON_MIN) { setError(`Reason must be at least ${REASON_MIN} characters.`); return; }
    setError(null);
    setSubmitting(true);
    try {
      if (kind === 'reset') {
        const resetResult = await resetAdminUserPassword(targetUser.id, reason);
        setOpenAction(false);
        if (resetResult && resetResult.temporary_password) {
          setTempPassword(resetResult.temporary_password);
          setOpenTemp(true);
        }
        toastSuccess(`Temporary password generated for ${targetUser.name}. Show it once — they must change it on next login.`, 'Password reset');
      } else if (kind === 'deactivate' || kind === 'reactivate') {
        const updateStatus = kind === 'deactivate' ? deactivateAdminUser : reactivateAdminUser;
        await updateStatus(targetUser.id, reason);
        setOpenAction(false);
        toastSuccess(
          `${targetUser.name} has been ${kind}d.`,
          kind === 'deactivate' ? 'Account deactivated' : 'Account reactivated',
        );
      }
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
    openReasonAction('reset', user);
  };

  const handleAccountStatus = (user) => {
    openReasonAction(user.status === 'active' ? 'deactivate' : 'reactivate', user);
  };

  const copyPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toastSuccess('Temporary password copied to clipboard.', 'Copied');
    } catch { /* clipboard unavailable; user can copy manually */ }
  };

  const hasFilter = Boolean(filters.role || filters.status || filters.municipality_id);
  const total = users.length;
  const activeCount = users.filter((u) => u.status === 'active').length;
  const inactiveCount = total - activeCount;
  const pageStart = (page - 1) * perPage;
  const paged = users.slice(pageStart, pageStart + perPage);

  return (
    <>
      <PageHeader
        id="admin-users"
        variant="clean"
        className="ui-pageheader--admin"
        title="User Management"
        subtitle="Manage admin and encoder accounts, roles, and access."
        art={(
          <MunicipalityMapArt
            mode="province"
            activeNames={activeNames}
            selectableNames={[]}
          />
        )}
      >
        <div className="muni-header-actions">
          <div className="admin-page-hero-control">
            <label className="admin-page-hero-field" htmlFor="au-role">Role</label>
            <select id="au-role" className="form-select admin-page-hero-select" name="role" value={filters.role} onChange={handleFilter}>
              <option value="">All roles</option>
              <option value="encoder">Encoder</option>
            </select>
          </div>
          <div className="admin-page-hero-control">
            <label className="admin-page-hero-field" htmlFor="au-status">Status</label>
            <select id="au-status" className="form-select admin-page-hero-select" name="status" value={filters.status} onChange={handleFilter}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="admin-page-hero-control">
            <label className="admin-page-hero-field" htmlFor="au-muni">Municipality</label>
            <select id="au-muni" className="form-select admin-page-hero-select" name="municipality_id" value={filters.municipality_id} onChange={handleFilter}>
              <option value="">All municipalities</option>
              {munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="muni-summary">
            <span className="muni-summary__item">
              <strong>{resetStats.total}</strong> reset requests
            </span>
            <span className="muni-summary__item muni-summary__item--active">
              <strong>{resetStats.last_7_days}</strong> last 7 days
            </span>
            <span className="muni-summary__item muni-summary__item--failed">
              <strong>{resetStats.failed}</strong> failed emails
            </span>
            <span className="muni-summary__spacer" />
          </div>
        </Card.Body>
      </Card>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="muni-summary">
            <span className="muni-summary__item">
              <strong>{total}</strong> total
            </span>
            <span className="muni-summary__item muni-summary__item--active">
              <strong>{activeCount}</strong> active
            </span>
            <span className="muni-summary__item">
              <strong>{inactiveCount}</strong> inactive
            </span>
            <span className="muni-summary__spacer" />
          </div>

          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-2"><SkeletonList rows={6} cols={6} /></div>}
          {!loading && total === 0 && (
            <div className="muni-empty-state">
              <p className="mb-2">
                {hasFilter ? 'No accounts match the current filter.' : 'No accounts yet.'}
              </p>
            </div>
          )}
          {!loading && total > 0 && (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table muni-admin-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Email</th>
                  <th className="muni-col-secondary">Role</th>
                  <th className="muni-col-secondary">Municipality</th>
                  <th>Status</th>
                  <th className="muni-col-secondary text-nowrap">Last login</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u) => (
                  <tr key={u.id}>
                    <td className="fw-medium">
                      <div className="d-flex align-items-center gap-2">
                        <User size={13} strokeWidth={2} className="text-muted" aria-hidden="true" />
                        <span title={u.name || ''}>{u.name}</span>
                      </div>
                    </td>
                    <td className="text-truncate" title={u.email || ''}>
                      <div className="d-flex align-items-center gap-1">
                        <Mail size={12} strokeWidth={2} className="text-muted" aria-hidden="true" />
                        <span>{u.email}</span>
                      </div>
                    </td>
                    <td className="muni-col-secondary">{roleBadge(u.role)}</td>
                    <td className="muni-col-secondary text-truncate" title={u.municipality_name || ''}>
                      <div className="d-flex align-items-center gap-1">
                        <Building2 size={12} strokeWidth={2} className="text-muted" aria-hidden="true" />
                        <span>{u.municipality_name || '—'}</span>
                      </div>
                    </td>
                    <td>{statusBadge(u.status)}</td>
                    <td className="muni-col-secondary text-nowrap small">
                      <div className="d-flex align-items-center gap-1">
                        <Clock size={11} strokeWidth={2} className="text-muted" aria-hidden="true" />
                        <span>{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</span>
                      </div>
                    </td>
                    <td className="muni-actions-cell">
                      <div className="muni-row-actions" role="group" aria-label={`Actions for ${u.name}`}>
                        <button
                          type="button"
                          className="muni-action-btn muni-action-btn--edit"
                          onClick={() => openEditForm(u)}
                          title={`Edit ${u.name}`}
                          aria-label={`Edit ${u.name}`}
                        >
                          <Pencil size={12} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="muni-action-btn muni-action-btn--reset"
                          onClick={() => handleResetPassword(u)}
                          title={`Reset password ${u.name}`}
                          aria-label={`Reset password ${u.name}`}
                        >
                          <Key size={12} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`muni-action-btn muni-action-btn--${u.status === 'active' ? 'deactivate' : 'activate'}`}
                          onClick={() => handleAccountStatus(u)}
                          title={`${u.status === 'active' ? 'Deactivate' : 'Reactivate'} ${u.name}`}
                          aria-label={`${u.status === 'active' ? 'Deactivate' : 'Reactivate'} ${u.name}`}
                        >
                          {u.status === 'active'
                            ? <UserRoundX size={12} strokeWidth={2} aria-hidden="true" />
                            : <UserRoundCheck size={12} strokeWidth={2} aria-hidden="true" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {!loading && total > 0 && (
            <div className="px-3 pb-3">
              <TablePagination
                page={page}
                pages={Math.ceil(total / perPage) || 1}
                total={total}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
                itemLabel="accounts"
              />
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={openEdit} onHide={() => setOpenEdit(null)} centered dialogClassName="muni-modal" aria-labelledby="au-edit-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header"><Modal.Title id="au-edit-title" className="muni-modal__title">Edit user</Modal.Title></Modal.Header>
        <Form onSubmit={handleEdit} className="muni-modal-form">
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3"><Form.Label>Name <span className="muni-required">*</span></Form.Label><Form.Control value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Municipality {editForm.role === 'encoder' && <span className="muni-required">*</span>}</Form.Label><Form.Select value={editForm.municipality_id} onChange={(e) => setEditForm({ ...editForm, municipality_id: e.target.value })} required={editForm.role === 'encoder'}><option value="">Select municipality…</option>{munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Form.Select></Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <div>{statusBadge(openEdit?.status)}</div>
              <Form.Text className="text-muted">
                Use the account action in the table to deactivate or reactivate with an audit reason.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-outline" onClick={() => setOpenEdit(null)}>Cancel</button>
            <button type="submit" className="ui-btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Save Changes'}</button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={openAction} onHide={() => setOpenAction(false)} centered dialogClassName="muni-modal" aria-labelledby="au-action-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header"><Modal.Title id="au-action-title" className="muni-modal__title">
          {actionForm.kind === 'deactivate'
            ? 'Deactivate user'
            : actionForm.kind === 'reactivate'
              ? 'Reactivate user'
              : 'Reset password'}
        </Modal.Title></Modal.Header>
        <Form onSubmit={(e) => { e.preventDefault(); runAction(); }} className="muni-modal-form">
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <p className="text-muted">
              {actionForm.kind === 'deactivate'
                ? `Deactivate ${actionForm.targetUser?.name}'s account? They will no longer be able to sign in.`
                : actionForm.kind === 'reactivate'
                  ? `Restore sign-in access for ${actionForm.targetUser?.name}?`
                  : 'Reason is required and will be recorded in the audit log.'}
            </p>
            {actionForm.kind !== 'reset' && (
              <p className="text-muted small">The reason is recorded in the audit log.</p>
            )}
            <Form.Group className="mb-3"><Form.Label>Reason <span className="muni-required">*</span></Form.Label><Form.Control as="textarea" id="au-reason" rows={3} value={actionForm.reason} onChange={(e) => setActionForm({ ...actionForm, reason: e.target.value })} required /></Form.Group>
            {actionForm.kind === 'reset' && (
              <Form.Text className="text-muted">Generated passwords are shown once and cannot be recovered.</Form.Text>
            )}
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-outline" onClick={() => setOpenAction(false)}>Cancel</button>
            <button type="submit" className="ui-btn-primary" disabled={submitting}>
              {submitting ? 'Processing…' : actionForm.kind === 'deactivate' ? 'Deactivate account' : actionForm.kind === 'reactivate' ? 'Reactivate account' : 'Confirm'}
            </button>
          </Modal.Footer>
        </Form>
      </Modal>
      {openTemp && tempPassword && (
        <Modal show onHide={() => setOpenTemp(false)} centered dialogClassName="muni-modal" aria-labelledby="au-tmp-title">
          <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header"><Modal.Title id="au-tmp-title" className="muni-modal__title">Temporary password</Modal.Title></Modal.Header>
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
