import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { CheckCircle2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { createEncoderProducerReport, getEncoderBarangays, getEncoderProducerReports } from '../../services/dataService';
import { useToast } from '../Toast';
import ReportImportActions from './ReportImportActions';
import { findBarangay, numberValue, rowError } from './reportImportUtils';

const SEX_OPTIONS = ['Male', 'Female', 'Other'];
const STEPS = [
  { label: 'Producer', icon: Users },
  { label: 'Review', icon: CheckCircle2 },
];

function emptyProducer() {
  return { barangay_id: '', name: '', age: '', sex: '', address: '' };
}

export default function ProducerReports({ user, open, onClose, onImported }) {
  const { toastSuccess, toastError } = useToast();
  const [reports, setReports] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [entries, setEntries] = useState([emptyProducer()]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadReports = () => {
    getEncoderProducerReports()
      .then((result) => setReports(result.reports || []))
      .catch((err) => setError(err.message || 'Could not load producer reports.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getEncoderBarangays()
      .then((result) => setBarangays(result.barangays || []))
      .catch((err) => setError(err.message || 'Could not load barangays.'));
    loadReports();
  }, []);

  useEffect(() => {
    if (!open) return;
    setEntries([emptyProducer()]);
    setStep(0);
    setError('');
  }, [open]);

  const updateEntry = (index, changes) => {
    setEntries((current) => current.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, ...changes } : entry
    )));
  };

  const canReview = entries.length > 0 && entries.every((entry) => (
    entry.barangay_id && entry.name.trim() && entry.age !== '' && Number(entry.age) >= 0 && Number(entry.age) <= 120 && entry.sex && entry.address.trim()
  ));

  const submitReport = async () => {
    setError('');
    setSaving(true);
    try {
      const report = await createEncoderProducerReport({
        entries: entries.map((entry) => ({ ...entry, barangay_id: Number(entry.barangay_id) })),
      });
      setReports((current) => [report, ...current]);
      toastSuccess('Producer report submitted and is pending review.', 'Producer report pending');
      onClose();
    } catch (err) {
      const message = err.data?.errors?.join(' ') || err.message || 'Could not submit the producer report.';
      setError(message);
      toastError(message, 'Could not submit report');
    } finally {
      setSaving(false);
    }
  };

  const importProducerRows = async (rows) => {
    const errors = [];
    const entries = rows.map((row) => {
      const barangay = findBarangay(row, barangays);
      const name = String(row.name || '').trim();
      const age = numberValue(row.age);
      const sex = String(row.sex || '').trim().toLowerCase();
      const address = String(row.address || '').trim();
      if (!barangay) errors.push(rowError(row, 'barangay must match a barangay in your municipality.'));
      if (!name || name.length > 150) errors.push(rowError(row, 'name is required and must be 150 characters or fewer.'));
      if (!Number.isInteger(age) || age < 0 || age > 120) errors.push(rowError(row, 'age must be a whole number from 0 to 120.'));
      if (!['male', 'female', 'other'].includes(sex)) errors.push(rowError(row, 'sex must be Male, Female, or Other.'));
      if (!address || address.length > 255) errors.push(rowError(row, 'address is required and must be 255 characters or fewer.'));
      return {
        barangay_id: barangay?.id,
        name,
        age,
        sex: sex ? sex[0].toUpperCase() + sex.slice(1) : sex,
        address,
      };
    });
    if (errors.length) throw new Error(errors.join(' '));
    await createEncoderProducerReport({ entries });
    loadReports();
    onImported?.();
    return `Submitted ${entries.length} producer${entries.length === 1 ? '' : 's'} for review.`;
  };

  return (
    <>
      <Card className="encoder-card mb-4" id="encoder-producer-reports">
        <Card.Header>
          <div className="admin-card-head d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h5 className="admin-card-head-title"><Users size={17} className="me-2" />Producer Reports</h5>
              <div className="small text-muted">Report Type: Producer</div>
            </div>
            <ReportImportActions
              templateUrl="/static/templates/producer-report-template.csv"
              onImport={importProducerRows}
              disabled={!barangays.length}
            />
          </div>
        </Card.Header>
        <Card.Body>
          {error && !open && <Alert variant="danger">{error}</Alert>}
          {loading ? (
            <div className="d-flex justify-content-center py-4"><Spinner animation="border" size="sm" /></div>
          ) : reports.length === 0 ? (
            <div className="chart-empty"><span className="chart-empty-chip">No reports</span>No producer reports submitted yet.</div>
          ) : (
            <Table responsive hover className="mb-0">
              <thead>
                <tr><th>Report Type</th><th>Producers</th><th>Status</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td><Badge bg="primary">Producer</Badge></td>
                    <td>{report.entries?.length || 0}</td>
                    <td><Badge bg={report.status === 'pending' ? 'warning' : 'secondary'} text={report.status === 'pending' ? 'dark' : undefined}>{report.status}</Badge></td>
                    <td>{report.submitted_at ? new Date(report.submitted_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Modal show={open} onHide={onClose} size="lg" centered backdrop="static" className="encoder-form-modal">
        <Modal.Header closeButton className="encoder-form-header">
          <div className="w-100">
            <Modal.Title className="encoder-form-title">New Producer Report</Modal.Title>
            <div className="encoder-stepper mt-3">
              <div className="encoder-stepper-track">
                <div className="encoder-stepper-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
              <div className="encoder-stepper-steps">
                {STEPS.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className={`encoder-stepper-item ${step === index ? 'active' : ''} ${index < step ? 'complete' : ''}`}>
                      <div className="encoder-stepper-icon">{index < step ? <span className="encoder-stepper-check">✓</span> : <Icon size={18} />}</div>
                      <span className="encoder-stepper-label">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="encoder-form-body">
          {error && <Alert variant="danger" className="encoder-form-alert">{error}</Alert>}
          <div className="d-flex justify-content-end mb-3">
            <ReportImportActions
              templateUrl="/static/templates/producer-report-template.csv"
              onImport={importProducerRows}
              disabled={!barangays.length}
            />
          </div>
          {step === 0 ? (
            <div className="form-step-card">
              <div className="form-section-title">Producer Details</div>
              <Row className="g-3 mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="form-field-label">Municipality</Form.Label>
                    <Form.Control value={user?.municipality_name || ''} readOnly aria-label="Assigned municipality" />
                  </Form.Group>
                </Col>
                <Col md={6} className="d-flex align-items-end justify-content-md-end">
                  <Button type="button" variant="outline-primary" onClick={() => setEntries((current) => [...current, emptyProducer()])}>
                    <Plus size={15} className="me-1" />Add Producer
                  </Button>
                </Col>
              </Row>
              <div className="d-flex flex-column gap-3">
                {entries.map((entry, index) => (
                  <Card key={index} className="border shadow-none">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <strong>Producer {index + 1}</strong>
                        {entries.length > 1 && (
                          <Button type="button" variant="link" className="text-danger p-1" aria-label={`Remove producer ${index + 1}`} onClick={() => setEntries((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                      <Row className="g-3">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="form-field-label">Barangay <span className="text-danger">*</span></Form.Label>
                            <Form.Select value={entry.barangay_id} onChange={(event) => updateEntry(index, { barangay_id: event.target.value })}>
                              <option value="">Select barangay...</option>
                              {barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="form-field-label">Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control maxLength={150} value={entry.name} onChange={(event) => updateEntry(index, { name: event.target.value })} placeholder="Enter producer name" />
                          </Form.Group>
                        </Col>
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label className="form-field-label">Age <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="number" min="0" max="120" step="1" value={entry.age} onChange={(event) => updateEntry(index, { age: event.target.value })} placeholder="Enter age" />
                          </Form.Group>
                        </Col>
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label className="form-field-label">Sex <span className="text-danger">*</span></Form.Label>
                            <Form.Select value={entry.sex} onChange={(event) => updateEntry(index, { sex: event.target.value })}>
                              <option value="">Select sex...</option>
                              {SEX_OPTIONS.map((sex) => <option key={sex} value={sex}>{sex}</option>)}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={12}>
                          <Form.Group>
                            <Form.Label className="form-field-label">Address <span className="text-danger">*</span></Form.Label>
                            <Form.Control maxLength={255} value={entry.address} onChange={(event) => updateEntry(index, { address: event.target.value })} placeholder="Enter home address" />
                          </Form.Group>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="form-step-card">
              <div className="form-section-title">Review Producer Report</div>
              <Row className="g-2 mb-3">
                <Col md={6}><strong>Report Type:</strong> Producer</Col>
                <Col md={6}><strong>Municipality:</strong> {user?.municipality_name || '—'}</Col>
              </Row>
              <Table responsive bordered size="sm" className="mb-0">
                <thead><tr><th>Producer</th><th>Barangay</th><th>Age</th><th>Sex</th><th>Address</th></tr></thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={index}>
                      <td>{entry.name || '—'}</td>
                      <td>{barangays.find((barangay) => String(barangay.id) === String(entry.barangay_id))?.name || '—'}</td>
                      <td>{entry.age === '' ? '—' : entry.age}</td>
                      <td>{entry.sex || '—'}</td>
                      <td>{entry.address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="encoder-form-footer">
          <Button variant="link" onClick={onClose} disabled={saving} className="encoder-btn-cancel">Cancel</Button>
          <div className="flex-grow-1" />
          {step === 0 ? (
            <Button variant="primary" onClick={() => { setError(''); setStep(1); }} disabled={!canReview} className="encoder-btn-next">Review</Button>
          ) : (
            <>
              <Button variant="outline-secondary" onClick={() => setStep(0)} disabled={saving} className="encoder-btn-back"><Pencil size={14} className="me-1" />Edit</Button>
              <Button variant="primary" onClick={submitReport} disabled={saving} className="encoder-btn-submit">{saving ? 'Submitting...' : 'Submit Producer Report'}</Button>
            </>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
}
