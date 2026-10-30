import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Table, Alert, Card, Row, Col, Modal, Form } from 'react-bootstrap';
import {
  getAdminRecords, getAdminRecord, getAdminMunicipalities, getAdminBarangays, reviewAdminRecord,
  getAdminEnvironmentReports, reviewAdminEnvironmentReport,
  getAdminProducerReports, reviewAdminProducerReport,
} from '../../services/dataService';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import RecordStatusBadge from '../encoder/RecordStatusBadge';
import { Eye, Check, X } from 'lucide-react';
import IconButton from '../IconButton';
import { formatMT } from '../../utils/volumeFormat';
import PageHeader from './PageHeader';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';
import TablePagination from '../ui/TablePagination';
import { STATUS_OPTIONS } from '../../constants/labels';

const DEFAULT_PER_PAGE = 10;

const REPORT_TYPE_LABELS = {
  production: 'Production',
  producer: 'Salt Farmer',
  environment: 'Environment',
};

function DetailRow({ label, value }) {
  return (
    <tr>
      <th className="text-muted fw-normal" style={{ width: '35%' }}>{label}</th>
      <td>{value ?? '—'}</td>
    </tr>
  );
}

export default function ValidationQueue() {
  const { toastSuccess, toastError, toastInfo } = useToast();
  const { activeNames } = useMunicipalityDirectory();
  const [records, setRecords] = useState([]);
  const [reportType, setReportType] = useState('production');
  const [munis, setMunis] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [filters, setFilters] = useState({
    municipality_id: '',
    barangay_id: '',
    status: 'pending',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkComment, setBulkComment] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkFailures, setBulkFailures] = useState([]);
  const [bulkSkipped, setBulkSkipped] = useState(0);
  const [bulkRemaining, setBulkRemaining] = useState(0);
  const [bulkStopping, setBulkStopping] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [selectableIds, setSelectableIds] = useState([]);
  const headerCheckRef = useRef(null);
  const bulkCancelRef = useRef(false);

  const load = useCallback((f, type) => {
    setLoading(true);
    setError(null);
    const params = { page, per_page: perPage, ids: 1 };
    if (f.status) params.status = f.status;
    if (f.municipality_id) params.municipality_id = f.municipality_id;
    if (f.barangay_id) params.barangay_id = f.barangay_id;
    const request = type === 'environment'
      ? getAdminEnvironmentReports(params).then((r) => ({ rows: r.reports || [], meta: r }))
      : type === 'producer'
        ? getAdminProducerReports(params).then((r) => ({ rows: r.reports || [], meta: r }))
        : getAdminRecords(params).then((r) => ({ rows: r.records || [], meta: r }));
    request
      .then(({ rows, meta }) => {
        const nextPages = meta.pages || 0;
        if (nextPages > 0 && page > nextPages) {
          /* WHAT: Bumalik sa huling valid page kapag naubos ang page sa review.
             WHY: bawal magpakita ng bakanteng page pagkatapos ng bulk action. */
          setPage(nextPages);
          return;
        }
        setRecords(rows);
        setTotal(meta.total || 0);
        setPages(nextPages);
        setSelectableIds(meta.selectable_ids || []);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [page, perPage]);

  useEffect(() => {
    getAdminMunicipalities().then((res) => setMunis(res.municipalities || [])).catch(() => {});
    getAdminBarangays().then((res) => setBarangays(res.barangays || [])).catch(() => {});
  }, []);

  useEffect(() => { load(filters, reportType); }, [filters, load, reportType]);

  /* WHAT: Only pending rows can be acted on. WHY: the API rejects any other
     status with a 409, so the checkboxes must match that rule. */
  const pendingRows = records.filter((r) => r.status === 'pending');
  const selectedSet = new Set(selectedIds);
  /* WHAT: The header checkbox reflects every selectable row in the filter.
     WHY: "Select all" must mean the whole filtered queue, not this page. */
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedSet.has(id));
  const someSelected = selectableIds.some((id) => selectedSet.has(id));

  /* WHAT: A tab or filter change clears the selection.
     WHY: a hidden row must never be approved by a bulk action. */
  useEffect(() => {
    setSelectedIds([]);
    setBulkFailures([]);
    setBulkSkipped(0);
    setBulkRemaining(0);
  }, [reportType, filters]);

  /* WHAT: Drop ids that are no longer selectable in this filter.
     WHY: keeps the count and the bulk action in sync after a reload. */
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => selectableIds.includes(id)));
  }, [selectableIds]);

  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  /* WHAT: Barangay options follow the selected municipality.
     WHY: keeps the dropdown short and prevents cross-municipality choices. */
  const barangayOptions = useMemo(
    () => (filters.municipality_id
      ? barangays.filter((b) => String(b.municipality_id) === String(filters.municipality_id))
      : []),
    [barangays, filters.municipality_id],
  );

  const handleFilter = (e) => {
    const { name, value } = e.target;
    /* WHAT: Bagong filter = balik sa unang page.
       WHY: page 5 ng lumang filter ay wala nang katumbas sa bago. */
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      [name]: value,
      // WHAT: Changing municipality invalidates the old barangay.
      ...(name === 'municipality_id' ? { barangay_id: '' } : {}),
    }));
  };

  /* WHAT: Keep a value across tabs unless the new tab cannot use it.
     WHY: only the invalid value resets; the rest of the filter state survives. */
  const handleTabChange = (type) => {
    if (type === reportType) return;
    setReportType(type);
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev };
      if (next.municipality_id && !munis.some((m) => String(m.id) === String(next.municipality_id))) {
        next.municipality_id = '';
      }
      const allowedBarangays = barangays.filter(
        (b) => String(b.municipality_id) === String(next.municipality_id),
      );
      if (next.barangay_id && !allowedBarangays.some((b) => String(b.id) === String(next.barangay_id))) {
        next.barangay_id = '';
      }
      if (next.status && !STATUS_OPTIONS.includes(next.status)) {
        next.status = '';
      }
      return next;
    });
  };

  const handleClear = () => {
    setPage(1);
    setFilters({ municipality_id: '', barangay_id: '', status: 'pending' });
  };

  const toggleRow = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : [...selectableIds]);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setBulkFailures([]);
    setBulkSkipped(0);
    setBulkRemaining(0);
  };

  const openBulk = (action) => {
    setBulkAction(action);
    setBulkComment('');
    setBulkFailures([]);
    setBulkSkipped(0);
    setBulkRemaining(0);
    setBulkStopping(false);
    bulkCancelRef.current = false;
    setBulkProgress({ done: 0, total: selectedIds.length });
  };

  /* WHAT: Ask the running batch to stop after the request in flight.
     WHY: an in-flight review cannot be aborted safely, so the loop checks this
          flag before every next record. */
  const requestBulkCancel = () => {
    bulkCancelRef.current = true;
    setBulkStopping(true);
  };

  const handleView = (id) => {
    if (reportType !== 'production') {
      setDetail(records.find((row) => row.id === id) || null);
      setShowDetail(true);
      setReviewAction(null);
      setReviewComment('');
      return;
    }
    getAdminRecord(id)
      .then((r) => { setDetail(r); setShowDetail(true); setReviewAction(null); setReviewComment(''); })
      .catch((err) => {
        const message = err.message || 'Could not load this record.';
        setError(message);
        toastError(message);
      });
  };

  const handleQuickReview = (id, action) => {
    setReviewAction(action);
    setReviewComment('');
    if (reportType !== 'production') {
      setDetail(records.find((row) => row.id === id) || null);
      setShowDetail(true);
      return;
    }
    getAdminRecord(id)
      .then((r) => { setDetail(r); setShowDetail(true); })
      .catch((err) => {
        const message = err.message || 'Could not load this record.';
        setError(message);
        toastError(message);
      });
  };

  const openReview = (action) => {
    setReviewAction(action);
    setReviewComment('');
  };

  const submitReview = async () => {
    if (!detail || !reviewAction) return;
    setSubmitting(true);
    try {
      const review = reportType === 'environment'
        ? reviewAdminEnvironmentReport
        : reportType === 'producer'
          ? reviewAdminProducerReport
          : reviewAdminRecord;
      const updated = await review(detail.id, {
        status: reviewAction,
        reviewer_comment: reviewComment || null,
      });
      setDetail(updated);
      setReviewAction(null);
      load(filters, reportType);
      if (reviewAction === 'approved') {
        toastSuccess(`${reportTypeLabel} #${detail.id} has been approved.`, `${reportTypeLabel} approved`);
      } else {
        toastSuccess(`${reportTypeLabel} #${detail.id} has been rejected.`, `${reportTypeLabel} rejected`);
      }
    } catch (err) {
      const message = err.message || 'Could not save the review.';
      setError(message);
      toastError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const hasFilter = Boolean(
    filters.municipality_id || filters.barangay_id || filters.status !== 'pending'
  );
  const reportTypeLabel = REPORT_TYPE_LABELS[reportType] || reportType;

  /* WHAT: Reuse the single-record review endpoints for every selected id.
     WHY: they already enforce admin-only + pending-only and keep the salt
          farmer master-list side effects. A 409 means someone reviewed the
          row in the meantime, so it is reported as skipped, not failed. */
  const submitBulk = async () => {
    if (!bulkAction || bulkSubmitting) return;
    const reason = bulkComment.trim();
    if (bulkAction === 'rejected' && !reason) return;
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const review = reportType === 'environment'
      ? reviewAdminEnvironmentReport
      : reportType === 'producer'
        ? reviewAdminProducerReport
        : reviewAdminRecord;

    setBulkSubmitting(true);
    setBulkStopping(false);
    setBulkRemaining(0);
    bulkCancelRef.current = false;
    setBulkProgress({ done: 0, total: ids.length });
    const failures = [];
    let completed = 0;
    let skipped = 0;
    let processed = 0;

    for (let i = 0; i < ids.length; i += 1) {
      if (bulkCancelRef.current) break;
      try {
        await review(ids[i], {
          status: bulkAction,
          reviewer_comment: reason || null,
        });
        completed += 1;
      } catch (err) {
        if (err.status === 409) {
          skipped += 1;
        } else {
          failures.push({ id: ids[i], message: err.message || 'Could not save the review.' });
        }
      }
      processed += 1;
      setBulkProgress({ done: processed, total: ids.length });
    }

    const remaining = ids.slice(processed);
    const failedIds = failures.map((f) => f.id);

    setBulkSubmitting(false);
    setBulkStopping(false);
    setBulkSkipped(skipped);
    setBulkFailures(failures);
    setBulkRemaining(remaining.length);
    setSelectedIds([...failedIds, ...remaining]);
    setBulkAction(null);

    if (completed > 0) {
      toastSuccess(
        `${completed} ${reportTypeLabel.toLowerCase()} record${completed === 1 ? '' : 's'} ${bulkAction}.`,
        bulkAction === 'approved' ? 'Batch approved' : 'Batch rejected',
      );
    }
    if (failures.length > 0) {
      toastError(
        `${failures.length} record${failures.length === 1 ? '' : 's'} could not be reviewed.`,
        'Batch incomplete',
      );
    }
    if (remaining.length > 0) {
      toastInfo(
        `Stopped after ${processed} of ${ids.length} records. ${remaining.length} left selected.`,
        'Batch stopped',
      );
    }
    if (completed === 0 && failures.length === 0 && skipped > 0 && remaining.length === 0) {
      toastError('All selected records were already reviewed.', 'Nothing to update');
    }

    await load(filters, reportType);
  };

  const selectAllCell = (
    <th className="vq-check-col">
      <input
        ref={headerCheckRef}
        type="checkbox"
        className="form-check-input"
        aria-label="Select all pending records"
        checked={allSelected}
        onChange={toggleAll}
        disabled={selectableIds.length === 0}
      />
    </th>
  );

  return (
    <>
      <PageHeader
        id="admin-validation"
        variant="clean"
        className="ui-pageheader--admin"
        title={`${reportTypeLabel} Validation`}
        subtitle={`Review submitted ${reportTypeLabel.toLowerCase()} reports.`}
        status={(
          <div className="admin-report-types d-flex align-items-center gap-2 flex-wrap" role="group" aria-label="Report type">
            {['production', 'producer', 'environment'].map((type) => (
              <button
                key={type}
                type="button"
                className={`ui-btn-${reportType === type ? 'primary' : 'outline'}`}
                aria-pressed={reportType === type}
                onClick={() => handleTabChange(type)}
              >
                {REPORT_TYPE_LABELS[type] || type}
              </button>
            ))}
          </div>
        )}
        art={<MunicipalityMapArt mode="province" activeNames={activeNames} />}
      >
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="vq-status">Status</label>
          <select id="vq-status" className="form-select admin-page-hero-select" name="status" value={filters.status} onChange={handleFilter}>
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="vq-muni">Municipality</label>
          <select id="vq-muni" className="form-select admin-page-hero-select" name="municipality_id" value={filters.municipality_id} onChange={handleFilter}>
            <option value="">All</option>
            {munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="vq-barangay">Barangay</label>
          <select
            id="vq-barangay"
            className="form-select admin-page-hero-select"
            name="barangay_id"
            value={filters.barangay_id}
            onChange={handleFilter}
            disabled={!filters.municipality_id}
          >
            <option value="">{filters.municipality_id ? 'All' : 'Select municipality first'}</option>
            {barangayOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">{total.toLocaleString()} record{total === 1 ? '' : 's'}</span>
            {hasFilter && (
              <button type="button" className="ui-btn-outline vq-clear-btn" onClick={handleClear}>
                Clear filters
              </button>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="vq-bulk-bar" role="region" aria-label="Batch actions">
              <span className="vq-bulk-count">{selectedIds.length} selected</span>
              {selectedIds.length > pendingRows.length && (
                <span className="text-muted small">
                  Selection covers every page of this filter.
                </span>
              )}
              <div className="vq-bulk-actions">
                <button type="button" className="ui-btn-primary ui-btn--sm" onClick={() => openBulk('approved')}>
                  <Check size={15} /> Approve selected
                </button>
                <button type="button" className="ui-btn-danger ui-btn--sm" onClick={() => openBulk('rejected')}>
                  <X size={15} /> Reject selected
                </button>
                <button type="button" className="ui-btn-text ui-btn--sm" onClick={clearSelection}>Clear</button>
              </div>
            </div>
          )}

        {error && <Alert variant="danger">{error}</Alert>}
        {bulkFailures.length > 0 && (
          <Alert variant="warning" dismissible onClose={() => setBulkFailures([])}>
            <div className="fw-semibold mb-1">
              {bulkFailures.length} record{bulkFailures.length === 1 ? '' : 's'} could not be reviewed
            </div>
            <ul className="mb-0 small">
              {bulkFailures.map((f) => (
                <li key={f.id}>Record #{f.id}: {f.message}</li>
              ))}
            </ul>
          </Alert>
        )}
        {bulkSkipped > 0 && (
          <Alert variant="info">
            {bulkSkipped} selected record{bulkSkipped === 1 ? ' was' : 's were'} already reviewed and skipped.
          </Alert>
        )}
        {bulkRemaining > 0 && (
          <Alert variant="secondary">
            Batch stopped with {bulkRemaining} record{bulkRemaining === 1 ? '' : 's'} left selected.
          </Alert>
        )}
        {loading && <div className="text-center py-2"><SkeletonList rows={6} cols={6} /></div>}
        {!loading && records.length === 0 && (
          <Alert variant="info">No records match the current filters.</Alert>
        )}
        {!loading && records.length > 0 && (
          <>
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
              <thead>
              {reportType === 'production' ? <tr>
                {selectAllCell}
                <th>Municipality</th>
                <th>Barangay</th>
                <th>Date</th>
                <th>Submitter</th>
                <th>Volume (Metric Tons (MT))</th>
                <th>Status</th>
                <th>Actions</th>
              </tr> : reportType === 'environment' ? <tr>
                {selectAllCell}
                <th>Municipality</th><th>Barangay</th><th>Salt Beds</th><th>Methods</th><th>Submitter</th><th>Status</th><th>Actions</th>
              </tr> : <tr>
                {selectAllCell}
                <th>Municipality</th><th>Salt Farmer Entries</th><th>Submitter</th><th>Status</th><th>Actions</th>
              </tr>}
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="vq-check-col">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      aria-label={`Select ${reportTypeLabel} record ${r.id}`}
                      checked={selectedSet.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                      disabled={r.status !== 'pending'}
                    />
                  </td>
                  {reportType === 'production' ? <>
                    <td>{r.municipality_name}</td>
                    <td>{r.barangay}</td>
                    <td>{r.record_date}</td>
                    <td>{r.submitter?.name || '—'}</td>
                    <td>{formatMT(r.production_volume_mt)}</td>
                    <td><RecordStatusBadge status={r.status} reviewerComment={r.reviewer_comment} /></td>
                  </> : reportType === 'environment' ? <>
                    <td>{r.municipality_name}</td>
                    <td>{r.barangay}</td>
                    <td>{r.num_salt_beds?.toLocaleString()}</td>
                    <td>{(r.production_methods || []).join(', ')}</td>
                    <td>{r.submitter?.name || '—'}</td>
                    <td><RecordStatusBadge status={r.status} reviewerComment={r.reviewer_comment} /></td>
                  </> : <>
                    <td>{r.municipality_name}</td>
                    <td>{r.entries?.length || 0}</td>
                    <td>{r.submitter?.name || '—'}</td>
                    <td><RecordStatusBadge status={r.status} reviewerComment={r.reviewer_comment} /></td>
                  </>}
                  <td className="text-nowrap">
                    <IconButton
                      icon={Eye}
                      label={`Review record ${r.id}`}
                      variant="outline-primary"
                      onClick={() => handleView(r.id)}
                    />
                    <IconButton
                      icon={Check}
                      label={`Approve record ${r.id}`}
                      variant="success"
                      onClick={() => handleQuickReview(r.id, 'approved')}
                      disabled={r.status !== 'pending'}
                    />
                    <IconButton
                      icon={X}
                      label={`Reject record ${r.id}`}
                      variant="danger"
                      onClick={() => handleQuickReview(r.id, 'rejected')}
                      disabled={r.status !== 'pending'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
            <TablePagination
              page={page}
              pages={pages}
              total={total}
              perPage={perPage}
              onPageChange={setPage}
              onPerPageChange={(next) => { setPage(1); setPerPage(next); }}
              itemLabel={`${reportTypeLabel.toLowerCase()} records`}
              disabled={loading}
            />
          </>
        )}
      </Card.Body>

      <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{reportTypeLabel} Report #{detail?.id}</Modal.Title>
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
                {reportType === 'production' ? <tbody>
                  <DetailRow label="Municipality" value={detail.municipality_name} />
                  <DetailRow label="Barangay" value={detail.barangay} />
                  <DetailRow label="Date Covered" value={detail.record_date} />
                  <DetailRow label="Production Method" value={detail.production_method ? detail.production_method.charAt(0).toUpperCase() + detail.production_method.slice(1) : null} />
                  <DetailRow label="Registered Salt Farmers" value={detail.registered_producers} />
                  <DetailRow label="Male Salt Farmers" value={detail.male_producers} />
                  <DetailRow label="Female Salt Farmers" value={detail.female_producers} />
                  <DetailRow label="Total Production Volume" value={detail.production_volume_mt != null ? `${formatMT(detail.production_volume_mt)} Metric Tons (MT)` : null} />
                  <DetailRow label="Beds Used" value={detail.num_salt_beds} />
                  <DetailRow label="Area per Salt Bed" value={detail.area_per_salt_bed != null ? `${detail.area_per_salt_bed} m²` : null} />
                  <DetailRow label="Output per Salt Bed" value={detail.output_per_bed != null ? `${detail.output_per_bed} Metric Tons (MT)` : null} />
                  <DetailRow label="Submitted by" value={detail.submitter ? `${detail.submitter.name} (${detail.submitter.email})` : null} />
                  <DetailRow label="Submitted at" value={detail.submitted_at ? new Date(detail.submitted_at).toLocaleString() : null} />
                  <DetailRow label="Reviewed by" value={detail.reviewer ? `${detail.reviewer.name} (${detail.reviewer.email})` : null} />
                  <DetailRow label="Reviewed at" value={detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : null} />
                  <DetailRow label="Created" value={detail.created_at ? new Date(detail.created_at).toLocaleString() : null} />
                  <DetailRow label="Last Updated" value={detail.updated_at ? new Date(detail.updated_at).toLocaleString() : null} />
                </tbody> : reportType === 'environment' ? <tbody>
                  <DetailRow label="Report Type" value="Environment" />
                  <DetailRow label="Municipality" value={detail.municipality_name} />
                  <DetailRow label="Barangay" value={detail.barangay} />
                  <DetailRow label="Number of Salt Beds" value={detail.num_salt_beds} />
                  <DetailRow label="Area per Salt Bed" value={detail.area_per_salt_bed != null ? `${detail.area_per_salt_bed} m²` : null} />
                  <DetailRow label="Production Area" value={detail.production_area_size != null ? `${detail.production_area_size} m²` : null} />
                  <DetailRow label="Production Methods" value={(detail.production_methods || []).join(', ')} />
                  <DetailRow label="Submitted by" value={detail.submitter?.name} />
                  <DetailRow label="Submitted at" value={detail.submitted_at ? new Date(detail.submitted_at).toLocaleString() : null} />
                </tbody> : <tbody>
                  <DetailRow label="Report Type" value="Salt Farmer" />
                  <DetailRow label="Municipality" value={detail.municipality_name} />
                  <DetailRow label="Salt Farmer Entries" value={detail.entries?.length || 0} />
                  <DetailRow label="Submitted by" value={detail.submitter?.name} />
                  <DetailRow label="Submitted at" value={detail.submitted_at ? new Date(detail.submitted_at).toLocaleString() : null} />
                </tbody>}
              </Table>

              {reportType === 'producer' && (
                <Table responsive bordered size="sm" className="mt-3 mb-0">
                  <thead><tr><th>Name</th><th>Barangay</th><th>Age</th><th>Sex</th></tr></thead>
                  <tbody>{(detail.entries || []).map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.name}</td><td>{entry.barangay}</td><td>{entry.age ?? entry.age_bracket ?? '—'}</td><td>{entry.sex}</td>
                    </tr>
                  ))}</tbody>
                </Table>
              )}

              {detail.status === 'pending' && !reviewAction && (
                <div className="d-flex gap-2 mt-3">
                  <button type="button" className="ui-btn-primary ui-btn--sm" onClick={() => openReview('approved')}><Check size={16} /> Approve</button>
                  <button type="button" className="ui-btn-danger ui-btn--sm" onClick={() => openReview('rejected')}><X size={16} /> Reject</button>
                </div>
              )}

              {reviewAction && (
                <div className="mt-3">
                  <Form.Group className="mb-2">
                    <Form.Label>
                      {reviewAction === 'approved' ? 'Approval comment (optional)' : 'Rejection reason'}
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder={reviewAction === 'approved' ? 'Optional note for the encoder…' : 'Why is this being rejected?'}
                    />
                  </Form.Group>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className={`ui-btn--sm ${reviewAction === 'approved' ? 'ui-btn-primary' : 'ui-btn-danger'}`}
                      onClick={submitReview}
                      disabled={submitting}
                    >
                      {submitting ? 'Saving…' : `Confirm ${reviewAction === 'approved' ? 'Approve' : 'Reject'}`}
                    </button>
                    <button type="button" className="ui-btn-outline ui-btn--sm" onClick={() => setReviewAction(null)} disabled={submitting}>Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="ui-btn-outline" onClick={() => setShowDetail(false)}>Close</button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={Boolean(bulkAction)}
        onHide={() => { if (!bulkSubmitting) setBulkAction(null); }}
        size="md"
        centered
        backdrop={bulkSubmitting ? 'static' : true}
        keyboard={!bulkSubmitting}
      >
        <Modal.Header closeButton={!bulkSubmitting}>
          <Modal.Title>
            {bulkAction === 'approved' ? 'Approve' : 'Reject'} {selectedIds.length} record{selectedIds.length === 1 ? '' : 's'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted">
            {reportTypeLabel} records that are still pending will be {bulkAction === 'approved' ? 'approved' : 'rejected'}.
            This cannot be undone from this screen.
          </p>
          <Form.Group>
            <Form.Label>
              {bulkAction === 'approved' ? 'Approval comment (optional)' : 'Rejection reason'}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={bulkComment}
              onChange={(e) => setBulkComment(e.target.value)}
              placeholder={bulkAction === 'approved' ? 'Optional note for the encoders…' : 'Why are these being rejected?'}
              disabled={bulkSubmitting}
            />
            {bulkAction === 'rejected' && (
              <Form.Text className="text-muted">
                {bulkComment.trim()
                  ? 'This reason will be saved on every selected record.'
                  : 'A reason is required before you can reject these records.'}
              </Form.Text>
            )}
          </Form.Group>
          {bulkSubmitting && (
            <div className="mt-2" aria-live="polite">
              <div className="small text-muted">
                {bulkStopping
                  ? 'Finishing the current record, then stopping…'
                  : `Reviewing ${bulkProgress.done} of ${bulkProgress.total}…`}
              </div>
              {!bulkStopping && (
                <div className="small text-muted">Cancel stops after the current record.</div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="ui-btn-outline"
            onClick={bulkSubmitting ? requestBulkCancel : () => setBulkAction(null)}
            disabled={bulkSubmitting && bulkStopping}
          >
            {bulkSubmitting ? (bulkStopping ? 'Stopping…' : 'Cancel') : 'Cancel'}
          </button>
          <button
            type="button"
            className={bulkAction === 'approved' ? 'ui-btn-primary' : 'ui-btn-danger'}
            onClick={submitBulk}
            disabled={bulkSubmitting || (bulkAction === 'rejected' && !bulkComment.trim())}
          >
            {bulkSubmitting
              ? `Saving… (${bulkProgress.done}/${bulkProgress.total})`
              : `Confirm ${bulkAction === 'approved' ? 'Approve' : 'Reject'}`}
          </button>
        </Modal.Footer>
      </Modal>
    </Card>
    </>
  );
}