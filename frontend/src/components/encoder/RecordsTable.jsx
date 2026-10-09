import React, { useEffect, useState, useCallback } from 'react';
import { Table, Alert, Button, Card, Row, Col, Modal } from 'react-bootstrap';
import { getRecords, getRecord, deleteRecord, getEncoderBarangays, createRecord } from '../../services/dataService';
import { confirmDelete } from '../../services/feedback';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import { Eye, Pencil, Trash2, Plus } from 'lucide-react';
import RecordStatusBadge from './RecordStatusBadge';
import { formatMT } from '../../utils/volumeFormat';
import ReportImportActions from './ReportImportActions';
import { prepareProductionRows, rowError } from './reportImportUtils';

const STATUS_OPTIONS = ['draft', 'pending', 'approved', 'rejected', 'returned'];
const PRODUCTION_METHOD_LABELS = {
  solar: 'Solar',
  cooked: 'Cooked',
  hybrid: 'Hybrid',
};

function DetailRow({ label, value }) {
  return (
    <tr>
      <th className="text-muted fw-normal">{label}</th>
      <td>{value ?? '—'}</td>
    </tr>
  );
}

const IconAction = ({ onClick, variant, title, ariaLabel, children, disabled }) => (
  <Button
    type="button"
    variant="link"
    size="sm"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={ariaLabel}
    className={`text-${variant} p-1`}
  >
    {children}
  </Button>
);

export default function RecordsTable({ onEdit, onImported, refreshKey = 0, user }) {
  const { toastSuccess, toastError } = useToast();
  const volumeCapMt = Number(user?.max_monthly_volume_mt) || 2000;
  const [records, setRecords] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [filters, setFilters] = useState({ barangay_id: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [actionError, setActionError] = useState(null);

  const load = useCallback((f) => {
    setLoading(true);
    setError(null);
    const params = {};
    if (f.barangay_id) params.barangay_id = f.barangay_id;
    if (f.status) params.status = f.status;
    getRecords(params)
      .then((r) => { setRecords(r.records || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => {
    getEncoderBarangays()
      .then((res) => setBarangays(res.barangays || []))
      .catch(() => {});
    load(filters);
  }, [filters, load, refreshKey]);

  const handleFilter = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleClearFilters = () => {
    setFilters({ barangay_id: '', status: '' });
  };

  const handleView = (id) => {
    setActionError(null);
    getRecord(id)
      .then((r) => { setDetail(r); setShowDetail(true); })
      .catch((err) => {
        const message = err.message || 'Could not load this record.';
        setActionError(message);
        toastError(message);
      });
  };

  const handleDelete = async (id, status, label) => {
    if (status === 'approved') return;
    const confirmed = await confirmDelete({
      title: 'Delete this record?',
      text: `This will permanently remove the record for <strong>${label || `record #${id}`}</strong>. This cannot be undone.`,
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteRecord(id);
      load(filters);
      toastSuccess('The production record has been deleted.', 'Record deleted');
    } catch (err) {
      const message = err.message || 'Could not delete this record.';
      setActionError(message);
      toastError(message);
    }
  };

  const hasFilter = Boolean(filters.barangay_id || filters.status);

  // WHAT: Preview lang — validation + soft warning bago pa mag-import.
  // WHY: Nakikita agad ng encoder ang 3x-historical warning bago kanselahin.
  const previewProductionRows = (rows) => {
    const { errors, warnings } = prepareProductionRows(rows, barangays, volumeCapMt);
    return { errors, warnings };
  };

  const importProductionRows = async (rows) => {
    const { errors, warnings, prepared } = prepareProductionRows(rows, barangays, volumeCapMt);
    if (errors.length) throw new Error(errors.join(' '));

    const failures = [];
    let imported = 0;
    for (const row of prepared) {
      try {
        const { rowNumber, ...payload } = row;
        await createRecord(payload);
        imported += 1;
      } catch (error) {
        failures.push(rowError({ _row_number: row.rowNumber }, error.message || 'Could not create record.'));
      }
    }
    if (imported) {
      load(filters);
      onImported?.();
    }
    if (!imported) throw new Error(failures.join(' ') || 'No production rows were imported.');
    const warningNote = warnings.length ? ` Note: ${warnings.join(' ')}` : '';
    return {
      message: `Imported ${imported} of ${rows.length} production row${rows.length === 1 ? '' : 's'}.${failures.length ? ` ${failures.join(' ')}` : ''}${warningNote}`,
      isError: failures.length > 0,
    };
  };

  return (
    <Card className="encoder-card">
      <Card.Header>
        <div className="admin-card-head d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h5 className="admin-card-head-title">Production Reports</h5>
              <div className="small text-muted">Report Type: Production</div>
            </div>
            <ReportImportActions
              templateUrl="/static/templates/production-report-template.csv"
              onImport={importProductionRows}
              onValidate={previewProductionRows}
              disabled={!barangays.length}
            />
        </div>
      </Card.Header>
      <Card.Body>
        <Row className="g-2 mb-3">
          <Col md={4}>
            <select
              className="form-select"
              name="barangay_id"
              value={filters.barangay_id}
              onChange={handleFilter}
              aria-label="Filter by barangay"
            >
              <option value="">All barangays</option>
              {barangays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Col>
          <Col md={4}>
            <select
              className="form-select"
              name="status"
              value={filters.status}
              onChange={handleFilter}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </Col>
          <Col md={4} className="d-flex gap-2 align-items-center justify-content-end">
            <span className="text-muted small">{records.length} record{records.length === 1 ? '' : 's'}</span>
            {hasFilter && (
              <Button variant="link" size="sm" onClick={handleClearFilters}>Clear filters</Button>
            )}
          </Col>
        </Row>

        {actionError && <Alert variant="danger" onClose={() => setActionError(null)} dismissible>{actionError}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}
        {loading && <div className="text-center py-2"><SkeletonList rows={6} cols={5} /></div>}
        {!loading && records.length === 0 && (
          <Alert variant="info">No records found. Use “+ Add Record” above to submit one.</Alert>
        )}
        {!loading && records.length > 0 && (
          <Table responsive striped hover size="sm" className="mb-0 encoder-table">
            <thead>
              <tr>
                <th>Report Type</th>
                <th>Barangay</th>
                <th>Date</th>
                <th>Method</th>
                <th>Volume (MT)</th>
                <th>Beds Used</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const isApproved = r.status === 'approved';
                return (
                  <tr key={r.id}>
                    <td>Production</td>
                    <td>{r.barangay}</td>
                    <td>{r.record_date}</td>
                    <td>{PRODUCTION_METHOD_LABELS[r.production_method] ?? r.production_method ?? '—'}</td>
                    <td>{formatMT(r.production_volume_mt)}</td>
                    <td>{r.num_salt_beds?.toLocaleString()}</td>
                    <td><RecordStatusBadge status={r.status} reviewerComment={r.reviewer_comment} /></td>
                    <td className="text-end text-nowrap">
                      <IconAction
                        variant="secondary"
                        title="View"
                        ariaLabel="View record"
                        onClick={() => handleView(r.id)}
                      >
                        <Eye size={16} strokeWidth={2} />
                      </IconAction>
                      {!isApproved && (
                        <IconAction
                          variant="primary"
                          title="Edit"
                          ariaLabel="Edit record"
                          onClick={() => onEdit && onEdit(r.id)}
                        >
                          <Pencil size={16} strokeWidth={2} />
                        </IconAction>
                      )}
                      {!isApproved && (
                        <IconAction
                          variant="danger"
                          title="Delete"
                          ariaLabel="Delete record"
                          onClick={() => handleDelete(r.id, r.status, `${r.barangay} on ${r.record_date}`)}
                        >
                          <Trash2 size={16} strokeWidth={2} />
                        </IconAction>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card.Body>

      <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Production Report #{detail?.id}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detail && (
            <>
              <div className="mb-3">
                <RecordStatusBadge status={detail.status} reviewerComment={detail.reviewer_comment} />
                {detail.reviewer_comment && (
                  <div className="mt-2 small text-muted">Reviewer comment: {detail.reviewer_comment}</div>
                )}
              </div>
              <Table bordered size="sm" className="mb-0">
                <tbody>
                  <DetailRow label="Report Type" value="Production" />
                  <DetailRow label="Barangay" value={detail.barangay} />
                  <DetailRow label="Date Covered" value={detail.record_date} />
                  <DetailRow label="Production Method" value={PRODUCTION_METHOD_LABELS[detail.production_method] ?? detail.production_method} />
                  <DetailRow label="Total Production Volume" value={detail.production_volume_mt != null ? `${formatMT(detail.production_volume_mt)} MT` : null} />
                  <DetailRow label="Beds Used" value={detail.num_salt_beds} />
                  <DetailRow label="Area per Salt Bed" value={detail.area_per_salt_bed != null ? `${detail.area_per_salt_bed} m²` : null} />
                  <DetailRow label="Output per Salt Bed" value={detail.output_per_bed != null ? `${detail.output_per_bed} MT` : null} />
                  <DetailRow label="Submitted" value={detail.created_at ? new Date(detail.created_at).toLocaleString() : null} />
                  <DetailRow label="Last Updated" value={detail.updated_at ? new Date(detail.updated_at).toLocaleString() : null} />
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetail(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}
