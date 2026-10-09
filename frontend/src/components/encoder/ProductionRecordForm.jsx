import React, { useEffect, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import { getEncoderBarangays, getEncoderEnvironmentReports, createRecord, updateRecord, getRecord } from '../../services/dataService';
import { useToast } from '../Toast';
import { SkeletonForm } from '../Skeleton';
import ReportModal from './ReportModal';
import ReportSection from './ReportSection';
import ReportField from './ReportField';
import ReportSummary from './ReportSummary';
import ReportImportActions from './ReportImportActions';
import { prepareProductionRows, rowError } from './reportImportUtils';
import { formatMT } from '../../utils/volumeFormat';

const PRODUCTION_METHODS = [
  { value: '', label: 'Select method…' },
  { value: 'solar', label: 'Solar' },
  { value: 'cooked', label: 'Cooked' },
  { value: 'hybrid', label: 'Hybrid' },
];

const STEPS = [
  { key: 'production', label: 'Production' },
  { key: 'review', label: 'Review' },
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
  const volumeCapMt = Number(user?.max_monthly_volume_mt) || 2000;
  const [step, setStep] = useState(0);

  const [barangays, setBarangays] = useState([]);
  const [environmentReports, setEnvironmentReports] = useState([]);
  const [form, setForm] = useState({
    barangay_id: '',
    record_date: localDateString(),
    production_volume_mt: '',
    num_salt_beds: '',
    area_per_salt_bed: '',
    production_method: '',
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [approved, setApproved] = useState(false);
  // WHAT: Nag-track kung may binago ang user. WHY: para may confirm bago isara.
  const [touched, setTouched] = useState(false);

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
            production_volume_mt: r.production_volume_mt ?? '',
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
  const selectedBarangay = barangays.find((b) => String(b.id) === String(form.barangay_id));
  const historicalMaxMt = Number(selectedBarangay?.historical_max_volume_mt) || 0;
  const volumeSoftWarning = (
    form.production_volume_mt !== ''
    && historicalMaxMt > 0
    && Number(form.production_volume_mt) > historicalMaxMt * 3
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
    setTouched(true);
    if (name === 'num_salt_beds' && selectedEnvironmentReport && Number(value) > selectedEnvironmentReport.num_salt_beds) {
      setError(`Beds used cannot exceed the ${selectedEnvironmentReport.num_salt_beds} available beds for this barangay.`);
      return;
    }
    if (name === 'production_volume_mt' && value !== '' && Number(value) > volumeCapMt) {
      setError(`Production volume cannot exceed ${volumeCapMt} metric tons per month.`);
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
      form.production_volume_mt !== '' &&
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
        production_volume_mt: Number(form.production_volume_mt),
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

  // WHAT: Preview lang — validation + soft warning bago pa mag-import.
  // WHY: Nakikita agad ng encoder ang 3x-historical warning bago kanselahin.
  const previewProductionRows = (rows) => {
    const { errors, warnings } = prepareProductionRows(rows, barangays, volumeCapMt);
    return { errors, warnings };
  };

  const importProductionRows = async (rows) => {
    const { errors, warnings, prepared } = prepareProductionRows(rows, barangays, volumeCapMt);
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
    const warningNote = warnings.length ? ` Note: ${warnings.join(' ')}` : '';
    return {
      message: `Imported ${imported} of ${rows.length} production row${rows.length === 1 ? '' : 's'}.${failures.length ? ` ${failures.join(' ')}` : ''}${warningNote}`,
      isError: failures.length > 0,
    };
  };

  const barangayName = barangays.find((b) => String(b.id) === String(form.barangay_id))?.name;
  const methodLabel = PRODUCTION_METHODS.find((m) => m.value === form.production_method)?.label;

  const renderStep = () => {
    if (step === 0) {
      return (
        <ReportSection title="Production Details">
          <div className="ui-form-grid">
            {/* WHAT: Read-only municipality na may lock icon. WHY: fixed sa assigned LGU. */}
            <ReportField label="Municipality" readOnly>
              <Form.Control value={user?.municipality_name || ''} readOnly aria-label="Assigned municipality" />
            </ReportField>
            <ReportField label="Barangay" required htmlFor="production-barangay">
              <Form.Select
                id="production-barangay"
                name="barangay_id"
                value={form.barangay_id}
                onChange={handleChange}
                required
                disabled={approved}
              >
                <option value="">Select barangay…</option>
                {barangays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Form.Select>
            </ReportField>
            <ReportField label="Date Covered" required htmlFor="production-date">
              <Form.Control
                id="production-date"
                type="date"
                name="record_date"
                value={form.record_date}
                onChange={handleChange}
                required
                disabled={approved}
              />
            </ReportField>
            <ReportField label="Production Method" required htmlFor="production-method">
              <Form.Select
                id="production-method"
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
            </ReportField>
          </div>

          <div className="ui-form-grid ui-form-grid--3">
            <ReportField
              label="Production Volume"
              required
              unit="MT"
              htmlFor="production-volume"
              hint={`Maximum ${volumeCapMt} MT per month.`}
            >
              <Form.Control
                id="production-volume"
                type="number"
                min="0"
                step="any"
                name="production_volume_mt"
                value={form.production_volume_mt}
                onChange={handleChange}
                required
                disabled={approved}
                placeholder="e.g. 120"
              />
            </ReportField>
            <ReportField
              label="Beds Used"
              required
              htmlFor="production-beds"
              hint={selectedEnvironmentReport
                ? `Available: ${selectedEnvironmentReport.num_salt_beds} beds.`
                : (form.barangay_id ? 'No Environment Report for this barangay; enter bed details manually.' : undefined)}
            >
              <Form.Control
                id="production-beds"
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
            </ReportField>
            <ReportField
              label="Area per Salt Bed"
              unit="m²"
              htmlFor="production-area"
              readOnly={Boolean(selectedEnvironmentReport)}
            >
              <Form.Control
                id="production-area"
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
            </ReportField>
          </div>

          {volumeSoftWarning && (
            <div className="ui-import-panel ui-import-panel--warning" role="status">
              This volume is more than 3x the highest recorded month for {selectedBarangay?.name}. Double-check the unit (metric tons) and value.
            </div>
          )}
        </ReportSection>
      );
    }

    if (step === 1) {
      return (
        <ReportSummary
          sections={[
            {
              title: 'Review Production Report',
              onEdit: () => setStep(0),
              rows: [
                ['Report Type', 'Production'],
                ['Municipality', user?.municipality_name || '—'],
                ['Barangay', barangayName || '—'],
                ['Date Covered', form.record_date || '—'],
                ['Volume', form.production_volume_mt !== '' ? `${formatMT(form.production_volume_mt)} MT` : '—'],
                ['Beds Used', form.num_salt_beds !== '' ? form.num_salt_beds : '—'],
                ['Area per Bed', form.area_per_salt_bed !== '' ? `${form.area_per_salt_bed} m²` : '—'],
                ['Method', methodLabel || '—'],
              ],
            },
          ]}
        />
      );
    }
  };

  return (
    <ReportModal
      title={isEdit ? 'Edit Production Report' : 'New Production Report'}
      municipality={user?.municipality_name}
      steps={STEPS}
      currentStep={step}
      onClose={onClose}
      dirty={touched}
      busy={saving}
      footer={(
        <>
          <button type="button" className="ui-btn-text" onClick={onClose} disabled={saving}>Cancel</button>
          <div className="ui-report-foot__spacer" />
          {step > 0 && (
            <button type="button" className="ui-btn-outline" onClick={handleBack} disabled={saving || approved}>Back</button>
          )}
          {step < 1 && (
            <button
              type="button"
              className="ui-btn-primary"
              onClick={handleNext}
              disabled={saving || approved || !canProceedFromStep1}
              title={!canProceedFromStep1 ? 'Fill in all required fields to continue.' : undefined}
            >
              Next
            </button>
          )}
          {step === 1 && (
            <button type="button" className="ui-btn-primary" onClick={handleSubmit} disabled={saving || approved}>
              {saving ? 'Submitting…' : 'Submit Production Report'}
            </button>
          )}
        </>
      )}
    >
      {loading && <div className="ui-report-skeleton"><SkeletonForm /></div>}
      {error && <div className="ui-import-panel ui-import-panel--warning ui-report-alert" role="alert">{error}</div>}
      {approved && (
        <div className="ui-import-panel ui-import-panel--warning ui-report-alert" role="status">
          This record is approved and locked from editing.
        </div>
      )}
      {!loading && !isEdit && (
        <ReportImportActions
          templateUrl="/static/templates/production-report-template.csv"
          onImport={importProductionRows}
          onValidate={previewProductionRows}
          disabled={!barangays.length}
        />
      )}
      {!loading && (
        <Form onSubmit={step === 1 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
          {renderStep()}
        </Form>
      )}
    </ReportModal>
  );
}
