import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Table, Modal, Form, Badge } from 'react-bootstrap';
import { getAdminRecords, softDeleteRecord, restoreRecord } from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import IconButton from '../IconButton';
import PageHeader from './PageHeader';
import TablePagination from '../ui/TablePagination';
import { Trash2, RotateCw } from 'lucide-react';

const PER_PAGE = 25;
const REASON_MIN = 10;

const STATUS_CHIPS = { approved: 'success', pending: 'warning', rejected: 'danger' };

function chip(label, variant) {
  return <Badge pill className={`bg-${variant}`}>{label}</Badge>;
}

export default function SuperAdminRecords() {
  const { toastSuccess } = useToast();
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({ municipality_id: '', month: '', status: '', showDeleted: 'false' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDelete, setOpenDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, per_page: perPage, ...filters };
    getAdminRecords(params)
      .then((r) => {
        const list = r.records || [];
        setRecords(list);
        setPage(Math.min(page, Math.ceil((r.total || 0) / perPage) || 1));
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load records.'); setLoading(false); });
  }, [page, perPage, filters]);

  useEffect(() => { load(); }, [load]);

  const handleFilter = (e) => { setPage(1); setFilters({ ...filters, [e.target.name]: e.target.value }); };

  const openSoftDelete = (r) => { setOpenDelete(r); setDeleteReason(''); };
  const confirmSoftDelete = async () => {
    if (!deleteReason || deleteReason.length < REASON_MIN) { setError(`Reason must be at least ${REASON_MIN} characters.`); return; }
    setSubmitting(true);
    try {
      await softDeleteRecord(openDelete.id, deleteReason);
      setOpenDelete(null); setDeleteReason('');
      toastSuccess('Record soft-deleted. It is excluded from totals until restored.', 'Record deleted');
      load();
    } catch (err) { setError(err.data?.errors ? err.data.errors.join(', ') : (err.message || 'Delete failed.')); }
    finally { setSubmitting(false); }
  };
  const confirmRestore = async (r) => {
    const ok = await confirmAction({ title: 'Restore this record?', text: `Restore record ${r.id} so it counts in totals again.`, confirmText: 'Restore', danger: false });
    if (!ok) return;
    setSubmitting(true);
    try {
      await restoreRecord(r.id);
      toastSuccess('Record restored.', 'Record restored');
      load();
    } catch (err) { setError(err.data?.errors ? err.data.errors.join(', ') : (err.message || 'Restore failed.')); }
    finally { setSubmitting(false); }
  };

  const paged = records.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

  return (
    <>
      <PageHeader id="superadmin-records" title="Records" subtitle="Production records — soft delete, restore, filter by municipality, month, status." art={<></>}>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sar-muni">Municipality</label>
          <select id="sar-muni" className="form-select admin-page-hero-select" name="municipality_id" value={filters.municipality_id} onChange={handleFilter}><option value="">All</option></select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sar-month">Month (YYYY-MM)</label>
          <input id="sar-month" className="form-control admin-page-hero-select" type="month" name="month" value={filters.month} onChange={handleFilter} />
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sar-status">Status</label>
          <select id="sar-status" className="form-select admin-page-hero-select" name="status" value={filters.status} onChange={handleFilter}><option value="">All</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sar-deleted">Show deleted</label>
          <select id="sar-deleted" className="form-select admin-page-hero-select" name="showDeleted" value={filters.showDeleted} onChange={handleFilter}><option value="false">No</option><option value="true">Yes</option></select>
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">{records.length} record{records.length === 1 ? '' : 's'}</span>
            <Button variant="outline-secondary" size="sm" onClick={() => { setPage(1); setFilters({ municipality_id: '', month: '', status: '', showDeleted: 'false' }); load(); }}><RotateCw size={14} strokeWidth={2} aria-hidden="true" /></Button>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-2"><SkeletonList rows={6} cols={6} /></div>}
          {!loading && records.length === 0 && <Alert variant="info">No records match the current filters.</Alert>}
          {!loading && records.length > 0 && (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
              <thead>
                <tr>
                  <th>Date</th><th>Municipality</th><th>Barangay</th><th>Volume (MT)</th><th>Method</th><th>Status</th><th>Deleted</th><th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id}>
                    <td>{r.record_date ? new Date(r.record_date).toLocaleDateString() : '—'}</td>
                    <td className="text-truncate" style={{ maxWidth: '170px' }} title={r.municipality_name || ''}>{r.municipality_name || '—'}</td>
                    <td className="text-truncate" style={{ maxWidth: '150px' }} title={r.barangay_name || ''}>{r.barangay_name || '—'}</td>
                    <td>{r.production_volume_mt ?? '—'}</td>
                    <td>{r.production_method || '—'}</td>
                    <td>{chip(r.status, STATUS_CHIPS[r.status] || 'secondary')}</td>
                    <td>{r.deleted_at ? <span className="text-danger small">Yes</span> : <span className="text-muted small">No</span>}</td>
                    <td className="text-nowrap">
                      {r.deleted_at ? (
                        <IconButton icon={<RotateCw size={14} strokeWidth={2} />} label={`Restore ${r.id}`} variant="outline-success" onClick={() => confirmRestore(r)} />
                      ) : (
                        <IconButton icon={<Trash2 size={14} strokeWidth={2} />} label={`Delete ${r.id}`} variant="outline-danger" onClick={() => openSoftDelete(r)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {!loading && records.length > 0 && (
            <TablePagination page={page} pages={Math.ceil(records.length / perPage) || 1} total={records.length} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} itemLabel="records" />
          )}
        </Card.Body>
      </Card>

      <Modal show={openDelete} onHide={() => setOpenDelete(null)} centered dialogClassName="muni-modal" aria-labelledby="sar-delete-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header"><Modal.Title id="sar-delete-title" className="muni-modal__title">Soft delete record</Modal.Title></Modal.Header>
        <Form onSubmit={(e) => { e.preventDefault(); confirmSoftDelete(); }} className="muni-modal-form">
          <Modal.Body>
            <p>Confirm soft delete of record <strong>{openDelete.id}</strong> ({openDelete.municipality_name || '—'}, {openDelete.record_date || '—'}). It will be excluded from dashboards, forecasts, reports and the public API until restored.</p>
            <Form.Group className="mb-3"><Form.Label>Reason <span className="text-danger">*</span></Form.Label><Form.Control as="textarea" rows={3} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} required minLength={REASON_MIN} /></Form.Group>
            <Form.Text className="text-muted">Reason is recorded in the audit log.</Form.Text>
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-outline" onClick={() => setOpenDelete(null)}>Cancel</button>
            <button type="submit" className="ui-btn-primary" disabled={submitting}>{submitting ? 'Deleting…' : 'Confirm soft delete'}</button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
