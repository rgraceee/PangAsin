import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Table, Modal, Form } from 'react-bootstrap';
import {
  getAdminRecords,
  softDeleteRecord,
  restoreRecord,
  editRecord,
  permanentDeleteRecord,
} from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import IconButton from '../IconButton';
import PageHeader from './PageHeader';
import TablePagination from '../ui/TablePagination';
import { Trash2, RotateCw, Pencil, Delete } from 'lucide-react';

const PER_PAGE = 25;
const REASON_MIN = 10;

const STATUS_CHIPS = { approved: 'success', pending: 'warning', rejected: 'danger' };

function chip(label, variant) {
  return <Badge pill className={`bg-${variant}`}>{label}</Badge>;
}

export default function SuperAdminRecords() {
  const { toastSuccess, toastError } = useToast();
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({ municipality_id: '', month: '', status: '', showDeleted: 'false' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDelete, setOpenDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [openPermanent, setOpenPermanent] = useState(null);
  const [permanentConfirm, setPermanentConfirm] = useState('');
  const [openEdit, setOpenEdit] = useState(null);
  const [editData, setEditData] = useState({});
  const [editReason, setEditReason] = useState('');
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

  // ---------- Soft delete ----------
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

  // ---------- Restore ----------
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

  // ---------- Edit ----------
  const openEditRecord = (r) => {
    setOpenEdit(r.id);
    setEditData({
      production_volume_mt: r.production_volume_mt ?? '',
      num_salt_beds: r.num_salt_beds ?? '',
      area_per_salt_bed: r.area_per_salt_bed ?? '',
      production_method: r.production_method || 'solar',
      male_producers: r.male_producers ?? '',
      female_producers: r.female_producers ?? '',
    });
    setEditReason('');
  };

  const confirmEditRecord = async () => {
    if (!editReason || editReason.length < REASON_MIN) { setError(`Reason must be at least ${REASON_MIN} characters.`); return; }
    const payload = { ...editData, reason: editReason };
    setSubmitting(true);
    try {
      await editRecord(openEdit, payload);
      setOpenEdit(null); setEditData({}); setEditReason('');
      toastSuccess('Record updated. Forecast may need re-run if inputs changed.', 'Record updated');
      load();
    } catch (err) { setError(err.data?.errors ? err.data.errors.join(', ') : (err.message || 'Edit failed.')); }
    finally { setSubmitting(false); }
  };

  // ---------- Permanent delete ----------
  const openPermanentDelete = (r) => { setOpenPermanent(r.id); setPermanentConfirm(''); };
  const confirmPermanentDelete = async () => {
    if (permanentConfirm !== 'DELETE') { setError('Type "DELETE" to confirm permanent deletion.'); return; }
    setSubmitting(true);
    try {
      await permanentDeleteRecord(openPermanent, permanentConfirm);
      setOpenPermanent(null); setPermanentConfirm('');
      toastSuccess('Record permanently deleted.', 'Record deleted');
      load();
    } catch (err) { setError(err.data?.errors ? err.data.errors.join(', ') : (err.message || 'Permanent delete failed.')); }
    finally { setSubmitting(false); }
  };

  const paged = records.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

  return (
    <>
      <PageHeader id="superadmin-records" title="Records" subtitle="Production records — edit approved data (reason required), soft delete, restore, permanently delete." art={<></>}>
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
                  <th>Date</th><th>Municipality</th><th>Barangay</th><th>Volume (MT)</th><th>Method</th><th>Status</th><th>Deleted</th><th>Actions</th>
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
                    <td className="text-nowrap d-flex gap-1">
                      {r.deleted_at ? (
                        <>
                          <IconButton icon={<RotateCw size={14} strokeWidth={2} />} label={`Restore ${r.id}`} variant="outline-success" onClick={() => confirmRestore(r)} />
                          <IconButton icon={<Delete size={14} strokeWidth={2} />} label={`Permanently delete ${r.id}`} variant="outline-danger" onClick={() => openPermanentDelete(r)} />
                        </>
                      ) : (
                        <>
                          {r.status === 'approved' && (
                            <IconButton icon={<Pencil size={14} strokeWidth={2} />} label={`Edit ${r.id}`} variant="outline-primary" onClick={() => openEditRecord(r)} />
                          )}
                          <IconButton icon={<Trash2 size={14} strokeWidth={2} />} label={`Delete ${r.id}`} variant="outline-danger" onClick={() => openSoftDelete(r)} />
                        </>
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

      {/* Soft delete modal */}
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

      {/* Permanent delete modal */}
      <Modal show={openPermanent} onHide={() => setOpenPermanent(null)} centered dialogClassName="muni-modal" aria-labelledby="sar-permanent-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header"><Modal.Title id="sar-permanent-title" className="muni-modal__title">Permanently delete record</Modal.Title></Modal.Header>
        <Form onSubmit={(e) => { e.preventDefault(); confirmPermanentDelete(); }} className="muni-modal-form">
          <Modal.Body>
            <p>Permanently delete record <strong>{openPermanent}</strong>? This cannot be undone. The record must already be soft-deleted.</p>
            <Form.Group className="mb-3"><Form.Label>Type <strong>"DELETE"</strong> to confirm <span className="text-danger">*</span></Form.Label><Form.Control value={permanentConfirm} onChange={(e) => setPermanentConfirm(e.target.value)} /></Form.Group>
            <Form.Text className="text-muted">The exact word DELETE is required. This action is audited.</Form.Text>
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-outline" onClick={() => setOpenPermanent(null)}>Cancel</button>
            <button type="submit" className="ui-btn-primary" disabled={submitting || permanentConfirm !== 'DELETE'}>{submitting ? 'Deleting…' : 'Permanently delete'}</button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Edit modal */}
      <Modal show={openEdit} onHide={() => setOpenEdit(null)} centered dialogClassName="muni-modal" aria-labelledby="sar-edit-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header"><Modal.Title id="sar-edit-title" className="muni-modal__title">Edit approved record</Modal.Title></Modal.Header>
        <Form onSubmit={(e) => { e.preventDefault(); confirmEditRecord(); }} className="muni-modal-form">
          <Modal.Body>
            <p>Edit record <strong>{openEdit}</strong>. All changes are audited with old and new values plus your reason.</p>
            <Form.Group className="mb-3"><Form.Label>Production volume (MT)</Form.Label><Form.Control type="number" step="0.00001" value={editData.production_volume_mt} onChange={(e) => setEditData({ ...editData, production_volume_mt: e.target.value })} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Number of salt beds</Form.Label><Form.Control type="number" value={editData.num_salt_beds} onChange={(e) => setEditData({ ...editData, num_salt_beds: e.target.value })} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Area per salt bed (m²)</Form.Label><Form.Control type="number" step="0.01" value={editData.area_per_salt_bed} onChange={(e) => setEditData({ ...editData, area_per_salt_bed: e.target.value })} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Production method</Form.Label><Form.Control as="select" value={editData.production_method} onChange={(e) => setEditData({ ...editData, production_method: e.target.value })}>
              <option value="solar">Solar</option>
              <option value="cooked">Cooked</option>
              <option value="hybrid">Hybrid</option>
            </Form.Control></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Male producers</Form.Label><Form.Control type="number" value={editData.male_producers} onChange={(e) => setEditData({ ...editData, male_producers: e.target.value })} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Female producers</Form.Label><Form.Control type="number" value={editData.female_producers} onChange={(e) => setEditData({ ...editData, female_producers: e.target.value })} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Reason <span className="text-danger">*</span></Form.Label><Form.Control as="textarea" rows={3} value={editReason} onChange={(e) => setEditReason(e.target.value)} required minLength={REASON_MIN} /></Form.Group>
            <Form.Text className="text-muted">Reason is recorded in the audit log. Registered producers is recomputed from male + female.</Form.Text>
          </Modal.Body>
          <Modal.Footer className="muni-modal__footer-actions">
            <button type="button" className="ui-btn-outline" onClick={() => setOpenEdit(null)}>Cancel</button>
            <button type="submit" className="ui-btn-primary" disabled={submitting || !editReason || editReason.length < REASON_MIN}>{submitting ? 'Updating…' : 'Save changes'}</button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
