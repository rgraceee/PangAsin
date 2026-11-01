import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Table, Modal, Form, Badge } from 'react-bootstrap';
import { getAdminUsers, resetSuperAdminPassword } from '../../services/dataService';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import IconButton from '../IconButton';
import PageHeader from './PageHeader';
import TablePagination from '../ui/TablePagination';
import { Key } from 'lucide-react';

const PER_PAGE = 25;

export default function UsersManagement() {
  const { toastSuccess } = useToast();
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ status: '' });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const [openReset, setOpenReset] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { role: 'encoder', per_page: perPage, page, ...filters };
    getAdminUsers(params)
      .then((r) => {
        const list = (r.users || []).filter((u) => u.role === 'encoder');
        setUsers(list);
        setPage(Math.min(page, Math.ceil((r.total || 0) / perPage) || 1));
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load users.'); setLoading(false); });
  }, [page, perPage, filters]);

  useEffect(() => { load(); }, [load]);

  const handleFilter = (e) => { setPage(1); setFilters({ ...filters, [e.target.name]: e.target.value }); };

  const openResetPassword = (u) => { setOpenReset(u); setReason(''); };
  const confirmReset = async () => {
    if (!reason || reason.length < 10) { setError('Reason must be at least 10 characters.'); return; }
    setSubmitting(true);
    try {
      await resetSuperAdminPassword(openReset.id);
      setOpenReset(null); setReason('');
      toastSuccess(`Temporary password generated for ${openReset.name}. Show it once — they must change it on next login.`, 'Password reset');
      load();
    } catch (err) { setError(err.data?.errors ? err.data.errors.join(', ') : (err.message || 'Reset failed.')); }
    finally { setSubmitting(false); }
  };

  const paged = users.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

  return (
    <>
      <PageHeader id="admin-users" title="User Management" subtitle="Encoder accounts only. Admins manage their own accounts via Settings." art={<></>}>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="au-status">Status</label>
          <select id="au-status" className="form-select admin-page-hero-select" name="status" value={filters.status} onChange={handleFilter}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">{users.length} encoder{users.length === 1 ? '' : 's'}</span>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-2"><SkeletonList rows={6} cols={6} /></div>}
          {!loading && users.length === 0 && <Alert variant="info">No encoder accounts match the current filters.</Alert>}
          {!loading && users.length > 0 && (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Municipality</th><th>Status</th><th>Last login</th><th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td><td>{u.email}</td>
                    <td>{u.municipality_name || '—'}</td>
                    <td><Badge pill className={`bg-${u.status === 'active' ? 'success' : 'secondary'}`}>{u.status}</Badge></td>
                    <td>{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                    <td className="text-nowrap">
                      <IconButton icon={<Key size={14} strokeWidth={2} />} label={`Reset password ${u.name}`} variant="outline-primary" onClick={() => openResetPassword(u)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {!loading && users.length > 0 && (
            <TablePagination page={page} pages={Math.ceil(users.length / perPage) || 1} total={users.length} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} itemLabel="encoder accounts" />
          )}
        </Card.Body>
      </Card>

      <Modal show={openReset} onHide={() => setOpenReset(null)} centered dialogClassName="muni-modal" aria-labelledby="au-reset-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header"><Modal.Title id="au-reset-title" className="muni-modal__title">Reset password</Modal.Title></Modal.Header>
        <Form onSubmit={(e) => { e.preventDefault(); confirmReset(); }} className="muni-modal-form">
          <Modal.Body>
            <p>Generate a temporary password for <strong>{openReset.name}</strong> ({openReset.email}). It is shown once and the user must change it on next login.</p>
            <Form.Group className="mb-3"><Form.Label>Reason <span className="text-danger">*</span></Form.Label><Form.Control as="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} /></Form.Group>
            <Form.Text className="text-muted">Reason is required and audited.</Form.Text>
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-outline" onClick={() => setOpenReset(null)}>Cancel</button>
            <button type="submit" className="ui-btn-primary" disabled={submitting}>{submitting ? 'Resetting…' : 'Generate password'}</button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
