import React, { useEffect, useState } from 'react';
import { Form } from 'react-bootstrap';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { createEncoderProducerReport, getEncoderBarangays } from '../../services/dataService';
import { useToast } from '../Toast';
import ReportModal from './ReportModal';
import ReportSection from './ReportSection';
import ReportField from './ReportField';
import ReportSummary from './ReportSummary';
import ReportImportActions from './ReportImportActions';
import { findBarangay, numberValue, rowError } from './reportImportUtils';

const SEX_OPTIONS = ['Male', 'Female', 'Other'];
const STEPS = [
  { key: 'producer', label: 'Salt Farmer' },
  { key: 'review', label: 'Review' },
];

function emptyProducer() {
  return { barangay_id: '', name: '', age: '', sex: '' };
}

export default function ProducerReportForm({ user, onClose, onSubmitted, barangays: availableBarangays }) {
  const { toastSuccess, toastError } = useToast();
  const [barangays, setBarangays] = useState(availableBarangays || []);
  const [entries, setEntries] = useState([emptyProducer()]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (availableBarangays?.length) {
      setBarangays(availableBarangays);
      return;
    }
    getEncoderBarangays()
      .then((result) => setBarangays(result.barangays || []))
      .catch((err) => setError(err.message || 'Could not load barangays.'));
  }, [availableBarangays]);

  const updateEntry = (index, changes) => {
    setEntries((current) => current.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, ...changes } : entry
    )));
  };

  const canReview = entries.length > 0 && entries.every((entry) => (
    entry.barangay_id && entry.name.trim() && entry.age !== '' && Number(entry.age) >= 0 && Number(entry.age) <= 120 && entry.sex
  ));

  // WHAT: May unsaved input ba? WHY: para may confirm bago isara ang modal.
  const hasData = entries.length > 1
    || entries.some((entry) => entry.barangay_id || entry.name || entry.age || entry.sex);

  const submitReport = async () => {
    setError('');
    setSaving(true);
    try {
      const report = await createEncoderProducerReport({
        entries: entries.map((entry) => ({ ...entry, barangay_id: Number(entry.barangay_id) })),
      });
      toastSuccess('Salt farmer report submitted and is pending review.', 'Salt farmer report pending');
      onSubmitted?.(report);
      onClose();
    } catch (err) {
      const message = err.data?.errors?.join(' ') || err.message || 'Could not submit the salt farmer report.';
      setError(message);
      toastError(message, 'Could not submit report');
    } finally {
      setSaving(false);
    }
  };

  const importProducerRows = async (rows) => {
    const errors = [];
    const prepared = rows.map((row) => {
      const barangay = findBarangay(row, barangays);
      const name = String(row.name || '').trim();
      const age = numberValue(row.age);
      const sex = String(row.sex || '').trim().toLowerCase();
      if (!barangay) errors.push(rowError(row, 'barangay must match a barangay in your municipality.'));
      if (!name || name.length > 150) errors.push(rowError(row, 'name is required and must be 150 characters or fewer.'));
      if (!Number.isInteger(age) || age < 0 || age > 120) errors.push(rowError(row, 'age must be a whole number from 0 to 120.'));
      if (!['male', 'female', 'other'].includes(sex)) errors.push(rowError(row, 'sex must be Male, Female, or Other.'));
      return {
        barangay_id: barangay?.id,
        name,
        age,
        sex: sex ? sex[0].toUpperCase() + sex.slice(1) : sex,
      };
    });
    if (errors.length) throw new Error(errors.join(' '));
    await createEncoderProducerReport({ entries: prepared });
    onSubmitted?.();
    return `Submitted ${prepared.length} salt farmer${prepared.length === 1 ? '' : 's'} for review.`;
  };

  return (
    <ReportModal
      title="New Salt Farmer Report"
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
            type="button"
            className="ui-btn-primary"
            onClick={() => { setError(''); setStep(1); }}
            disabled={!canReview}
            title={!canReview ? 'Complete every salt farmer row to continue.' : undefined}
          >
            Review
          </button>
        </>
      ) : (
        <>
          <button type="button" className="ui-btn-text" onClick={onClose} disabled={saving}>Cancel</button>
          <div className="ui-report-foot__spacer" />
          <button type="button" className="ui-btn-outline" onClick={() => setStep(0)} disabled={saving}>
            <Pencil size={14} aria-hidden="true" />Edit
          </button>
          <button type="button" className="ui-btn-primary" onClick={submitReport} disabled={saving}>
            {saving ? 'Submitting…' : 'Submit Salt Farmer Report'}
          </button>
        </>
      )}
    >
      {error && <div className="ui-import-panel ui-import-panel--warning ui-report-alert" role="alert">{error}</div>}
      <ReportImportActions
        templateUrl="/static/templates/producer-report-template.csv"
        onImport={importProducerRows}
        disabled={!barangays.length}
      />
      {step === 0 ? (
        <ReportSection title="Salt Farmer Details">
          <div className="ui-form-grid">
            <ReportField label="Municipality" readOnly>
              <Form.Control value={user?.municipality_name || ''} readOnly aria-label="Assigned municipality" />
            </ReportField>
          </div>
          <div className="ui-report-table-wrap">
            <table className="ui-report-table">
              <thead>
                <tr>
                  <th>Barangay</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Sex</th>
                  <th aria-label="Row actions" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={index}>
                    <td>
                      <Form.Select
                        aria-label={`Barangay for salt farmer ${index + 1}`}
                        value={entry.barangay_id}
                        onChange={(event) => updateEntry(index, { barangay_id: event.target.value })}
                      >
                        <option value="">Select…</option>
                        {barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}
                      </Form.Select>
                    </td>
                    <td>
                      <Form.Control
                        aria-label={`Name for salt farmer ${index + 1}`}
                        maxLength={150}
                        value={entry.name}
                        onChange={(event) => updateEntry(index, { name: event.target.value })}
                        placeholder="Full name"
                      />
                    </td>
                    <td style={{ width: 92 }}>
                      <Form.Control
                        aria-label={`Age for salt farmer ${index + 1}`}
                        type="number"
                        min="0"
                        max="120"
                        step="1"
                        value={entry.age}
                        onChange={(event) => updateEntry(index, { age: event.target.value })}
                        placeholder="Age"
                      />
                    </td>
                    <td style={{ width: 132 }}>
                      <Form.Select
                        aria-label={`Sex for salt farmer ${index + 1}`}
                        value={entry.sex}
                        onChange={(event) => updateEntry(index, { sex: event.target.value })}
                      >
                        <option value="">Select…</option>
                        {SEX_OPTIONS.map((sex) => <option key={sex} value={sex}>{sex}</option>)}
                      </Form.Select>
                    </td>
                    <td style={{ width: 44 }}>
                      {entries.length > 1 && (
                        <button
                          type="button"
                          className="ui-report-row-remove"
                          aria-label={`Remove salt farmer ${index + 1}`}
                          onClick={() => setEntries((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ui-add-row">
            <button type="button" className="ui-btn-ghost" onClick={() => setEntries((current) => [...current, emptyProducer()])}>
              <Plus size={15} aria-hidden="true" />Add row
            </button>
          </div>
        </ReportSection>
      ) : (
        <>
          <ReportSummary
            sections={[{
              title: 'Review Salt Farmer Report',
              onEdit: () => setStep(0),
              rows: [
                ['Report Type', 'Salt Farmer'],
                ['Municipality', user?.municipality_name || '—'],
                ['Salt Farmers', entries.length],
              ],
            }]}
          />
          <div className="ui-report-table-wrap">
            <table className="ui-report-table">
              <thead><tr><th>Salt Farmer</th><th>Barangay</th><th>Age</th><th>Sex</th></tr></thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={index}>
                    <td>{entry.name || '—'}</td>
                    <td>{barangays.find((barangay) => String(barangay.id) === String(entry.barangay_id))?.name || '—'}</td>
                    <td>{entry.age === '' ? '—' : entry.age}</td>
                    <td>{entry.sex || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ReportModal>
  );
}
