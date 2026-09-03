import React, { useEffect, useState, useCallback } from 'react';
import { Table, Spinner, Alert, Button, Card, Row, Col, Modal, Form } from 'react-bootstrap';
import {
  getAdminRecords, getAdminRecord, getAdminMunicipalities, reviewAdminRecord,
} from '../../services/dataService';
import RecordStatusBadge from '../encoder/RecordStatusBadge';

const STATUS_OPTIONS = ['draft', 'pending', 'approved', 'rejected', 'returned'];

function DetailRow({ label, value }) {
  return (
    <tr>
      <th className="text-muted fw-normal" style={{ width: '35%' }}>{label}</th>
      <td>{value ?? '—'}</td>
    </tr>
  );
}

export default function ValidationQueue() {
  const [records, setRecords] = useState([]);
  const [munis, setMunis] = useState([]);
  const [filters, setFilters] = useState({
    municipality_id: '',
    barangay_id: '',
    status: 'pending',
    q: '',
    start: '',
    end: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback((f) => {
    setLoading(true);
    setError(null);
    const params = {};
    if (f.status) params.status = f.status;
    if (f.municipality_id) params.municipality_id = f.municipality_id;
    if (f.q) params.q = f.q;
    if (f.start) params.start = f.start;
    if (f.end) params.end = f.end;
    getAdminRecords(params)
      .then((r) => { setRecords(r.records || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => {
    getAdminMunicipalities().then((res) => setMunis(res.municipalities || [])).catch(() => {});
  }, []);

  useEffect(() => { load(filters); }, [filters, load]);

  const handleFilter = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
  const handleClear = () => setFilters({
    municipality_id: '', barangay_id: '', status: 'pending', q: '', start: '', end: '',
  });

  const handleView = (id) => {
    getAdminRecord(id)
      .then((r) => { setDetail(r); setShowDetail(true); setReviewAction(null); setReviewComment(''); })
      .catch((err) => setError(err.message));
  };

  const openReview = (action) => {
    setReviewAction(action);
    setReviewComment('');
  };

  const submitReview = async () => {
    if (!detail || !reviewAction) return;
    setSubmitting(true);
    try {
      const updated = await reviewAdminRecord(detail.id, {
        status: reviewAction,
        reviewer_comment: reviewComment || null,
      });
      setDetail(updated);
      setReviewAction(null);
      load(filters);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const hasFilter = Boolean(
    filters.municipality_id || filters.q || filters.start || filters.end || (filters.status && filters.status !== 'pending')
  );

  return (
    <Card className="encoder-card admin-card">
      <Card.Header as="h5">Validation Queue</Card.Header>
      <Card.Body>
        <Row className="g-2 mb-3">
          <Col md={3}>
            <select className="form-select" name="status" value={filters.status} onChange={handleFilter}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </Col>
          <Col md={3}>
            <select className="form-select" name="municipality_id" value={filters.municipality_id} onChange={handleFilter}>
              <option value="">All municipalities</option>
              {munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Col>
          <Col md={3}>
            <input
              type="text"
              className="form-control"
              name="q"
              placeholder="Search barangay…"
              value={filters.q}
              onChange={handleFilter}
            />
          </Col>
          <Col md={3} className="d-flex gap-2 align-items-center">
            <input type="date" className="form-control form-control-sm" name="start" value={filters.start} onChange={handleFilter} title="Start date" />
            <input type="date" className="form-control form-control-sm" name="end" value={filters.end} onChange={handleFilter} title="End date" />
          </Col>
          <Col md={12} className="d-flex gap-2 align-items-center">
            <span className="text-muted small">{records.length} record{records.length === 1 ? '' : 's'}</span>
            {hasFilter && <Button variant="link" size="sm" onClick={handleClear}>Clear filters</Button>}
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}
        {loading && <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>}
        {!loading && records.length === 0 && (
          <Alert variant="info">No records match the current filters.</Alert>
        )}
        {!loading && records.length > 0 && (
          <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
            <thead>
              <tr>
                <th>Municipality</th>
                <th>Barangay</th>
                <th>Date</th>
                <th>Submitter</th>
                <th>Volume (kg)</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.municipality_name}</td>
                  <td>{r.barangay}</td>
                  <td>{r.record_date}</td>
                  <td>{r.submitter?.name || '—'}</td>
                  <td>{r.production_volume?.toLocaleString()}</td>
                  <td><RecordStatusBadge status={r.status} reviewerComment={r.reviewer_comment} /></td>
                  <td className="text-nowrap">
                    <Button size="sm" variant="outline-primary" onClick={() => handleView(r.id)}>Review</Button>
                  </td>
                </tr>
              ))}
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
                  <DetailRow label="Municipality" value={detail.municipality_name} />
                  <DetailRow label="Barangay" value={detail.barangay} />
                  <DetailRow label="Date Covered" value={detail.record_date} />
                  <DetailRow label="Production Method" value={detail.production_method ? detail.production_method.charAt(0).toUpperCase() + detail.production_method.slice(1) : null} />
                  <DetailRow label="Registered Producers" value={detail.registered_producers} />
                  <DetailRow label="Male Producers" value={detail.male_producers} />
                  <DetailRow label="Female Producers" value={detail.female_producers} />
                  <DetailRow label="Total Production Volume" value={detail.production_volume != null ? `${detail.production_volume} kg` : null} />
                  <DetailRow label="Number of Salt Beds" value={detail.num_salt_beds} />
                  <DetailRow label="Area per Salt Bed" value={detail.area_per_salt_bed != null ? `${detail.area_per_salt_bed} m²` : null} />
                  <DetailRow label="Output per Salt Bed" value={detail.output_per_bed != null ? `${detail.output_per_bed} kg` : null} />
                  <DetailRow label="Submitted by" value={detail.submitter ? `${detail.submitter.name} (${detail.submitter.email})` : null} />
                  <DetailRow label="Submitted at" value={detail.submitted_at ? new Date(detail.submitted_at).toLocaleString() : null} />
                  <DetailRow label="Reviewed by" value={detail.reviewer ? `${detail.reviewer.name} (${detail.reviewer.email})` : null} />
                  <DetailRow label="Reviewed at" value={detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : null} />
                  <DetailRow label="Created" value={detail.created_at ? new Date(detail.created_at).toLocaleString() : null} />
                  <DetailRow label="Last Updated" value={detail.updated_at ? new Date(detail.updated_at).toLocaleString() : null} />
                </tbody>
              </Table>

              {detail.status === 'pending' && !reviewAction && (
                <div className="d-flex gap-2 mt-3">
                  <Button variant="success" onClick={() => openReview('approved')}>Approve</Button>
                  <Button variant="danger" onClick={() => openReview('rejected')}>Reject</Button>
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
                    <Button
                      variant={reviewAction === 'approved' ? 'success' : 'danger'}
                      onClick={submitReview}
                      disabled={submitting}
                    >
                      {submitting ? 'Saving…' : `Confirm ${reviewAction === 'approved' ? 'Approve' : 'Reject'}`}
                    </Button>
                    <Button variant="secondary" onClick={() => setReviewAction(null)} disabled={submitting}>Cancel</Button>
                  </div>
                </div>
              )}
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