import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Table, Modal, Form } from 'react-bootstrap';
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
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';
import TablePagination from '../ui/TablePagination';
import { Trash2, RotateCw, Pencil, Delete, Calendar, Building2, MapPin, Droplets, Activity } from 'lucide-react';

const PER_PAGE = 25;
const REASON_MIN = 10;

const STATUS_TONE = { approved: 'success', pending: 'warning', rejected: 'danger' };

function statusBadge(status) {
  const tone = STATUS_TONE[status] || 'secondary';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`muni-status-badge muni-status-badge--status-${tone}`}>{label}</span>;
}

export default function SuperAdminRecords() {
  const { toastSuccess, toastError } = useToast();
  const { activeNames } = useMunicipalityDirectory();
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
        const list = Array.isArray(r.records) ? r.records : [];
        setRecords(list);
        setPage(Math.min(page, Math.ceil((Number(r.total) || 0) / perPage) || 1));
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load records.'); setLoading(false); });
  }, [page, perPage, filters]);

  useEffect(() => { load(); }, [load]);

  const handleFilter = (e) => { setPage(1); setFilters({ ...filters, [e.target.name]: e.target.value }); };

  // ---------- Soft delete ----------
  const openSoftDelete = (r) => { setOpenDelete(r); setDeleteReason(''); };
  const confirmSoftDelete = async () => {
    if (!openDelete) { setError('No record selected.'); return; }
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
    if (openEdit == null) { setError('No record selected.'); return; }
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
    if (openPermanent == null) { setError('No record selected.'); return; }
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
  const total = records.length;
  const hasFilter = Boolean(filters.municipality_id || filters.month || filters.status || filters.showDeleted !== 'false');

  return (
    <>
      <PageHeader
        id="superadmin-records"
        variant="clean"
        className="ui-pageheader--admin"
        title="Records"
        subtitle="Production records — edit approved data (reason required), soft delete, restore, permanently delete."
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
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">{total} record{total === 1 ? '' : 's'}</span>
            {hasFilter && <button type="button" className="ui-btn-outline ui-btn--sm" onClick={() => { setPage(1); setFilters({ municipality_id: '', month: '', status: '', showDeleted: 'false' }); load(); }}>Clear filters</button>}
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-2"><span className="muni-status-badge muni-status-badge--status-secondary">Loading…</span></div>}
          {!loading && total === 0 && (
            <div className="muni-empty-state">
              <p className="mb-2">{hasFilter ? 'No records match the current filter.' : 'No records yet.'}</p>
            </div>
          )}
          {!loading && total > 0 && (
            <Table responsive hover size="sm" className="mb-0 encoder-table admin-table muni-admin-table">
              <thead>
                <tr>
                  <th className="muni-col-secondary text-nowrap">Date</th>
                  <th className="muni-col-secondary">Municipality</th>
                  <th className="muni-col-secondary">Barangay</th>
                  <th className="muni-col-secondary text-nowrap">Volume (MT)</th>
                  <th className="muni-col-secondary">Method</th>
                  <th>Status</th>
                  <th className="muni-col-secondary text-nowrap">Deleted</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id}>
                    <td className="text-nowrap small">
                      <div className="d-flex align-items-center gap-1">
                        <Calendar size={11} strokeWidth={2} className="text-muted" aria-hidden="true" />
                        <span>{r.record_date ? new Date(r.record_date).toLocaleDateString() : '—'}</span>
                      </div>
                    </td>
                    <td className="text-truncate" title={r.municipality_name || ''}>
                      <div className="d-flex align-items-center gap-1">
                        <Building2 size={12} strokeWidth={2} className="text-muted" aria-hidden="true" />
                        <span>{r.municipality_name || '—'}</span>
                      </div>
                    </td>
                    <td className="text-truncate" title={r.barangay_name || ''}>
                      <div className="d-flex align-items-center gap-1">
                        <MapPin size={12} strokeWidth={2} className="text-muted" aria-hidden="true" />
                        <span>{r.barangay_name || '—'}</span>
                      </div>
                    </td>
                    <td className="text-nowrap small fw-medium">
                      <div className="d-flex align-items-center gap-1">
                        <Droplets size={11} strokeWidth={2} className="text-muted" aria-hidden="true" />
                        <span>{r.production_volume_mt ?? '—'}</span>
                      </div>
                    </td>
                    <td className="muni-col-secondary text-truncate" title={r.production_method || ''}>
                      <div className="d-flex align-items-center gap-1">
                        <Activity size={11} strokeWidth={2} className="text-muted" aria-hidden="true" />
                        <span>{r.production_method || '—'}</span>
                      </div>
                    </td>
                    <td>{statusBadge(r.status)}</td>
                    <td className="muni-col-secondary text-nowrap small">
                      {r.deleted_at ? <span className="muni-status-badge muni-status-badge--status-danger">Yes</span> : <span className="muni-status-badge muni-status-badge--status-success">No</span>}
                    </td>
                    <td className="muni-actions-cell">
                      <div className="muni-row-actions" role="group" aria-label={`Actions for record ${r.id}`}>
                        {r.deleted_at ? (
                          <>
                            <button type="button" className="muni-action-btn muni-action-btn--activate" onClick={() => confirmRestore(r)} title={`Restore ${r.id}`} aria-label={`Restore ${r.id}`}>
                              <RotateCw size={12} strokeWidth={2} aria-hidden="true" />
                            </button>
                            <button type="button" className="muni-action-btn muni-action-btn--delete" onClick={() => openPermanentDelete(r)} title={`Permanently delete ${r.id}`} aria-label={`Permanently delete ${r.id}`}>
                              <Delete size={12} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <>
                            {r.status === 'approved' && (
                              <button type="button" className="muni-action-btn muni-action-btn--edit" onClick={() => openEditRecord(r)} title={`Edit ${r.id}`} aria-label={`Edit ${r.id}`}>
                                <Pencil size={12} strokeWidth={2} aria-hidden="true" />
                              </button>
                            )}
                            <button type="button" className="muni-action-btn muni-action-btn--deactivate" onClick={() => openSoftDelete(r)} title={`Delete ${r.id}`} aria-label={`Delete ${r.id}`}>
                              <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </>
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
              <TablePagination page={page} pages={Math.ceil(total / perPage) || 1} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} itemLabel="records" />
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Soft delete modal */}
      <Modal show={openDelete} onHide={() => setOpenDelete(null)} centered dialogClassName="muni-modal" aria-labelledby="sar-delete-title">
        <Modal.Header closeButton closeLabel="Close dialog" className="muni-modal__header"><Modal.Title id="sar-delete-title" className="muni-modal__title">Soft delete record</Modal.Title></Modal.Header>
        <Form onSubmit={(e) => { e.preventDefault(); confirmSoftDelete(); }} className="muni-modal-form">
          <Modal.Body>
            <p>Confirm soft delete of record <strong>{openDelete?.id}</strong> ({openDelete?.municipality_name || '—'}, {openDelete?.record_date || '—'}). It will be excluded from dashboards, forecasts, reports and the public API until restored.</p>
            <Form.Group className="mb-3"><Form.Label>Reason <span className="muni-required">*</span></Form.Label><Form.Control as="textarea" rows={3} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} required minLength={REASON_MIN} /></Form.Group>
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
            <p>Permanently delete record <strong>{openPermanent ?? '—'}</strong>? This cannot be undone. The record must already be soft-deleted.</p>
            <Form.Group className="mb-3"><Form.Label>Type <strong>"DELETE"</strong> to confirm <span className="muni-required">*</span></Form.Label><Form.Control value={permanentConfirm} onChange={(e) => setPermanentConfirm(e.target.value)} /></Form.Group>
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
            <p>Edit record <strong>{openEdit ?? '—'}</strong>. All changes are audited with old and new values plus your reason.</p>
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
            <Form.Group className="mb-3"><Form.Label>Reason <span className="muni-required">*</span></Form.Label><Form.Control as="textarea" rows={3} value={editReason} onChange={(e) => setEditReason(e.target.value)} required minLength={REASON_MIN} /></Form.Group>
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
