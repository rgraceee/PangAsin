import React, { useEffect, useState } from 'react';
import { Form } from 'react-bootstrap';
import { Plus } from 'lucide-react';
import {
  createEncoderBarangay,
  createEncoderEnvironmentReport,
  getEncoderBarangays,
} from '../../services/dataService';
import { useToast } from '../Toast';
import ReportModal from './ReportModal';
import { ReportSection, ReportField, ReportSummary } from './ReportFormParts';
import ReportImportActions from './ReportImportActions';
import { SkeletonForm } from '../Skeleton';

const METHODS = [
  { id: 'cooked', label: 'Cooked' },
  { id: 'solar', label: 'Solar' },
  { id: 'hybrid', label: 'Hybrid' },
];

const STEPS = [
  { key: 'environment', label: 'Environment' },
  { key: 'review', label: 'Review' },
];

export default function EnvironmentReportForm({ user, onClose, onSaved, onImport, barangays: availableBarangays }) {
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

  // WHAT: May unsaved input ba? WHY: para may confirm bago isara ang modal.
  const hasData = Boolean(
    form.barangay_id
    || form.num_salt_beds
    || form.area_per_salt_bed
    || form.production_area_size
    || form.production_methods.length,
  );

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
    <ReportModal
      title="New Environment Report"
      municipality={user?.municipality_name}
      steps={STEPS}
      currentStep={step}
      onClose={onClose}
      dirty={hasData}
      busy={saving}
      footer={step === 0 ? (
        <>
          <button type="button" className="ui-btn-text" onClick={onClose} disabled={saving}>Cancel</button>
          <div className="ui-report-foot__spacer" />
          <button
            type="submit"
            form="environment-report-form"
            className="ui-btn-primary"
            disabled={!canReview}
            title={!canReview ? 'Fill in all required fields to continue.' : undefined}
          >
            Review
          </button>
        </>
      ) : (
        <>
          <button type="button" className="ui-btn-text" onClick={onClose} disabled={saving}>Cancel</button>
          <div className="ui-report-foot__spacer" />
          <button type="button" className="ui-btn-outline" onClick={() => setStep(0)} disabled={saving}>Edit</button>
          <button type="button" className="ui-btn-primary" onClick={submitReport} disabled={saving}>
            {saving ? 'Submitting…' : 'Submit Environment Report'}
          </button>
        </>
      )}
    >
      {error && <div className="ui-import-panel ui-import-panel--warning ui-report-alert" role="alert">{error}</div>}
      {!loading && (
        <ReportImportActions
          templateUrl="/static/templates/environment-report-template.csv"
          onImport={onImport}
          disabled={!barangays.length}
        />
      )}
      {loading ? (
        <div className="ui-report-skeleton"><SkeletonForm /></div>
      ) : step === 0 ? (
        <Form id="environment-report-form" onSubmit={goToReview}>
          <ReportSection title="Environment Details">
            <div className="ui-form-grid">
              <ReportField label="Municipality" readOnly>
                <Form.Control value={user?.municipality_name || ''} readOnly aria-label="Assigned municipality" />
              </ReportField>
              <ReportField label="Barangay" required htmlFor="environment-barangay">
                <Form.Select
                  id="environment-barangay"
                  required
                  value={form.barangay_id}
                  onChange={(event) => setForm((current) => ({ ...current, barangay_id: event.target.value }))}
                >
                  <option value="">Select barangay…</option>
                  {barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}
                </Form.Select>
              </ReportField>
            </div>

            {!addingBarangay ? (
              <div className="ui-add-row">
                <button type="button" className="ui-btn-ghost" onClick={() => setAddingBarangay(true)}>
                  <Plus size={15} aria-hidden="true" />Add a barangay
                </button>
              </div>
            ) : (
              <div className="ui-inline-add">
                <Form.Control
                  aria-label="New barangay name"
                  placeholder="Barangay name"
                  maxLength={100}
                  value={newBarangay}
                  onChange={(event) => setNewBarangay(event.target.value)}
                />
                <button type="button" className="ui-btn-primary" onClick={handleAddBarangay} disabled={!newBarangay.trim()}>Add</button>
                <button type="button" className="ui-btn-outline" onClick={() => setAddingBarangay(false)}>Cancel</button>
              </div>
            )}

            <div className="ui-form-grid ui-form-grid--3">
              <ReportField label="Number of Salt Beds" required htmlFor="environment-beds">
                <Form.Control
                  id="environment-beds"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={form.num_salt_beds}
                  onChange={(event) => setForm((current) => ({ ...current, num_salt_beds: event.target.value }))}
                />
              </ReportField>
              <ReportField label="Area per Salt Bed" required unit="m²" htmlFor="environment-area-bed">
                <Form.Control
                  id="environment-area-bed"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.area_per_salt_bed}
                  onChange={(event) => setForm((current) => ({ ...current, area_per_salt_bed: event.target.value }))}
                />
              </ReportField>
              <ReportField label="Production Area Size" required unit="m²" htmlFor="environment-area-size">
                <Form.Control
                  id="environment-area-size"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.production_area_size}
                  onChange={(event) => setForm((current) => ({ ...current, production_area_size: event.target.value }))}
                />
              </ReportField>
            </div>

            <div className="ui-field">
              <span className="ui-field__label">Production Methods <span className="ui-field__req" aria-hidden="true">*</span></span>
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
            </div>
          </ReportSection>
        </Form>
      ) : (
        <ReportSummary
          sections={[{
            title: 'Review Environment Report',
            onEdit: () => setStep(0),
            rows: [
              ['Report Type', 'Environment'],
              ['Municipality', user?.municipality_name || '—'],
              ['Barangay', barangays.find((barangay) => String(barangay.id) === String(form.barangay_id))?.name || '—'],
              ['Number of Salt Beds', form.num_salt_beds || '—'],
              ['Area per Salt Bed', form.area_per_salt_bed !== '' ? `${form.area_per_salt_bed} m²` : '—'],
              ['Production Area', form.production_area_size !== '' ? `${form.production_area_size} m²` : '—'],
              ['Production Methods', form.production_methods.map((method) => method[0].toUpperCase() + method.slice(1)).join(', ') || '—'],
            ],
          }]}
        />
      )}
    </ReportModal>
  );
}
