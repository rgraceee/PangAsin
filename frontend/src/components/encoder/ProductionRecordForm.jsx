import React, { useEffect, useMemo, useState } from 'react';
import { Form, Button, Alert, Row, Col, Modal } from 'react-bootstrap';
import { getEncoderBarangays, getEncoderEnvironmentReports, createRecord, updateRecord, getRecord } from '../../services/dataService';
import { useToast } from '../Toast';
import { SkeletonForm } from '../Skeleton';
import { Factory, CheckCircle2 } from 'lucide-react';
import ReportImportActions from './ReportImportActions';
import { cleanSpreadsheetDate, findBarangay, numberValue, rowError } from './reportImportUtils';

const PRODUCTION_METHODS = [
  { value: '', label: 'Select method…' },
  { value: 'solar', label: 'Solar' },
  { value: 'cooked', label: 'Cooked' },
  { value: 'hybrid', label: 'Hybrid' },
];

const STEPS = [
  { key: 'production', label: 'Production', icon: Factory },
  { key: 'review', label: 'Review', icon: CheckCircle2 },
];

function localDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ProductionRecordForm({ editingId = null, user, onClose, onSaved, onImported }) {
  const { toastSuccess, toastError } = useToast();
  const isEdit = Boolean(editingId);
  const [step, setStep] = useState(0);

  const [barangays, setBarangays] = useState([]);
  const [environmentReports, setEnvironmentReports] = useState([]);
  const [form, setForm] = useState({
    barangay_id: '',
    record_date: localDateString(),
    production_volume: '',
    num_salt_beds: '',
    area_per_salt_bed: '',
    production_method: '',
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    getEncoderBarangays()
      .then((res) => setBarangays(res.barangays || []))
      .catch((err) => setError(err.message));
    getEncoderEnvironmentReports()
      .then((res) => setEnvironmentReports(res.reports || []))
      .catch(() => {});

    if (isEdit) {
      getRecord(editingId)
        .then((r) => {
          setForm({
            barangay_id: r.barangay_id ?? '',
            record_date: r.record_date || '',
            production_volume: r.production_volume ?? '',
            num_salt_beds: r.num_salt_beds ?? '',
            area_per_salt_bed: r.area_per_salt_bed ?? '',
            production_method: r.production_method ?? '',
          });
          setApproved(r.status === 'approved');
          setLoading(false);
        })
        .catch((err) => { setError(err.message); setLoading(false); });
    }
  }, [editingId, isEdit]);

  const selectedEnvironmentReport = environmentReports.find(
    (report) => String(report.barangay_id) === String(form.barangay_id) && report.status === 'approved',
  );

  useEffect(() => {
    if (isEdit || !selectedEnvironmentReport) return;
    setForm((current) => ({
      ...current,
      area_per_salt_bed: selectedEnvironmentReport.area_per_salt_bed ?? current.area_per_salt_bed,
      production_method: selectedEnvironmentReport.production_methods?.[0] || current.production_method,
    }));
  }, [isEdit, selectedEnvironmentReport]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'num_salt_beds' && selectedEnvironmentReport && Number(value) > selectedEnvironmentReport.num_salt_beds) {
      setError(`Beds used cannot exceed the ${selectedEnvironmentReport.num_salt_beds} available beds for this barangay.`);
      return;
    }
    setError(null);
    if (name === 'barangay_id' && value !== String(form.barangay_id)) {
      setForm({
        ...form,
        barangay_id: value,
        num_salt_beds: '',
        area_per_salt_bed: '',
        production_method: '',
      });
      return;
    }
    setForm({ ...form, [name]: value });
  };

  const canProceedFromStep1 = useMemo(() => {
    return (
      form.barangay_id &&
      form.record_date &&
      form.production_volume !== '' &&
      form.num_salt_beds !== '' &&
      Number(form.num_salt_beds) > 0 &&
      (!selectedEnvironmentReport || Number(form.num_salt_beds) <= selectedEnvironmentReport.num_salt_beds) &&
      form.production_method
    );
  }, [form, selectedEnvironmentReport]);

  const handleNext = () => {
    if (step === 0 && canProceedFromStep1) setStep(1);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (approved) {
      setError('This record is approved and can no longer be edited.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let record;
      const productionPayload = {
        barangay_id: Number(form.barangay_id),
        record_date: form.record_date,
        production_volume: Number(form.production_volume),
        num_salt_beds: Number(form.num_salt_beds),
        area_per_salt_bed: form.area_per_salt_bed === '' ? '' : Number(form.area_per_salt_bed),
        production_method: form.production_method,
      };
      if (isEdit) {
        record = await updateRecord(editingId, productionPayload);
      } else {
        record = await createRecord(productionPayload);
      }
      if (onSaved) onSaved(record);
      toastSuccess(
        isEdit ? 'Production report updated.' : 'Production report submitted and is pending review.',
        isEdit ? 'Production report updated' : 'Production report pending',
      );
    } catch (err) {
      const message = err.status === 409
        ? 'A record for this barangay and date already exists.'
        : (err.message || 'Failed to save record.');
      setError(message);
      toastError(message, err.status === 409 ? 'Duplicate record' : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const importProductionRows = async (rows) => {
    const errors = [];
    const prepared = rows.map((row) => {
      const barangay = findBarangay(row, barangays);
      const recordDate = cleanSpreadsheetDate(row.record_date);
      const productionVolume = numberValue(row.production_volume);
      const numSaltBeds = numberValue(row.num_salt_beds);
      const areaPerSaltBed = row.area_per_salt_bed === '' ? null : numberValue(row.area_per_salt_bed);
      const productionMethod = String(row.production_method || '').trim().toLowerCase();
      if (!barangay) errors.push(rowError(row, 'barangay must match a barangay in your municipality.'));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) errors.push(rowError(row, 'record_date must use YYYY-MM-DD.'));
      if (!Number.isFinite(productionVolume) || productionVolume < 0) errors.push(rowError(row, 'production_volume must be zero or greater.'));
      if (!Number.isInteger(numSaltBeds) || numSaltBeds <= 0) errors.push(rowError(row, 'num_salt_beds must be a positive whole number.'));
      if (areaPerSaltBed !== null && (!Number.isFinite(areaPerSaltBed) || areaPerSaltBed < 0)) errors.push(rowError(row, 'area_per_salt_bed must be zero or greater.'));
      if (!PRODUCTION_METHODS.some((method) => method.value === productionMethod)) errors.push(rowError(row, 'production_method must be solar, cooked, or hybrid.'));
      return {
        barangay_id: barangay?.id,
        record_date: recordDate,
        production_volume: productionVolume,
        num_salt_beds: numSaltBeds,
        area_per_salt_bed: areaPerSaltBed,
        production_method: productionMethod,
        rowNumber: row._row_number,
      };
    });
    if (errors.length) throw new Error(errors.join(' '));

    const failures = [];
    let imported = 0;
    for (const row of prepared) {
      try {
        const { rowNumber, ...payload } = row;
        await createRecord(payload);
        imported += 1;
      } catch (importError) {
        failures.push(rowError({ _row_number: row.rowNumber }, importError.message || 'Could not create record.'));
      }
    }
    if (imported) onImported?.();
    if (!imported) throw new Error(failures.join(' ') || 'No production rows were imported.');
    return {
      message: `Imported ${imported} of ${rows.length} production row${rows.length === 1 ? '' : 's'}.${failures.length ? ` ${failures.join(' ')}` : ''}`,
      isError: failures.length > 0,
    };
  };

  const progressValue = ((step + 1) / STEPS.length) * 100;

  const renderStep = () => {
    if (step === 0) {
      return (
        <div className="form-step-card">
          <div className="form-section-title">Production Details</div>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="form-field-label">Municipality</Form.Label>
                <Form.Control value={user?.municipality_name || ''} readOnly aria-label="Assigned municipality" />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="form-field-label">Barangay <span className="text-danger">*</span></Form.Label>
                <Form.Select name="barangay_id" value={form.barangay_id} onChange={handleChange} required disabled={approved}>
                  <option value="">Select barangay…</option>
                  {barangays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="form-field-label">Date Covered <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="date"
                  name="record_date"
                  value={form.record_date}
                  onChange={handleChange}
                  required
                  disabled={approved}
                />
              </Form.Group>
            </Col>
          </Row>

          <Row className="g-3">
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="form-field-label">Production Volume (kg) <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="any"
                  name="production_volume"
                  value={form.production_volume}
                  onChange={handleChange}
                  required
                  disabled={approved}
                  placeholder="e.g. 120"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="form-field-label">Beds Used <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  max={selectedEnvironmentReport?.num_salt_beds}
                  step="1"
                  name="num_salt_beds"
                  value={form.num_salt_beds}
                  onChange={handleChange}
                  required
                  disabled={approved}
                  placeholder={selectedEnvironmentReport ? `Up to ${selectedEnvironmentReport.num_salt_beds}` : 'e.g. 15'}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="form-field-label">Area per Salt Bed (m²)</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="any"
                  name="area_per_salt_bed"
                  value={form.area_per_salt_bed}
                  onChange={handleChange}
                  disabled={approved}
                  readOnly={Boolean(selectedEnvironmentReport)}
                  placeholder="e.g. 250"
                />
              </Form.Group>
            </Col>
          </Row>

          {form.barangay_id && (
            <div className="small text-muted mb-3">
              {selectedEnvironmentReport
                ? `Available beds: ${selectedEnvironmentReport.num_salt_beds}. Enter the number used for this report.`
                : 'No Environment Report is available for this barangay; enter bed details manually.'}
            </div>
          )}

          <Form.Group className="mb-0">
            <Form.Label className="form-field-label">Production Method <span className="text-danger">*</span></Form.Label>
            <Form.Select
              name="production_method"
              value={form.production_method}
              onChange={handleChange}
              required
              disabled={approved}
            >
              {PRODUCTION_METHODS.filter((opt) => (
                !opt.value
                || !selectedEnvironmentReport?.production_methods?.length
                || selectedEnvironmentReport.production_methods.includes(opt.value)
                || opt.value === form.production_method
              )).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="form-step-card">
          <div className="form-section-title">Review Production Report</div>
          <Row className="g-2 mb-3">
            <Col md={6}><strong>Report Type:</strong> Production</Col>
            <Col md={6}><strong>Municipality:</strong> {user?.municipality_name || '—'}</Col>
            <Col md={6}><strong>Barangay:</strong> {barangays.find((b) => String(b.id) === String(form.barangay_id))?.name || '—'}</Col>
            <Col md={6}><strong>Date Covered:</strong> {form.record_date || '—'}</Col>
            <Col md={4}><strong>Volume (kg):</strong> {form.production_volume ?? '—'}</Col>
            <Col md={4}><strong>Beds Used:</strong> {form.num_salt_beds ?? '—'}</Col>
            <Col md={4}><strong>Area per Bed (m²):</strong> {form.area_per_salt_bed ?? '—'}</Col>
            <Col md={12}><strong>Method:</strong> {form.production_method || '—'}</Col>
          </Row>
        </div>
      );
    }
  };

  return (
    <Modal show onHide={onClose} size="lg" centered backdrop="static" className="encoder-form-modal">
      <Modal.Header closeButton className="encoder-form-header">
        <div className="w-100">
          <div>
            <Modal.Title className="encoder-form-title">{isEdit ? 'Edit Production Report' : 'New Production Report'}</Modal.Title>
          </div>
          <div className="encoder-stepper">
            <div className="encoder-stepper-track">
              <div className="encoder-stepper-fill" style={{ width: `${progressValue}%` }} />
            </div>
            <div className="encoder-stepper-steps">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                const isActive = idx === step;
                const isComplete = idx < step;
                return (
                  <div key={s.key} className={`encoder-stepper-item ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}>
                    <div className="encoder-stepper-icon">
                      {isComplete ? <span className="encoder-stepper-check">✓</span> : <Icon size={18} />}
                    </div>
                    <span className="encoder-stepper-label">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal.Header>
      <Modal.Body className="encoder-form-body">
        {loading && (
          <div className="encoder-form-skeleton"><SkeletonForm /></div>
        )}
        {error && <Alert variant="danger" className="encoder-form-alert">{error}</Alert>}
        {approved && (
          <Alert variant="warning" className="encoder-form-alert">
            This record is approved and locked from editing.
          </Alert>
        )}
        {!loading && !isEdit && (
          <div className="d-flex justify-content-end mb-3">
            <ReportImportActions
              templateUrl="/static/templates/production-report-template.csv"
              onImport={importProductionRows}
              disabled={!barangays.length}
            />
          </div>
        )}
        {!loading && (
          <Form onSubmit={step === 1 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
            {renderStep()}
          </Form>
        )}
      </Modal.Body>
      {!loading && (
        <Modal.Footer className="encoder-form-footer">
          <Button variant="link" onClick={onClose} disabled={saving} className="encoder-btn-cancel">Cancel</Button>
          <div className="flex-grow-1" />
          {step > 0 && (
            <Button variant="outline-secondary" onClick={handleBack} disabled={saving || approved} className="encoder-btn-back">
              Back
            </Button>
          )}
            {step < 1 && (
            <Button variant="primary" onClick={handleNext} disabled={saving || approved || !canProceedFromStep1} className="encoder-btn-next">
              Next
            </Button>
          )}
          {step === 1 && (
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={saving || approved}
              className="encoder-btn-submit"
            >
              {saving ? 'Submitting…' : 'Submit Production Report'}
            </Button>
          )}
        </Modal.Footer>
      )}
    </Modal>
  );
}
