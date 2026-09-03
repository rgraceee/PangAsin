import React, { useEffect, useMemo, useState } from 'react';
import { Form, Button, Alert, Row, Col, Spinner, Modal } from 'react-bootstrap';
import { getEncoderBarangays, createRecord, updateRecord, getRecord } from '../../services/dataService';

const PRODUCTION_METHODS = [
  { value: '', label: 'Select method…' },
  { value: 'solar', label: 'Solar' },
  { value: 'cooked', label: 'Cooked' },
  { value: 'hybrid', label: 'Hybrid' },
];

export default function ProductionRecordForm({ editingId = null, onClose, onSaved }) {
  const isEdit = Boolean(editingId);

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

  const registeredProducers = useMemo(() => {
    const male = Number(form.male_producers);
    const female = Number(form.female_producers);
    const m = Number.isFinite(male) ? male : 0;
    const f = Number.isFinite(female) ? female : 0;
    if (!form.male_producers && !form.female_producers) return '';
    return (m + f).toLocaleString();
  }, [form.male_producers, form.female_producers]);

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

  return (
    <Modal show onHide={onClose} size="lg" centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? 'Edit Production Record' : 'New Production Record'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading && <div className="text-center py-4"><Spinner animation="border" variant="primary" /></div>}
        {error && <Alert variant="danger">{error}</Alert>}
        {approved && (
          <Alert variant="warning">
            This record is approved and locked from editing.
          </Alert>
        )}
        {!loading && (
          <Form onSubmit={handleSubmit} id="production-record-form">
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Barangay <span className="text-danger">*</span></Form.Label>
                  <Form.Select name="barangay_id" value={form.barangay_id} onChange={handleChange} required disabled={approved}>
                    <option value="">Select barangay…</option>
                    {barangays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Date Covered <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="date"
                    name="record_date"
                    value={form.record_date}
                    onChange={handleChange}
                    required
                    disabled={approved}
                    placeholder="YYYY-MM-DD"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Male Producers <span className="text-danger">*</span></Form.Label>
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
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Female Producers <span className="text-danger">*</span></Form.Label>
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
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Production Method <span className="text-danger">*</span></Form.Label>
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
              </Col>
            </Row>

            <div className="text-muted small mb-3">
              Registered Producers: <strong>{registeredProducers || '—'}</strong>
            </div>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Total Production Volume (kg) <span className="text-danger">*</span></Form.Label>
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
                  <Form.Label>Number of Salt Beds <span className="text-danger">*</span></Form.Label>
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
                  <Form.Label>Area per Salt Bed (m²)</Form.Label>
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
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        {!loading && (
          <Button
            type="submit"
            form="production-record-form"
            variant="primary"
            disabled={saving || approved}
          >
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Save as Draft')}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
