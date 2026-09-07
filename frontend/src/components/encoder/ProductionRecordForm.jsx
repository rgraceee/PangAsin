import React, { useEffect, useMemo, useState } from 'react';
import { Form, Button, Alert, Row, Col, Spinner, Modal } from 'react-bootstrap';
import { getEncoderBarangays, createRecord, updateRecord, getRecord } from '../../services/dataService';
import { Factory, Users, CheckCircle2 } from 'lucide-react';

const PRODUCTION_METHODS = [
  { value: '', label: 'Select method…' },
  { value: 'solar', label: 'Solar' },
  { value: 'cooked', label: 'Cooked' },
  { value: 'hybrid', label: 'Hybrid' },
];

const AGE_BUCKETS = [
  { key: 'producers_18_30', label: '18-30' },
  { key: 'producers_31_40', label: '31-40' },
  { key: 'producers_41_50', label: '41-50' },
  { key: 'producers_51_60', label: '51-60' },
  { key: 'producers_61_plus', label: '61+' },
];

const STEPS = [
  { key: 'production', label: 'Production', icon: Factory },
  { key: 'producer', label: 'Producer', icon: Users },
  { key: 'review', label: 'Review', icon: CheckCircle2 },
];

export default function ProductionRecordForm({ editingId = null, onClose, onSaved }) {
  const isEdit = Boolean(editingId);
  const [step, setStep] = useState(0);

  const [barangays, setBarangays] = useState([]);
  const [form, setForm] = useState({
    barangay_id: '',
    record_date: '',
    male_producers: '',
    female_producers: '',
    production_volume: '',
    num_salt_beds: '',
    area_per_salt_bed: '',
    production_method: '',
    producers_18_30: '',
    producers_31_40: '',
    producers_41_50: '',
    producers_51_60: '',
    producers_61_plus: '',
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    getEncoderBarangays()
      .then((res) => setBarangays(res.barangays || []))
      .catch((err) => setError(err.message));

    if (isEdit) {
      getRecord(editingId)
        .then((r) => {
          setForm({
            barangay_id: r.barangay_id ?? '',
            record_date: r.record_date || '',
            male_producers: r.male_producers ?? '',
            female_producers: r.female_producers ?? '',
            production_volume: r.production_volume ?? '',
            num_salt_beds: r.num_salt_beds ?? '',
            area_per_salt_bed: r.area_per_salt_bed ?? '',
            production_method: r.production_method ?? '',
            producers_18_30: r.producers_18_30 ?? '',
            producers_31_40: r.producers_31_40 ?? '',
            producers_41_50: r.producers_41_50 ?? '',
            producers_51_60: r.producers_51_60 ?? '',
            producers_61_plus: r.producers_61_plus ?? '',
          });
          setApproved(r.status === 'approved');
          setLoading(false);
        })
        .catch((err) => { setError(err.message); setLoading(false); });
    }
  }, [editingId, isEdit]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAgeChange = (key, rawValue) => {
    const totalProducers = (Number(form.male_producers) || 0) + (Number(form.female_producers) || 0);
    const currentAgeSum = AGE_BUCKETS.reduce((sum, b) => {
      if (b.key === key) return sum;
      return sum + (Number(form[b.key]) || 0);
    }, 0);
    const nextValue = rawValue === '' ? '' : Math.max(0, Number(rawValue) || 0);
    if (totalProducers > 0 && typeof nextValue === 'number' && currentAgeSum + nextValue > totalProducers) {
      return;
    }
    setForm({ ...form, [key]: nextValue });
  };

  const registeredProducers = useMemo(() => {
    const male = Number(form.male_producers);
    const female = Number(form.female_producers);
    const m = Number.isFinite(male) ? male : 0;
    const f = Number.isFinite(female) ? female : 0;
    if (!form.male_producers && !form.female_producers) return '';
    return (m + f).toLocaleString();
  }, [form.male_producers, form.female_producers]);

  const totalProducers = useMemo(() => {
    return (Number(form.male_producers) || 0) + (Number(form.female_producers) || 0);
  }, [form.male_producers, form.female_producers]);

  const ageSum = useMemo(() => {
    return AGE_BUCKETS.reduce((sum, b) => sum + (Number(form[b.key]) || 0), 0);
  }, [form]);

  const ageAllocated = useMemo(() => {
    return totalProducers > 0 ? `${ageSum} of ${totalProducers} allocated` : '';
  }, [ageSum, totalProducers]);

  const ageValid = useMemo(() => {
    if (totalProducers <= 0) return true;
    return ageSum === totalProducers;
  }, [ageSum, totalProducers]);

  const canProceedFromStep1 = useMemo(() => {
    return (
      form.barangay_id &&
      form.record_date &&
      form.production_volume !== '' &&
      form.num_salt_beds !== '' &&
      form.production_method
    );
  }, [form]);

  const canProceedFromStep2 = useMemo(() => {
    if (!ageValid) return false;
    return (
      form.male_producers !== '' &&
      form.female_producers !== '' &&
      Number(form.male_producers) >= 0 &&
      Number(form.female_producers) >= 0
    );
  }, [form, ageValid]);

  const handleNext = () => {
    if (step === 0 && canProceedFromStep1) setStep(1);
    else if (step === 1 && canProceedFromStep2) setStep(2);
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
    if (!ageValid) {
      setError('Age bracket totals must equal total producers before submitting.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let record;
      if (isEdit) {
        record = await updateRecord(editingId, form);
      } else {
        record = await createRecord(form);
      }
      if (onSaved) onSaved(record);
    } catch (err) {
      if (err.status === 409) {
        setError('A record for this barangay and date already exists.');
      } else {
        setError(err.message || 'Failed to save record.');
      }
    } finally {
      setSaving(false);
    }
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
                <Form.Label className="form-field-label">Number of Salt Beds <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  step="1"
                  name="num_salt_beds"
                  value={form.num_salt_beds}
                  onChange={handleChange}
                  required
                  disabled={approved}
                  placeholder="e.g. 15"
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
                  placeholder="e.g. 250"
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-0">
            <Form.Label className="form-field-label">Production Method <span className="text-danger">*</span></Form.Label>
            <Form.Select
              name="production_method"
              value={form.production_method}
              onChange={handleChange}
              required
              disabled={approved}
            >
              {PRODUCTION_METHODS.map((opt) => (
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
          <div className="form-section-title">Producer Details</div>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="form-field-label">Male Producers <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="1"
                  name="male_producers"
                  value={form.male_producers}
                  onChange={handleChange}
                  required
                  disabled={approved}
                  placeholder="e.g. 7"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="form-field-label">Female Producers <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="1"
                  name="female_producers"
                  value={form.female_producers}
                  onChange={handleChange}
                  required
                  disabled={approved}
                  placeholder="e.g. 5"
                />
              </Form.Group>
            </Col>
          </Row>

          <div className="form-meta-line mb-3">
            Registered Producers: <strong>{registeredProducers || '—'}</strong>
          </div>

          <Form.Group className="mb-0">
            <Form.Label className="form-field-label">Producers by Age Bracket</Form.Label>
            <Row className="g-2">
              {AGE_BUCKETS.map((bucket) => (
                <Col md={4} key={bucket.key}>
                  <Form.Group className="mb-2">
                    <Form.Label className="form-field-label-small">{bucket.label}</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      step="1"
                      name={bucket.key}
                      value={form[bucket.key]}
                      onChange={(e) => handleAgeChange(bucket.key, e.target.value)}
                      disabled={approved}
                      placeholder="0"
                    />
                  </Form.Group>
                </Col>
              ))}
            </Row>
            {ageAllocated && (
              <div className={`small mt-2 fw-semibold ${ageValid ? 'text-success' : 'text-danger'}`}>
                {ageAllocated}
                {!ageValid && totalProducers > 0 && (
                  <span> — must equal {totalProducers}</span>
                )}
              </div>
            )}
          </Form.Group>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="form-step-card">
          <div className="form-section-title">Production Details</div>
          <Row className="g-2 mb-3">
            <Col md={6}><strong>Barangay:</strong> {barangays.find((b) => String(b.id) === String(form.barangay_id))?.name || '—'}</Col>
            <Col md={6}><strong>Date Covered:</strong> {form.record_date || '—'}</Col>
            <Col md={4}><strong>Volume (kg):</strong> {form.production_volume ?? '—'}</Col>
            <Col md={4}><strong>Salt Beds:</strong> {form.num_salt_beds ?? '—'}</Col>
            <Col md={4}><strong>Area per Bed (m²):</strong> {form.area_per_salt_bed ?? '—'}</Col>
            <Col md={12}><strong>Method:</strong> {form.production_method || '—'}</Col>
          </Row>

          <div className="form-section-title">Producer Details</div>
          <Row className="g-2 mb-3">
            <Col md={4}><strong>Male Producers:</strong> {form.male_producers ?? '—'}</Col>
            <Col md={4}><strong>Female Producers:</strong> {form.female_producers ?? '—'}</Col>
            <Col md={4}><strong>Registered Producers:</strong> {registeredProducers || '—'}</Col>
          </Row>
          <Row className="g-2">
            <Col md={2}><strong>18-30:</strong> {form.producers_18_30 ?? '—'}</Col>
            <Col md={2}><strong>31-40:</strong> {form.producers_31_40 ?? '—'}</Col>
            <Col md={2}><strong>41-50:</strong> {form.producers_41_50 ?? '—'}</Col>
            <Col md={2}><strong>51-60:</strong> {form.producers_51_60 ?? '—'}</Col>
            <Col md={2}><strong>61+:</strong> {form.producers_61_plus ?? '—'}</Col>
            <Col md={2}><strong>Allocated:</strong> {ageSum} / {totalProducers}</Col>
          </Row>
        </div>
      );
    }
  };

  return (
    <Modal show onHide={onClose} size="lg" centered backdrop="static" className="encoder-form-modal">
      <Modal.Header closeButton className="encoder-form-header">
        <div className="w-100">
          <Modal.Title className="encoder-form-title">{isEdit ? 'Edit Production Record' : 'New Production Record'}</Modal.Title>
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
        {loading && <div className="text-center py-4"><Spinner animation="border" variant="primary" /></div>}
        {error && <Alert variant="danger" className="encoder-form-alert">{error}</Alert>}
        {approved && (
          <Alert variant="warning" className="encoder-form-alert">
            This record is approved and locked from editing.
          </Alert>
        )}
        {!loading && (
          <Form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
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
          {step < 2 && (
            <Button variant="primary" onClick={handleNext} disabled={saving || approved || (step === 0 ? !canProceedFromStep1 : !canProceedFromStep2)} className="encoder-btn-next">
              Next
            </Button>
          )}
          {step === 2 && (
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={saving || approved || !ageValid}
              className="encoder-btn-submit"
            >
              {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Save as Draft')}
            </Button>
          )}
        </Modal.Footer>
      )}
    </Modal>
  );
}
