import React, { useEffect, useState, useCallback } from 'react';
import { Table, Spinner, Alert, Button, Card, Row, Col, Modal } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { getRecords, getRecord, deleteRecord, getEncoderBarangays } from '../../services/dataService';
import RecordStatusBadge from './RecordStatusBadge';

const STATUS_OPTIONS = ['draft', 'pending', 'approved', 'rejected', 'returned'];

function DetailRow({ label, value }) {
  return (
    <tr>
      <th className="text-muted fw-normal">{label}</th>
      <td>{value ?? '—'}</td>
    </tr>
  );
}

export default function RecordsTable() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [filters, setFilters] = useState({ barangay_id: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

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
  }, [filters, load]);

  const handleFilter = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleClearFilters = () => {
    setFilters({ barangay_id: '', status: '' });
  };

  const handleView = (id) => {
    getRecord(id)
      .then((r) => { setDetail(r); setShowDetail(true); })
      .catch((err) => setError(err.message));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await deleteRecord(id);
      load(filters);
    } catch (err) {
      setError(err.message);
    }
  };

  const hasFilter = Boolean(filters.barangay_id || filters.status);

  return (
    <Card className="encoder-card">
      <Card.Header as="h5" className="d-flex justify-content-between align-items-center">
        <span>Submissions</span>
        <Button as={Link} to="/encoder/records/new" size="sm">+ New Record</Button>
      </Card.Header>
      <Card.Body>
        <Row className="g-2 mb-3">
          <Col md={4}>
            <select className="form-select" name="barangay_id" value={filters.barangay_id} onChange={handleFilter}>
              <option value="">All barangays</option>
              {barangays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Col>
          <Col md={4}>
            <select className="form-select" name="status" value={filters.status} onChange={handleFilter}>
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

        {error && <Alert variant="danger">{error}</Alert>}
        {loading && <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>}
        {!loading && records.length === 0 && (
          <Alert variant="info">No records found. Use <Link to="/encoder/records/new">New Record</Link> to submit one.</Alert>
        )}
        {!loading && records.length > 0 && (
          <Table responsive striped hover size="sm" className="mb-0 encoder-table">
            <thead>
              <tr>
                <th>Barangay</th>
                <th>Date</th>
                <th>Reg.</th>
                <th>M</th>
                <th>F</th>
                <th>Volume (kg)</th>
                <th>Beds</th>
                <th>Area/bed (m2)</th>
                <th>Output/bed</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.barangay}</td>
                  <td>{r.record_date}</td>
                  <td>{r.registered_producers?.toLocaleString()}</td>
                  <td>{r.male_producers?.toLocaleString()}</td>
                  <td>{r.female_producers?.toLocaleString()}</td>
                  <td>{r.production_volume?.toLocaleString()}</td>
                  <td>{r.num_salt_beds?.toLocaleString()}</td>
                  <td>{r.area_per_salt_bed ?? '—'}</td>
                  <td>{r.output_per_bed ?? '—'}</td>
                  <td><RecordStatusBadge status={r.status} reviewerComment={r.reviewer_comment} /></td>
                  <td className="text-nowrap">
                    <Button size="sm" variant="outline-secondary" onClick={() => handleView(r.id)}>View</Button>{' '}
                    <Button size="sm" variant="outline-primary" onClick={() => navigate(`/encoder/records/${r.id}/edit`)}>Edit</Button>{' '}
                    <Button size="sm" variant="outline-danger" onClick={() => handleDelete(r.id)}>Delete</Button>
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
                  <DetailRow label="Barangay" value={detail.barangay} />
                  <DetailRow label="Date Covered" value={detail.record_date} />
                  <DetailRow label="Registered Producers" value={detail.registered_producers} />
                  <DetailRow label="Male Producers" value={detail.male_producers} />
                  <DetailRow label="Female Producers" value={detail.female_producers} />
                  <DetailRow label="Total Production Volume" value={detail.production_volume != null ? `${detail.production_volume} kg` : null} />
                  <DetailRow label="Number of Salt Beds" value={detail.num_salt_beds} />
                  <DetailRow label="Area per Salt Bed" value={detail.area_per_salt_bed != null ? `${detail.area_per_salt_bed} m2` : null} />
                  <DetailRow label="Output per Salt Bed" value={detail.output_per_bed != null ? `${detail.output_per_bed} kg` : null} />
                  <DetailRow label="Notes" value={detail.notes} />
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