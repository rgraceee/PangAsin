import React, { useEffect, useState, useCallback } from 'react';
import { Table, Alert, Card, Row, Col, Modal, Form } from 'react-bootstrap';
import { getAdminUsers, getAdminMunicipalities, updateAdminUser } from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import { Pencil, Power } from 'lucide-react';
import IconButton from '../IconButton';
import PageHeader from './PageHeader';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';
import TablePagination from '../ui/TablePagination';
import usePagination from '../../hooks/usePagination';

const USER_ROLES = ['admin', 'encoder'];

export default function UsersManagement() {
  const { toastSuccess, toastError } = useToast();
  const { activeNames } = useMunicipalityDirectory();
  const [users, setUsers] = useState([]);
  const [munis, setMunis] = useState([]);
  const [filters, setFilters] = useState({ role: '', status: '', municipality_id: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', email: '', password: '', municipality_id: '', status: 'active',
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback((f) => {
    setLoading(true);
    setError(null);
    const params = {};
    if (f.role) params.role = f.role;
    if (f.status) params.status = f.status;
    if (f.municipality_id) params.municipality_id = f.municipality_id;
    getAdminUsers(params)
      .then((r) => { setUsers(r.users || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => {
    getAdminMunicipalities().then((res) => setMunis(res.municipalities || [])).catch(() => {});
  }, []);

  useEffect(() => { load(filters); }, [filters, load]);

  const handleFilter = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
  const handleClear = () => setFilters({ role: '', status: '', municipality_id: '' });

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      municipality_id: u.municipality_id || '',
      status: u.status,
    });
    setFormError(null);
    setShowEdit(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (!editing) return;
      const payload = {
        name: form.name,
        status: form.status,
        municipality_id: form.municipality_id || null,
      };
      if (form.password) payload.password = form.password;
      await updateAdminUser(editing.id, payload);
      setShowEdit(false);
      load(filters);
      toastSuccess('The user account has been updated.', 'User saved');
    } catch (err) {
      const message = err.data?.errors ? err.data.errors.join(', ') : (err.message || 'Could not save user.');
      setFormError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    const isActivate = newStatus === 'active';
    const confirmed = await confirmAction({
      title: isActivate ? 'Activate this account?' : 'Deactivate this account?',
      text: `You are about to <strong>${isActivate ? 'activate' : 'deactivate'}</strong> <strong>${u.name}</strong> (${u.email}). ${isActivate ? 'The account can sign in again immediately.' : 'The account will no longer be able to sign in until it is reactivated.'}`,
      confirmText: isActivate ? 'Activate' : 'Deactivate',
      danger: !isActivate,
    });
    if (!confirmed) return;
    try {
      await updateAdminUser(u.id, { status: newStatus });
      load(filters);
      toastSuccess(
        isActivate ? `${u.name} can now sign in.` : `${u.name} has been deactivated.`,
        isActivate ? 'Account activated' : 'Account deactivated',
      );
    } catch (err) {
      const message = err.message || 'Could not update this account.';
      setError(message);
      toastError(message);
    }
  };

  const hasFilter = Boolean(filters.role || filters.status || filters.municipality_id);

  /* WHAT: Accounts are few, so this table pages in the browser.
     WHY: the filter already loaded the full list; slicing keeps every count
          and the edit/activate actions unchanged. */
  const pager = usePagination({
    total: users.length,
    resetKey: `${filters.role}|${filters.status}|${filters.municipality_id}`,
  });
  const pagedUsers = users.slice(pager.pageStart, pager.pageStart + pager.perPage);

  return (
    <>
      <PageHeader
        id="admin-users"
        variant="clean"
        className="ui-pageheader--admin"
        title="User Management"
        subtitle="Manage admin and encoder accounts, roles, and access."
        art={<MunicipalityMapArt mode="province" activeNames={activeNames} />}
      >
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="um-role">Role</label>
          <select id="um-role" className="form-select admin-page-hero-select" name="role" value={filters.role} onChange={handleFilter}>
            <option value="">All roles</option>
            {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="um-status">Status</label>
          <select id="um-status" className="form-select admin-page-hero-select" name="status" value={filters.status} onChange={handleFilter}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="um-muni">Municipality</label>
          <select id="um-muni" className="form-select admin-page-hero-select" name="municipality_id" value={filters.municipality_id} onChange={handleFilter}>
            <option value="">All municipalities</option>
            {munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">{users.length} user{users.length === 1 ? '' : 's'}</span>
            {hasFilter && <button type="button" className="ui-btn-text ui-btn--sm" onClick={handleClear}>Clear filters</button>}
          </div>

        {error && <Alert variant="danger">{error}</Alert>}
        {loading && <div className="text-center py-2"><SkeletonList rows={6} cols={6} /></div>}
        {!loading && users.length === 0 && (
          <Alert variant="info">No users match the current filters.</Alert>
        )}
        {!loading && users.length > 0 && (
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
                  <td><span className={`record-status-badge ${u.status === 'active' ? 'status-approved' : 'status-rejected'}`}>{u.status}</span></td>
                  <td>{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                  <td className="text-nowrap">
                    <IconButton
                      icon={Pencil}
                      label={`Edit ${u.name}`}
                      variant="outline-primary"
                      onClick={() => openEdit(u)}
                    />
                    {u.role === 'encoder' && (
                      <IconButton
                        icon={Power}
                        label={u.status === 'active' ? `Deactivate ${u.name}` : `Activate ${u.name}`}
                        variant={u.status === 'active' ? 'outline-danger' : 'outline-success'}
                        onClick={() => toggleStatus(u)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {!loading && users.length > 0 && (
          <TablePagination
            page={pager.page}
            pages={pager.pages}
            total={users.length}
            perPage={pager.perPage}
            onPageChange={pager.goToPage}
            onPerPageChange={pager.changePerPage}
            itemLabel="user accounts"
          />
        )}
      </Card.Body>

      <Modal
        show={showEdit}
        onHide={() => setShowEdit(false)}
        centered
        dialogClassName="muni-modal"
        aria-labelledby="user-edit-title"
      >
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header">
          <div className="muni-modal__heading">
            <Modal.Title id="user-edit-title" className="muni-modal__title">Edit User</Modal.Title>
            <p className="muni-modal__subtitle">
              Update the account details. Leave the password blank to keep the current one.
            </p>
          </div>
        </Modal.Header>
        <Form onSubmit={handleSubmit} className="muni-modal-form">
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Name <span className="text-danger">*</span></Form.Label>
              <Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Reset password (optional)</Form.Label>
              <Form.Control type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current password" />
              <Form.Text className="text-muted">
                The encoder signs in with the new password immediately; the temporary-password screen is skipped.
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Municipality {editing?.role === 'encoder' && <span className="text-danger">*</span>}</Form.Label>
              <Form.Select
                value={form.municipality_id}
                onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}
                required={editing?.role === 'encoder'}
              >
                <option value="">Select municipality…</option>
                {munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Inactive accounts cannot sign in; existing records stay intact.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer">
            <span className="muni-modal__footer-note">
              Changes are written to the audit log.
            </span>
            <div className="muni-modal__footer-actions">
              <button type="button" className="ui-btn-outline" onClick={() => setShowEdit(false)}>Cancel</button>
              <button type="submit" className="ui-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </Modal.Footer>
        </Form>
      </Modal>
    </Card>
    </>
  );
}