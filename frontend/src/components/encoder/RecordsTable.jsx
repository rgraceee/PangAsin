import React, { useEffect, useState, useCallback } from 'react';
import { Table, Spinner, Alert, Button, Card, Row, Col, Modal } from 'react-bootstrap';
import { getRecords, getRecord, deleteRecord, getEncoderBarangays, submitRecord } from '../../services/dataService';
import RecordStatusBadge from './RecordStatusBadge';
import { ViewIcon, EditIcon, DeleteIcon, SendIcon } from '../icons';

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

export default function RecordsTable({ onEdit, refreshKey = 0 }) {
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
      .catch((err) => setActionError(err.message));
  };

  const handleDelete = async (id, status) => {
    if (status === 'approved') return;
    if (!window.confirm('Delete this record?')) return;
    setActionError(null);
    try {
      await deleteRecord(id);
      load(filters);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleSubmitForReview = async (id) => {
    setActionError(null);
    try {
      await submitRecord(id);
      load(filters);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const hasFilter = Boolean(filters.barangay_id || filters.status);

  return (
    <Card className="encoder-card">
      <Card.Header as="h5">Submissions</Card.Header>
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
          <Col md={4} className="d-flex gap-2 align-items-center">
            <span className="text-muted small">{records.length} record{records.length === 1 ? '' : 's'}</span>
            {hasFilter && (
              <Button variant="link" size="sm" onClick={handleClearFilters}>Clear filters</Button>
            )}
          </Col>
        </Row>

        {actionError && <Alert variant="danger" onClose={() => setActionError(null)} dismissible>{actionError}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}
        {loading && <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>}
        {!loading && records.length === 0 && (
          <Alert variant="info">No records found. Use “+ Add Record” above to submit one.</Alert>
        )}
        {!loading && records.length > 0 && (
          <Table responsive striped hover size="sm" className="mb-0 encoder-table">
            <thead>
              <tr>
                <th>Barangay</th>
                <th>Date</th>
                <th>Method</th>
                <th>Reg.</th>
                <th>M</th>
                <th>F</th>
                <th>Volume (kg)</th>
                <th>Beds</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const isApproved = r.status === 'approved';
                return (
                  <tr key={r.id}>
                    <td>{r.barangay}</td>
                    <td>{r.record_date}</td>
                    <td>{PRODUCTION_METHOD_LABELS[r.production_method] ?? r.production_method ?? '—'}</td>
                    <td>{r.registered_producers?.toLocaleString()}</td>
                    <td>{r.male_producers?.toLocaleString()}</td>
                    <td>{r.female_producers?.toLocaleString()}</td>
                    <td>{r.production_volume?.toLocaleString()}</td>
                    <td>{r.num_salt_beds?.toLocaleString()}</td>
                    <td><RecordStatusBadge status={r.status} reviewerComment={r.reviewer_comment} /></td>
                    <td className="text-end text-nowrap">
                      <IconAction
                        variant="secondary"
                        title="View"
                        ariaLabel="View record"
                        onClick={() => handleView(r.id)}
                      >
                        <ViewIcon />
                      </IconAction>
                      {!isApproved && (
                        <IconAction
                          variant="primary"
                          title="Edit"
                          ariaLabel="Edit record"
                          onClick={() => onEdit && onEdit(r.id)}
                        >
                          <EditIcon />
                        </IconAction>
                      )}
                      {!isApproved && (
                        <IconAction
                          variant="danger"
                          title="Delete"
                          ariaLabel="Delete record"
                          onClick={() => handleDelete(r.id, r.status)}
                        >
                          <DeleteIcon />
                        </IconAction>
                      )}
                      {r.status === 'draft' && (
                        <IconAction
                          variant="success"
                          title="Submit for review"
                          ariaLabel="Submit for review"
                          onClick={() => handleSubmitForReview(r.id)}
                        >
                          <SendIcon />
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
          <Modal.Title>Record #{detail?.id}</Modal.Title>
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
                  <DetailRow label="Barangay" value={detail.barangay} />
                  <DetailRow label="Date Covered" value={detail.record_date} />
                  <DetailRow label="Production Method" value={PRODUCTION_METHOD_LABELS[detail.production_method] ?? detail.production_method} />
                  <DetailRow label="Registered Producers" value={detail.registered_producers} />
                  <DetailRow label="Male Producers" value={detail.male_producers} />
                  <DetailRow label="Female Producers" value={detail.female_producers} />
                  <DetailRow label="Total Production Volume" value={detail.production_volume != null ? `${detail.production_volume} kg` : null} />
                  <DetailRow label="Number of Salt Beds" value={detail.num_salt_beds} />
                  <DetailRow label="Area per Salt Bed" value={detail.area_per_salt_bed != null ? `${detail.area_per_salt_bed} m²` : null} />
                  <DetailRow label="Output per Salt Bed" value={detail.output_per_bed != null ? `${detail.output_per_bed} kg` : null} />
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
