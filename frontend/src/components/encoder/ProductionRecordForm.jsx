import React, { useEffect, useMemo, useState } from 'react';
import { Form, Button, Alert, Row, Col, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { getEncoderBarangays, createRecord, updateRecord, getRecord, submitRecord } from '../../services/dataService';

export default function ProductionRecordForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [barangays, setBarangays] = useState([]);
  const [form, setForm] = useState({
    barangay_id: '',
    record_date: '',
    male_producers: '',
    female_producers: '',
    production_volume: '',
    num_salt_beds: '',
    area_per_salt_bed: '',
    notes: '',
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [savedRecord, setSavedRecord] = useState(null);

  useEffect(() => {
    getEncoderBarangays()
      .then((res) => setBarangays(res.barangays || []))
      .catch((err) => setError(err.message));

    if (isEdit) {
      getRecord(id)
        .then((r) => {
          setForm({
            barangay_id: r.barangay_id ?? '',
            record_date: r.record_date || '',
            male_producers: r.male_producers ?? '',
            female_producers: r.female_producers ?? '',
            production_volume: r.production_volume ?? '',
            num_salt_beds: r.num_salt_beds ?? '',
            area_per_salt_bed: r.area_per_salt_bed ?? '',
            notes: r.notes ?? '',
          });
          setLoading(false);
        })
        .catch((err) => { setError(err.message); setLoading(false); });
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const volume = Number(form.production_volume);
  const beds = Number(form.num_salt_beds);
  const outputPerBed = useMemo(() => {
    if (!Number.isFinite(volume) || !Number.isFinite(beds) || beds <= 0) return null;
    return volume / beds;
  }, [volume, beds]);

  const registeredProducers = useMemo(() => {
    const male = Number(form.male_producers);
    const female = Number(form.female_producers);
    if (!Number.isFinite(male) && !Number.isFinite(female)) return '';
    return (Number.isFinite(male) ? male : 0) + (Number.isFinite(female) ? female : 0);
  }, [form.male_producers, form.female_producers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let record;
      if (isEdit) {
        record = await updateRecord(id, form);
      } else {
        record = await createRecord(form);
      }
      setSavedRecord(record);
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

  const handleSubmitForReview = async () => {
    if (!savedRecord?.id) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitRecord(savedRecord.id);
      navigate('/encoder');
    } catch (err) {
      setError(err.message || 'Failed to submit for review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;

  if (savedRecord) {
    return (
      <div className="encoder-form-wrap">
        <h4>Record Saved</h4>
        <Alert variant="success">
          Record #{savedRecord.id} saved as a <strong>draft</strong> for {savedRecord.barangay} on {savedRecord.record_date}.
        </Alert>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="d-flex gap-2">
          <Button variant="primary" onClick={handleSubmitForReview} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit for Review'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/encoder')}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="encoder-form-wrap">
      <h4>{isEdit ? 'Edit Production Record' : 'New Production Record'}</h4>
      {error && <Alert variant="danger">{error}</Alert>}
      <Form onSubmit={handleSubmit}>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Barangay <span className="text-danger">*</span></Form.Label>
              <Form.Select name="barangay_id" value={form.barangay_id} onChange={handleChange} required>
                <option value="">Select barangay…</option>
                {barangays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Date Covered <span className="text-danger">*</span></Form.Label>
              <Form.Control type="date" name="record_date" value={form.record_date} onChange={handleChange} required />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Registered Producers</Form.Label>
              <Form.Control
                type="text"
                readOnly
                value={registeredProducers === '' ? '' : registeredProducers.toLocaleString()}
                placeholder="Auto: male + female"
              />
              <Form.Text className="text-muted">Computed from male + female producers.</Form.Text>
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Male Producers <span className="text-danger">*</span></Form.Label>
              <Form.Control type="number" min="0" step="1" name="male_producers" value={form.male_producers} onChange={handleChange} required />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Female Producers <span className="text-danger">*</span></Form.Label>
              <Form.Control type="number" min="0" step="1" name="female_producers" value={form.female_producers} onChange={handleChange} required />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Total Production Volume (kg) <span className="text-danger">*</span></Form.Label>
              <Form.Control type="number" min="0" step="any" name="production_volume" value={form.production_volume} onChange={handleChange} required />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Number of Salt Beds <span className="text-danger">*</span></Form.Label>
              <Form.Control type="number" min="1" step="1" name="num_salt_beds" value={form.num_salt_beds} onChange={handleChange} required />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Area per Salt Bed (m2)</Form.Label>
              <Form.Control type="number" min="0" step="any" name="area_per_salt_bed" value={form.area_per_salt_bed} onChange={handleChange} />
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mb-3">
          <Form.Label>Output per Salt Bed (derived)</Form.Label>
          <Form.Control
            type="number"
            readOnly
            placeholder="Computed live: volume ÷ salt beds"
            value={outputPerBed !== null ? outputPerBed.toFixed(2) : ''}
          />
          <Form.Text className="text-muted">kg per salt bed — calculated automatically, not a manual input.</Form.Text>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Notes</Form.Label>
          <Form.Control as="textarea" rows={3} name="notes" value={form.notes} onChange={handleChange} placeholder="Production method, challenges, or any other details (optional)" />
        </Form.Group>

        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Save as Draft')}
        </Button>{' '}
        <Button variant="secondary" onClick={() => navigate('/encoder')}>Cancel</Button>
      </Form>
    </div>
  );
}