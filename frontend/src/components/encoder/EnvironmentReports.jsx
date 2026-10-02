import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Leaf, Plus } from 'lucide-react';
import {
  createEncoderBarangay,
  createEncoderEnvironmentReport,
  getEncoderBarangays,
  getEncoderEnvironmentReports,
} from '../../services/dataService';
import { useToast } from '../Toast';
import ReportImportActions from './ReportImportActions';
import { findBarangay, numberValue, rowError } from './reportImportUtils';

const METHODS = [
  { id: 'cooked', label: 'Cooked' },
  { id: 'solar', label: 'Solar' },
  { id: 'hybrid', label: 'Hybrid' },
];

const STATUS_VARIANTS = {
  draft: 'secondary',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  returned: 'info',
};

function EnvironmentReportForm({ user, onClose, onSaved, onImport, barangays: availableBarangays }) {
  const { toastSuccess, toastError } = useToast();
  const [barangays, setBarangays] = useState(availableBarangays || []);
  const [form, setForm] = useState({
    barangay_id: '',
    num_salt_beds: '',
    area_per_salt_bed: '',
    production_methods: [],
    production_area_size: '',
  });
  const [addingBarangay, setAddingBarangay] = useState(false);
  const [newBarangay, setNewBarangay] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (availableBarangays?.length) {
      setBarangays(availableBarangays);
      setLoading(false);
      return;
    }
    getEncoderBarangays()
      .then((result) => setBarangays(result.barangays || []))
      .catch((err) => setError(err.message || 'Could not load barangays.'))
      .finally(() => setLoading(false));
  }, [availableBarangays]);

  const handleMethodChange = (method, checked) => {
    setForm((current) => ({
      ...current,
      production_methods: checked
        ? [...new Set([...current.production_methods, method])]
        : current.production_methods.filter((item) => item !== method),
    }));
  };

  const handleAddBarangay = async () => {
    const name = newBarangay.trim();
    if (!name) return;
    setError('');
    try {
      const barangay = await createEncoderBarangay(name);
      setBarangays((current) => [...current, barangay].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, barangay_id: String(barangay.id) }));
      setNewBarangay('');
      setAddingBarangay(false);
      toastSuccess(`${barangay.name} was added to ${user?.municipality_name || 'your municipality'}.`, 'Barangay added');
    } catch (err) {
      setError(err.message || 'Could not add the barangay.');
    }
  };

  const submitReport = async () => {
    setError('');
    setSaving(true);
    try {
      const report = await createEncoderEnvironmentReport({
        ...form,
        barangay_id: Number(form.barangay_id),
        num_salt_beds: Number(form.num_salt_beds),
        area_per_salt_bed: Number(form.area_per_salt_bed),
        production_area_size: Number(form.production_area_size),
      });
      toastSuccess('Environment report submitted and is pending review.', 'Environment report pending');
      onSaved(report);
    } catch (err) {
      setError(err.message || 'Could not submit the environment report.');
      toastError(err.message || 'Could not submit the environment report.');
    } finally {
      setSaving(false);
    }
  };

  const goToReview = (event) => {
    event.preventDefault();
    setError('');
    setStep(1);
  };

  const canReview = Boolean(
    form.barangay_id
    && form.num_salt_beds !== ''
    && form.area_per_salt_bed !== ''
    && form.production_area_size !== ''
    && form.production_methods.length,
  );

  return (
    <Modal show onHide={onClose} centered size="lg" backdrop="static" className="encoder-form-modal">
      <Modal.Header closeButton className="encoder-form-header">
        <div>
            <Modal.Title className="encoder-form-title">New Environment Report</Modal.Title>
            <div className="encoder-stepper mt-3">
              <div className="encoder-stepper-track">
                <div className="encoder-stepper-fill" style={{ width: `${(step + 1) * 50}%` }} />
              </div>
              <div className="encoder-stepper-steps">
                <div className={`encoder-stepper-item ${step === 0 ? 'active' : 'complete'}`}>
                  <div className="encoder-stepper-icon"><Leaf size={18} /></div>
                  <span className="encoder-stepper-label">Environment</span>
                </div>
                <div className={`encoder-stepper-item ${step === 1 ? 'active' : ''}`}>
                  <div className="encoder-stepper-icon">{step === 1 ? <Leaf size={18} /> : <span className="encoder-stepper-check">✓</span>}</div>
                  <span className="encoder-stepper-label">Review</span>
                </div>
              </div>
            </div>
        </div>
      </Modal.Header>
      <Modal.Body className="encoder-form-body">
        {!loading && (
          <div className="d-flex justify-content-end mb-3">
            <ReportImportActions
              templateUrl="/static/templates/environment-report-template.csv"
              onImport={onImport}
              disabled={!barangays.length}
            />
          </div>
        )}
        {error && <Alert variant="danger" className="encoder-form-alert">{error}</Alert>}
        {loading ? (
          <div className="d-flex justify-content-center py-5"><Spinner animation="border" size="sm" /></div>
        ) : step === 0 ? (
          <Form id="environment-report-form" onSubmit={goToReview}>
            <div className="form-step-card">
              <div className="form-section-title">Environment Details</div>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="form-field-label">Municipality</Form.Label>
                    <Form.Control value={user?.municipality_name || ''} readOnly aria-label="Assigned municipality" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="form-field-label">Barangay <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      required
                      value={form.barangay_id}
                      onChange={(event) => setForm((current) => ({ ...current, barangay_id: event.target.value }))}
                    >
                      <option value="">Select barangay...</option>
                      {barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}
                    </Form.Select>
                    {!addingBarangay ? (
                      <Button variant="link" className="p-0 mt-2" onClick={() => setAddingBarangay(true)}>
                        <Plus size={14} className="me-1" />Add a barangay
                      </Button>
                    ) : (
                      <div className="d-flex gap-2 mt-2">
                        <Form.Control
                          aria-label="New barangay name"
                          placeholder="Barangay name"
                          maxLength={100}
                          value={newBarangay}
                          onChange={(event) => setNewBarangay(event.target.value)}
                        />
                        <Button type="button" variant="outline-primary" onClick={handleAddBarangay} disabled={!newBarangay.trim()}>
                          Add
                        </Button>
                        <Button type="button" variant="outline-secondary" onClick={() => setAddingBarangay(false)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </Form.Group>
                </Col>
              </Row>

              <Row className="g-3 mt-1">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="form-field-label">Number of Salt Beds <span className="text-danger">*</span></Form.Label>
                    <Form.Control type="number" min="1" step="1" required value={form.num_salt_beds} onChange={(event) => setForm((current) => ({ ...current, num_salt_beds: event.target.value }))} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="form-field-label">Area per Salt Bed (m²) <span className="text-danger">*</span></Form.Label>
                    <Form.Control type="number" min="0" step="0.01" required value={form.area_per_salt_bed} onChange={(event) => setForm((current) => ({ ...current, area_per_salt_bed: event.target.value }))} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="form-field-label">Production Area Size (m²) <span className="text-danger">*</span></Form.Label>
                    <Form.Control type="number" min="0" step="0.01" required value={form.production_area_size} onChange={(event) => setForm((current) => ({ ...current, production_area_size: event.target.value }))} />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mt-3">
                <Form.Label className="form-field-label">Production Methods <span className="text-danger">*</span></Form.Label>
                <div className="d-flex flex-wrap gap-4">
                  {METHODS.map((method) => (
                    <Form.Check
                      key={method.id}
                      type="checkbox"
                      id={`environment-method-${method.id}`}
                      label={method.label}
                      checked={form.production_methods.includes(method.id)}
                      onChange={(event) => handleMethodChange(method.id, event.target.checked)}
                    />
                  ))}
                </div>
              </Form.Group>
            </div>
          </Form>
        ) : (
            <div className="form-step-card">
              <div className="form-section-title">Review Environment Report</div>
              <Row className="g-3">
                <Col md={6}><strong>Report Type:</strong> Environment</Col>
                <Col md={6}><strong>Municipality:</strong> {user?.municipality_name || '—'}</Col>
                <Col md={6}><strong>Barangay:</strong> {barangays.find((barangay) => String(barangay.id) === String(form.barangay_id))?.name || '—'}</Col>
                <Col md={6}><strong>Number of Salt Beds:</strong> {form.num_salt_beds || '—'}</Col>
                <Col md={6}><strong>Area per Salt Bed:</strong> {form.area_per_salt_bed || '—'} m²</Col>
                <Col md={6}><strong>Production Area:</strong> {form.production_area_size || '—'} m²</Col>
                <Col md={12}><strong>Production Methods:</strong> {form.production_methods.map((method) => method[0].toUpperCase() + method.slice(1)).join(', ') || '—'}</Col>
              </Row>
            </div>
          )}
      </Modal.Body>
      {!loading && (
        <Modal.Footer className="encoder-form-footer">
          <Button variant="link" onClick={onClose} disabled={saving} className="encoder-btn-cancel">Cancel</Button>
          <div className="flex-grow-1" />
          {step === 0 ? (
            <Button type="submit" form="environment-report-form" variant="primary" disabled={!canReview} className="encoder-btn-next">Review</Button>
          ) : (
            <>
              <Button variant="outline-secondary" onClick={() => setStep(0)} disabled={saving} className="encoder-btn-back">Edit</Button>
              <Button variant="primary" onClick={submitReport} disabled={saving} className="encoder-btn-submit">{saving ? 'Submitting...' : 'Submit Environment Report'}</Button>
            </>
          )}
        </Modal.Footer>
      )}
    </Modal>
  );
}

export default function EnvironmentReports({ user, open, onClose, onImported }) {
  const { toastError } = useToast();
  const [reports, setReports] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = () => {
    getEncoderEnvironmentReports()
      .then((result) => setReports(result.reports || []))
      .catch((err) => setError(err.message || 'Could not load environment reports.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getEncoderBarangays()
      .then((result) => setBarangays(result.barangays || []))
      .catch((err) => setError(err.message || 'Could not load barangays.'));
    loadReports();
  }, []);

  const handleSaved = () => {
    loadReports();
    onClose();
  };

  const importEnvironmentRows = async (rows) => {
    const errors = [];
    const prepared = rows.map((row) => {
      const barangay = findBarangay(row, barangays);
      const numSaltBeds = numberValue(row.num_salt_beds);
      const areaPerSaltBed = numberValue(row.area_per_salt_bed);
      const productionAreaSize = numberValue(row.production_area_size);
      const productionMethods = String(row.production_methods || '')
        .split(/[|;,]/)
        .map((method) => method.trim().toLowerCase())
        .filter(Boolean);
      if (!barangay) errors.push(rowError(row, 'barangay must match a barangay in your municipality.'));
      if (!Number.isInteger(numSaltBeds) || numSaltBeds <= 0) errors.push(rowError(row, 'num_salt_beds must be a positive whole number.'));
      if (!Number.isFinite(areaPerSaltBed) || areaPerSaltBed < 0) errors.push(rowError(row, 'area_per_salt_bed must be zero or greater.'));
      if (!Number.isFinite(productionAreaSize) || productionAreaSize < 0) errors.push(rowError(row, 'production_area_size must be zero or greater.'));
      if (!productionMethods.length || productionMethods.some((method) => !METHODS.some((option) => option.id === method))) {
        errors.push(rowError(row, 'production_methods must contain cooked, solar, and/or hybrid, separated by |.'));
      }
      return {
        barangay_id: barangay?.id,
        num_salt_beds: numSaltBeds,
        area_per_salt_bed: areaPerSaltBed,
        production_area_size: productionAreaSize,
        production_methods: [...new Set(productionMethods)],
        rowNumber: row._row_number,
      };
    });
    if (errors.length) throw new Error(errors.join(' '));

    const failures = [];
    let imported = 0;
    for (const row of prepared) {
      try {
        const { rowNumber, ...payload } = row;
        await createEncoderEnvironmentReport(payload);
        imported += 1;
      } catch (error) {
        failures.push(rowError({ _row_number: row.rowNumber }, error.message || 'Could not create report.'));
      }
    }
    if (imported) {
      loadReports();
      onImported?.();
    }
    if (!imported) throw new Error(failures.join(' ') || 'No environment rows were imported.');
    return {
      message: `Imported ${imported} of ${rows.length} environment row${rows.length === 1 ? '' : 's'}.${failures.length ? ` ${failures.join(' ')}` : ''}`,
      isError: failures.length > 0,
    };
  };

  return (
    <>
      <Card className="encoder-card mb-4" id="encoder-environment-reports">
        <Card.Header>
          <div className="admin-card-head d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h5 className="admin-card-head-title"><Leaf size={17} className="me-2" />Environment Reports</h5>
              <div className="small text-muted">Report Type: Environment</div>
            </div>
            <ReportImportActions
              templateUrl="/static/templates/environment-report-template.csv"
              onImport={importEnvironmentRows}
              disabled={!barangays.length}
            />
          </div>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading ? (
            <div className="d-flex justify-content-center py-4"><Spinner animation="border" size="sm" /></div>
          ) : reports.length === 0 ? (
            <div className="chart-empty"><span className="chart-empty-chip">No reports</span>No environment reports submitted yet.</div>
          ) : (
            <Table responsive hover className="mb-0">
              <thead>
                <tr><th>Report Type</th><th>Barangay</th><th>Salt Beds</th><th>Methods</th><th>Area</th><th>Status</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td><Badge bg="info" text="dark">Environment</Badge></td>
                    <td>{report.barangay}</td>
                    <td>{Number(report.num_salt_beds).toLocaleString()}</td>
                    <td>{(report.production_methods || []).map((method) => method[0].toUpperCase() + method.slice(1)).join(', ')}</td>
                    <td>{Number(report.production_area_size).toLocaleString()} m²</td>
                    <td><Badge bg={STATUS_VARIANTS[report.status] || 'secondary'}>{report.status}</Badge></td>
                    <td>{report.created_at ? new Date(report.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      {open && (
        <EnvironmentReportForm
          user={user}
          onClose={onClose}
          onSaved={handleSaved}
          onImport={importEnvironmentRows}
          barangays={barangays}
        />
      )}
    </>
  );
}
