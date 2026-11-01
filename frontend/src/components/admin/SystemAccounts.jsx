// WHAT: System > Accounts page - superadmin-only user management page.
// WHY: SuperAdmin manages admin and encoder accounts without exposing the
//      SuperAdmin role to Admins or Encoders.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Form, Modal, Table } from 'react-bootstrap';
import {
  KeyRound, LogOut, MapPin, Unlock, UserCheck, UserPlus, UserX,
} from 'lucide-react';
import {
  changeUserMunicipality,
  createSuperAdminUser,
  deactivateUser,
  forceLogoutUser,
  getAdminMunicipalities,
  getSuperAdminUsers,
  reactivateUser,
  resetSuperAdminPassword,
  unlockUser,
} from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import IconButton from '../IconButton';
import PageHeader from './PageHeader';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';
import TablePagination from '../ui/TablePagination';
import usePagination from '../../hooks/usePagination';

const USER_ROLES = ['admin', 'encoder'];
const EMPTY_FORM = { name: '', email: '', role: 'encoder', municipality_id: '' };

export default function SystemAccounts() {
  const { toastSuccess, toastError } = useToast();
  const { activeNames } = useMunicipalityDirectory();
  const [users, setUsers] = useState([]);
  const [munis, setMunis] = useState([]);
  const [filters, setFilters] = useState({ role: '', status: '', municipality_id: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);
  const [muniEditing, setMuniEditing] = useState(null);
  const [muniValue, setMuniValue] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSuperAdminUsers()
      .then((r) => { setUsers(r.users || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getAdminMunicipalities()
      .then((res) => setMunis(res.municipalities || []))
      .catch(() => {});
  }, []);

  const handleFilter = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
  const handleClear = () => setFilters({ role: '', status: '', municipality_id: '' });

  const visibleUsers = users.filter((u) => {
    if (filters.role && u.role !== filters.role) return false;
    if (filters.status && u.status !== filters.status) return false;
    if (filters.municipality_id && String(u.municipality_id || '') !== String(filters.municipality_id)) return false;
    return true;
  });

  const hasFilter = Boolean(filters.role || filters.status || filters.municipality_id);

  const pager = usePagination({
    total: visibleUsers.length,
    resetKey: `${filters.role}|${filters.status}|${filters.municipality_id}`,
  });
  const pagedUsers = visibleUsers.slice(pager.pageStart, pager.pageStart + pager.perPage);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowCreate(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!form.email.trim()) { setFormError('Email is required.'); return; }
    if (form.role === 'encoder' && !form.municipality_id) {
      setFormError('Municipality is required for encoders.');
      return;
    }
    setSaving(true);
    try {
      const result = await createSuperAdminUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        municipality_id: form.role === 'encoder' ? form.municipality_id : null,
      });
      setShowCreate(false);
      setTempPassword(result.temporary_password);
      toastSuccess('User created.');
      load();
    } catch (err) {
      const message = err.data?.errors ? err.data.errors.join(', ') : (err.message || 'Failed to create user.');
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (u) => {
    await confirmAction({
      title: 'Reset this password?',
      text: `<strong>${u.name}</strong> will get a new temporary password and must change it on next sign-in.`,
      confirmText: 'Reset password',
      danger: true,
      onConfirm: async () => {
        try {
          const result = await resetSuperAdminPassword(u.id);
          setTempPassword(result.temporary_password);
          toastSuccess('Password reset.');
          load();
        } catch (e) {
          toastError(e.message || 'Failed to reset password.');
        }
      },
    });
  };

  const handleToggleStatus = async (u) => {
    const isActivate = u.status !== 'active';
    await confirmAction({
      title: isActivate ? 'Activate this account?' : 'Deactivate this account?',
      text: `You are about to <strong>${isActivate ? 'activate' : 'deactivate'}</strong> <strong>${u.name}</strong> (${u.email}).`,
      confirmText: isActivate ? 'Activate' : 'Deactivate',
      danger: !isActivate,
      onConfirm: async () => {
        try {
          if (isActivate) await reactivateUser(u.id);
          else await deactivateUser(u.id);
          toastSuccess(isActivate ? 'User reactivated.' : 'User deactivated.');
          load();
        } catch (e) {
          toastError(e.message || 'Failed to update user.');
        }
      },
    });
  };

  const handleForceLogout = async (u) => {
    await confirmAction({
      title: 'Force logout?',
      text: `<strong>${u.name}</strong> will be signed out of every active session.`,
      confirmText: 'Force logout',
      danger: true,
      onConfirm: async () => {
        try {
          await forceLogoutUser(u.id);
          toastSuccess('User logged out from all sessions.');
          load();
        } catch (e) {
          toastError(e.message || 'Failed to log out user.');
        }
      },
    });
  };

  const handleUnlock = async (u) => {
    try {
      await unlockUser(u.id);
      toastSuccess('User unlocked.');
      load();
    } catch (e) {
      toastError(e.message || 'Failed to unlock user.');
    }
  };

  const openMunicipality = (u) => {
    setMuniEditing(u);
    setMuniValue(u.municipality_id || '');
  };

  const handleMunicipality = async (e) => {
    e.preventDefault();
    if (!muniEditing) return;
    setSaving(true);
    try {
      await changeUserMunicipality(muniEditing.id, muniValue || null);
      toastSuccess('Municipality updated.');
      setMuniEditing(null);
      load();
    } catch (err) {
      toastError(err.message || 'Failed to update municipality.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        id="admin-accounts"
        variant="clean"
        className="ui-pageheader--admin"
        title="Accounts"
        subtitle="Manage admin and encoder accounts, roles, and access."
        art={<MunicipalityMapArt mode="province" activeNames={activeNames} />}
      >
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sa-role">Role</label>
          <select id="sa-role" className="form-select admin-page-hero-select" name="role" value={filters.role} onChange={handleFilter}>
            <option value="">All roles</option>
            {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sa-status">Status</label>
          <select id="sa-status" className="form-select admin-page-hero-select" name="status" value={filters.status} onChange={handleFilter}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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
            <span className="text-muted small">
              {visibleUsers.length} user{visibleUsers.length === 1 ? '' : 's'}
              {hasFilter && <button type="button" className="ui-btn-text ui-btn--sm ms-2" onClick={handleClear}>Clear filters</button>}
            </span>
            <button type="button" className="ui-btn-primary ui-btn--sm" onClick={openCreate} disabled={loading}>
              <UserPlus size={16} aria-hidden="true" /> Add User
            </button>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-2"><SkeletonList rows={6} cols={6} /></div>}
          {!loading && visibleUsers.length === 0 && (
            <Alert variant="info">No users match the current filters.</Alert>
          )}
          {!loading && visibleUsers.length > 0 && (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Municipality</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td><span className={`record-status-badge ${u.role === 'admin' ? 'status-approved' : 'status-pending'}`}>{u.role}</span></td>
                    <td>{u.municipality_name || '—'}</td>
                    <td>
                      <span className={`record-status-badge ${u.status === 'active' ? 'status-approved' : 'status-rejected'}`}>{u.status}</span>
                      {u.locked_until && <span className="record-status-badge status-rejected ms-1">locked</span>}
                    </td>
                    <td>{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                    <td className="text-nowrap">
                      <IconButton icon={KeyRound} label={`Reset password for ${u.name}`} variant="outline-primary" onClick={() => handleResetPassword(u)} />
                      <IconButton icon={LogOut} label={`Force logout ${u.name}`} variant="outline-secondary" onClick={() => handleForceLogout(u)} />
                      <IconButton icon={Unlock} label={`Unlock ${u.name}`} variant="outline-secondary" onClick={() => handleUnlock(u)} />
                      <IconButton
                        icon={u.status === 'active' ? UserX : UserCheck}
                        label={u.status === 'active' ? `Deactivate ${u.name}` : `Activate ${u.name}`}
                        variant={u.status === 'active' ? 'outline-danger' : 'outline-success'}
                        onClick={() => handleToggleStatus(u)}
                      />
                      {u.role === 'encoder' && (
                        <IconButton icon={MapPin} label={`Change municipality for ${u.name}`} variant="outline-secondary" onClick={() => openMunicipality(u)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {!loading && visibleUsers.length > 0 && (
            <TablePagination
              page={pager.page}
              pages={pager.pages}
              total={visibleUsers.length}
              perPage={pager.perPage}
              onPageChange={pager.goToPage}
              onPerPageChange={pager.changePerPage}
              itemLabel="user accounts"
            />
          )}
        </Card.Body>
      </Card>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered dialogClassName="muni-modal" aria-labelledby="account-create-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header">
          <div className="muni-modal__heading">
            <Modal.Title id="account-create-title" className="muni-modal__title">Create User</Modal.Title>
            <p className="muni-modal__subtitle">The temporary password is shown once after saving.</p>
          </div>
        </Modal.Header>
        <Form onSubmit={handleCreate} className="muni-modal-form">
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Name <span className="text-danger">*</span></Form.Label>
              <Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email <span className="text-danger">*</span></Form.Label>
              <Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, municipality_id: '' })}>
                {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </Form.Select>
            </Form.Group>
            {form.role === 'encoder' && (
              <Form.Group className="mb-3">
                <Form.Label>Municipality <span className="text-danger">*</span></Form.Label>
                <Form.Select value={form.municipality_id} onChange={(e) => setForm({ ...form, municipality_id: e.target.value })} required>
                  <option value="">Select municipality…</option>
                  {munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Form.Select>
              </Form.Group>
            )}
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer">
            <span className="muni-modal__footer-note">The account must change its password on first sign-in.</span>
            <div className="muni-modal__footer-actions">
              <button type="button" className="ui-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="ui-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create User'}</button>
            </div>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(muniEditing)} onHide={() => setMuniEditing(null)} centered dialogClassName="muni-modal" aria-labelledby="account-muni-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header">
          <div className="muni-modal__heading">
            <Modal.Title id="account-muni-title" className="muni-modal__title">Change Municipality</Modal.Title>
            <p className="muni-modal__subtitle">{muniEditing?.name} ({muniEditing?.email})</p>
          </div>
        </Modal.Header>
        <Form onSubmit={handleMunicipality} className="muni-modal-form">
          <Modal.Body>
            <Form.Group>
              <Form.Label>Municipality</Form.Label>
              <Form.Select value={muniValue} onChange={(e) => setMuniValue(e.target.value)} required>
                <option value="">Select municipality…</option>
                {munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer">
            <span className="muni-modal__footer-note">Changes are written to the audit log.</span>
            <div className="muni-modal__footer-actions">
              <button type="button" className="ui-btn-outline" onClick={() => setMuniEditing(null)}>Cancel</button>
              <button type="submit" className="ui-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(tempPassword)} onHide={() => setTempPassword(null)} centered dialogClassName="muni-modal" aria-labelledby="account-password-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header">
          <div className="muni-modal__heading">
            <Modal.Title id="account-password-title" className="muni-modal__title">Temporary Password</Modal.Title>
            <p className="muni-modal__subtitle">Shown once. Share it privately; it cannot be viewed again.</p>
          </div>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning" className="mb-0"><code>{tempPassword}</code></Alert>
        </Modal.Body>
        <Modal.Footer className="muni-modal__footer">
          <div className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-primary" onClick={() => setTempPassword(null)}>Done</button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
}
