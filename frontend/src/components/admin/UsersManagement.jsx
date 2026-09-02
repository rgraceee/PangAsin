import React, { useEffect, useState, useCallback } from 'react';
import { Table, Spinner, Alert, Button, Card, Row, Col, Modal, Form } from 'react-bootstrap';
import { getAdminUsers, getAdminMunicipalities, createAdminUser, updateAdminUser } from '../../services/dataService';

const USER_ROLES = ['admin', 'encoder'];

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [munis, setMunis] = useState([]);
  const [filters, setFilters] = useState({ role: '', status: '', municipality_id: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
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

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', email: '', password: '', municipality_id: '', status: 'active' });
    setFormError(null);
    setShowAdd(true);
  };

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
    setShowAdd(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (editing) {
        const payload = {
          name: form.name,
          status: form.status,
          municipality_id: form.municipality_id || null,
        };
        if (form.password) payload.password = form.password;
        await updateAdminUser(editing.id, payload);
      } else {
        if (!form.municipality_id) {
          setFormError('Municipality is required for encoder accounts.');
          setSaving(false);
          return;
        }
        await createAdminUser({
          name: form.name,
          email: form.email,
          password: form.password,
          municipality_id: form.municipality_id,
          status: form.status,
        });
      }
      setShowAdd(false);
      load(filters);
    } catch (err) {
      if (err.data?.errors) setFormError(err.data.errors.join(', '));
      else setFormError(err.message || 'Could not save user.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    try {
      await updateAdminUser(u.id, { status: newStatus });
      load(filters);
    } catch (err) {
      setError(err.message);
    }
  };

  const hasFilter = Boolean(filters.role || filters.status || filters.municipality_id);

  return (
    <Card className="encoder-card admin-card">
      <Card.Header as="h5" className="d-flex justify-content-between align-items-center">
        <span>User Management</span>
        <Button size="sm" onClick={openAdd}>+ Add Encoder</Button>
      </Card.Header>
      <Card.Body>
        <Row className="g-2 mb-3">
          <Col md={3}>
            <select className="form-select" name="role" value={filters.role} onChange={handleFilter}>
              <option value="">All roles</option>
              {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Col>
          <Col md={3}>
            <select className="form-select" name="status" value={filters.status} onChange={handleFilter}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Col>
          <Col md={3}>
            <select className="form-select" name="municipality_id" value={filters.municipality_id} onChange={handleFilter}>
              <option value="">All municipalities</option>
              {munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Col>
          <Col md={3} className="d-flex gap-2 align-items-center">
            <span className="text-muted small">{users.length} user{users.length === 1 ? '' : 's'}</span>
            {hasFilter && <Button variant="link" size="sm" onClick={handleClear}>Clear filters</Button>}
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}
        {loading && <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>}
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
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className={`record-status-badge ${u.role === 'admin' ? 'status-approved' : 'status-draft'}`}>{u.role}</span></td>
                  <td>{u.municipality_name || '—'}</td>
                  <td><span className={`record-status-badge ${u.status === 'active' ? 'status-approved' : 'status-rejected'}`}>{u.status}</span></td>
                  <td>{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                  <td className="text-nowrap">
                    <Button size="sm" variant="outline-primary" onClick={() => openEdit(u)}>Edit</Button>{' '}
                    {u.role === 'encoder' && (
                      <Button
                        size="sm"
                        variant={u.status === 'active' ? 'outline-warning' : 'outline-success'}
                        onClick={() => toggleStatus(u)}
                      >
                        {u.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card.Body>

      <Modal show={showAdd} onHide={() => setShowAdd(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? 'Edit User' : 'Add Encoder'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Name <span className="text-danger">*</span></Form.Label>
              <Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Form.Group>
            {!editing && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Email <span className="text-danger">*</span></Form.Label>
                  <Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Password <span className="text-danger">*</span></Form.Label>
                  <Form.Control type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                  <Form.Text className="text-muted">Minimum 6 characters.</Form.Text>
                </Form.Group>
              </>
            )}
            {editing && (
              <Form.Group className="mb-3">
                <Form.Label>Reset password (optional)</Form.Label>
                <Form.Control type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current password" />
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Municipality <span className="text-danger">*</span></Form.Label>
              <Form.Select
                value={form.municipality_id}
                onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}
                required={!editing || (editing && editing.role === 'encoder')}
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
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Encoder')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Card>
  );
}