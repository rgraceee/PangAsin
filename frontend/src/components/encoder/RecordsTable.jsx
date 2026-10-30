import React, { useState } from 'react';
import { Table, Alert, Badge, Button, Card, Modal } from 'react-bootstrap';
import { getRecord, deleteRecord, createRecord } from '../../services/dataService';
import { confirmDelete } from '../../services/feedback';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import { Eye, Pencil, Trash2, Plus } from 'lucide-react';
import RecordStatusBadge from './RecordStatusBadge';
import { formatMT } from '../../utils/volumeFormat';
import ReportImportActions from './ReportImportActions';
import { prepareProductionRows, rowError } from './reportImportUtils';
import TablePagination from '../ui/TablePagination';

const PRODUCTION_METHOD_LABELS = {
  solar: 'Solar',
  cooked: 'Cooked',
  hybrid: 'Hybrid',
};

// WHAT: Maikli at basahin agad ang petsa (hal. "Oct 1, 2026").
// WHY: ISO strings (2026-10-01) ay mahirap i-scan sa table.
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

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

/* WHAT: Presentational na production records table.
   WHY: ang page ang may-ari ng filters/period/loading para pareho ang count
        at KPI cards sa isang data source lang. */
export default function RecordsTable({
  user,
  records = [],
  barangays = [],
  loading = false,
  error = null,
  hasFilter = false,
  total = 0,
  page = 1,
  pages = 1,
  perPage = 10,
  onPageChange,
  onPerPageChange,
  onClearFilters,
  onAdd,
  onEdit,
  onRefresh,
}) {
  const { toastSuccess, toastError } = useToast();
  const volumeCapMt = Number(user?.max_monthly_volume_mt) || 2000;
  const [detail, setDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [actionError, setActionError] = useState(null);

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
    setActionError(null);
    await confirmDelete({
      title: 'Delete this record?',
      text: `This will permanently remove the record for <strong>${label || `record #${id}`}</strong>. This cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        await deleteRecord(id);
        onRefresh?.();
        toastSuccess('The production record has been deleted.', 'Record deleted');
      },
    });
  };

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
      onRefresh?.();
    }
    if (!imported) throw new Error(failures.join(' ') || 'No production rows were imported.');
    const warningNote = warnings.length ? ` Note: ${warnings.join(' ')}` : '';
    return {
      message: `Imported ${imported} of ${rows.length} production row${rows.length === 1 ? '' : 's'}.${failures.length ? ` ${failures.join(' ')}` : ''}${warningNote}`,
      isError: failures.length > 0,
    };
  };

  return (
    <Card className="encoder-card admin-card">
      <Card.Header className="master-toolbar">
        <h2 className="h6 mb-0">Production Records</h2>
        <div className="master-toolbar__actions">
          <Badge bg="light" text="dark">{(total || records.length).toLocaleString()} total</Badge>
          {hasFilter && (
            <Button variant="link" size="sm" className="p-0" onClick={onClearFilters}>Clear filters</Button>
          )}
          <ReportImportActions
            templateUrl="/static/templates/production-report-template.csv"
            onImport={importProductionRows}
            onValidate={previewProductionRows}
            disabled={!barangays.length}
          />
          <button type="button" className="ui-btn-primary ui-btn-primary--sm" onClick={onAdd}>
            <Plus size={16} aria-hidden="true" />Add Production Record
          </button>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        {actionError && <Alert variant="danger" className="m-3" onClose={() => setActionError(null)} dismissible>{actionError}</Alert>}
        {error && <Alert variant="danger" className="m-3">{error}</Alert>}
        {loading && <div className="text-center py-4"><SkeletonList rows={6} cols={5} /></div>}
        {!loading && records.length === 0 && (
          <div className="chart-empty py-5">
            {hasFilter
              ? 'No production records match the selected filters.'
              : 'No production records yet. Use “Add Production Record” to submit one.'}
          </div>
        )}
        {!loading && records.length > 0 && (
          <>
            <Table responsive hover className="mb-0 encoder-table admin-table ui-records-table">
              <thead>
                <tr>
                  <th>Report Type</th>
                  <th>Barangay</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th className="text-end">Volume (Metric Tons (MT))</th>
                  <th className="text-end">Beds Used</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                const isApproved = r.status === 'approved';
                return (
                  <tr key={r.id}>
                    <td><span className="ui-type-pill">Production</span></td>
                    <td>{r.barangay}</td>
                    <td>{formatDate(r.record_date)}</td>
                    <td>{PRODUCTION_METHOD_LABELS[r.production_method] ?? r.production_method ?? '—'}</td>
                    <td className="text-end">{formatMT(r.production_volume_mt)}</td>
                    <td className="text-end">{r.num_salt_beds?.toLocaleString()}</td>
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
            <div className="px-3 pb-3">
              <TablePagination
                page={page}
                pages={pages}
                total={total}
                perPage={perPage}
                onPageChange={onPageChange}
                onPerPageChange={onPerPageChange}
                itemLabel="production records"
                disabled={loading}
              />
            </div>
          </>
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
                  <DetailRow label="Date Covered" value={formatDate(detail.record_date)} />
                  <DetailRow label="Production Method" value={PRODUCTION_METHOD_LABELS[detail.production_method] ?? detail.production_method} />
                  <DetailRow label="Total Production Volume" value={detail.production_volume_mt != null ? `${formatMT(detail.production_volume_mt)} Metric Tons (MT)` : null} />
                  <DetailRow label="Beds Used" value={detail.num_salt_beds} />
                  <DetailRow label="Area per Salt Bed" value={detail.area_per_salt_bed != null ? `${detail.area_per_salt_bed} m²` : null} />
                  <DetailRow label="Output per Salt Bed" value={detail.output_per_bed != null ? `${detail.output_per_bed} Metric Tons (MT)` : null} />
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
