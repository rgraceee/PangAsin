// WHAT: System > Accounts page - superadmin-only user management page.
//       Lists all users with create, deactivate/reactivate, reset password,
//       change municipality, force logout, unlock actions.
// WHY: SuperAdmin needs a single page to manage all user accounts across
//      admin and encoder roles.
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, Table, Button, Modal, Form } from 'react-bootstrap';
import { UserPlus } from 'lucide-react';
import {
  getSuperAdminUsers,
  createSuperAdminUser,
  deactivateUser,
  reactivateUser,
  resetPassword,
  changeUserMunicipality,
  forceLogoutUser,
  unlockUser,
} from '../../services/dataService';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';

export default function SystemAccounts() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'encoder',
    municipality_id: '',
  });
  const [errors, setErrors] = useState({});
  const [toastSuccess, toastError] = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { users: usersList } = await getSuperAdminUsers();
      setUsers(usersList || []);
    } catch (e) {
      toastError(e.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, toastError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAdd = () => {
    setForm({ name: '', email: '', role: 'encoder', municipality_id: '' });
    setErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.name) newErrors.name = 'Name is required.';
    if (!form.email) newErrors.email = 'Email is required.';
    if (!form.role) newErrors.role = 'Role is required.';
    if (form.role === 'encoder' && !form.municipality_id) {
      newErrors.municipality_id = 'Municipality is required for encoders.';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    try {
      await createSuperAdminUser({
        name: form.name,
        email: form.email,
        role: form.role,
        municipality_id: form.role === 'encoder' ? form.municipality_id : null,
      });
      setShowModal(false);
      setForm({ name: '', email: '', role: 'encoder', municipality_id: '' });
      setErrors({});
      toastSuccess('User created.');
      fetchUsers();
    } catch (e) {
      setErrors(e.data?.errors || { _: e.message || 'Failed to create user.' });
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await deactivateUser(id);
      toastSuccess('User deactivated.');
      fetchUsers();
    } catch (e) {
      toastError(e.message || 'Failed to deactivate user.');
    }
  };

  const handleReactivate = async (id) => {
    try {
      await reactivateUser(id);
      toastSuccess('User reactivated.');
      fetchUsers();
    } catch (e) {
      toastError(e.message || 'Failed to reactivate user.');
    }
  };

  const handleResetPassword = async (id) => {
    try {
      const { temporary_password } = await resetPassword(id);
      toastSuccess('Password reset.');
      setShowModal(false);
      setErrors({});
      toastError(
        `Temporary password: ${temporary_password}\nShare this once. User must change on next login.`
      );
      fetchUsers();
    } catch (e) {
      toastError(e.message || 'Failed to reset password.');
    }
  };

  const handleForceLogout = async (id) => {
    try {
      await forceLogoutUser(id);
      toastSuccess('User logged out from all sessions.');
      fetchUsers();
    } catch (e) {
      toastError(e.message || 'Failed to log out user.');
    }
  };

  const handleUnlock = async (id) => {
    try {
      await unlockUser(id);
      toastSuccess('User unlocked.');
      fetchUsers();
    } catch (e) {
      toastError(e.message || 'Failed to unlock user.');
    }
  };

  const handleChangeMunicipality = async (id, municipalityId) => {
    try {
      await changeUserMunicipality(id, municipalityId);
      toastSuccess('Municipality updated.');
      fetchUsers();
    } catch (e) {
      toastError(e.message || 'Failed to update municipality.');
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Account management" />
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <h5 className="mb-0">User Accounts</h5>
            <Button variant="primary" onClick={handleAdd} disabled={loading} size="sm">
              <UserPlus size={16} /> Add User
            </Button>
          </div>
          {loading ? (
            <div className="text-center py-4">Loading users...</div>
          ) : (
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Municipality</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span
                        className={`badge bg-${u.role === 'admin' ? 'primary' : u.role === 'encoder' ? 'secondary' : 'dark'}`}
                      >
                        {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </span>
                    </td>
                    <td>{u.municipality_name || '—'}</td>
                    <td>
                      <span
                        className={`badge ${u.status === 'active' ? 'bg-success' : 'bg-danger'}`}
                      >
                        {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                      </span>
                      {u.failed_login_count > 0 && (
                        <span className="badge bg-warning text-dark ms-1">
                          {u.failed_login_count} fail
                        </span>
                      )}
                      {u.locked_until && (
                        <span className="badge bg-danger text-white ms-1">
                          Locked
                        </span>
                      )}
                    </td>
                    <td>{u.last_login || '—'}</td>
                    <td>
                      <div className="btn-group btn-group-sm" role="group">
                        {u.role !== 'superadmin' && (
                          <>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleResetPassword(u.id)}
                              title="Reset password"
                            >
                              <i className="bi bi-key" />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleForceLogout(u.id)}
                              title="Force logout"
                            >
                              <i className="bi bi-box-arrow-right" />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleUnlock(u.id)}
                              title="Unlock account"
                            >
                              <i className="bi bi-unlock" />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleDeactivate(u.id)}
                              title="Deactivate account"
                            >
                              <i className="bi bi-person-x" />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleReactivate(u.id)}
                              title="Reactivate account"
                            >
                              <i className="bi bi-person-check" />
                            </Button>
                            {u.role === 'encoder' && (
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => {
                                  const muniId = window.prompt(
                                    'Enter municipality ID:',
                                    u.municipality_id || ''
                                  );
                                  if (muniId) handleChangeMunicipality(u.id, muniId);
                                }}
                                title="Change municipality"
                              >
                                <i className="bi bi-geo-alt" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="md">
        <Modal.Header closeButton>
          <Modal.Title>Create User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                isInvalid={errors.name}
              />
              {errors.name && <div className="text-danger">{errors.name}</div>}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                isInvalid={errors.email}
              />
              {errors.email && <div className="text-danger">{errors.email}</div>}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select
                name="role"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value, municipality_id: '' })
                }
              >
                <option value="admin">Admin</option>
                <option value="encoder">Encoder</option>
              </Form.Select>
            </Form.Group>
            {form.role === 'encoder' && (
              <Form.Group className="mb-3">
                <Form.Label>Municipality ID</Form.Label>
                <Form.Control
                  type="number"
                  name="municipality_id"
                  value={form.municipality_id || ''}
                  onChange={(e) =>
                    setForm({ ...form, municipality_id: e.target.value })}
                  isInvalid={errors.municipality_id}
                />
                {errors.municipality_id && (
                  <div className="text-danger">{errors.municipality_id}</div>
                )}
              </Form.Group>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Create User
            </button>
          </form>
        </Modal.Body>
      </Modal>
    </>
  );
}
