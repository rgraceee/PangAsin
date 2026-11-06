import React, { useEffect, useState } from 'react';
import { Form } from 'react-bootstrap';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { createEncoderProducerReport, getEncoderBarangays } from '../../services/dataService';
import { useToast } from '../Toast';
import ReportModal from './ReportModal';
import { ReportSection, ReportField, ReportSummary } from './ReportFormParts';
import ReportImportActions from './ReportImportActions';
import { findBarangay, numberValue, rowError } from './reportImportUtils';

const SEX_OPTIONS = ['Male', 'Female', 'Other'];
const PRODUCTION_METHOD_OPTIONS = [
  { value: 'solar', label: 'Solar' },
  { value: 'cooked', label: 'Cooked' },
  { value: 'hybrid', label: 'Hybrid' },
];
const AGE_BRACKET_OPTIONS = ['18-30', '31-40', '41-50', '51-60', '61+'];
const STEPS = [
  { key: 'producer', label: 'Salt Farmer' },
  { key: 'review', label: 'Review' },
];

function emptyProducer() {
  return {
    barangay_id: '',
    name: '',
    first_name: '',
    last_name: '',
    age: '',
    age_bracket: '',
    sex: '',
    address: '',
    salt_farm_owner: '',
    designation: '',
    business_classification: '',
    contact_number: '',
    production_method: '',
  };
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
    entry.barangay_id
    && (entry.name.trim() || (entry.first_name.trim() && entry.last_name.trim()))
    && (entry.age === '' || (Number.isInteger(Number(entry.age)) && Number(entry.age) >= 0 && Number(entry.age) <= 120))
    && (!entry.sex || SEX_OPTIONS.includes(entry.sex))
  ));

  // WHAT: May unsaved input ba? WHY: para may confirm bago isara ang modal.
  const hasData = entries.length > 1
    || entries.some((entry) => Object.entries(entry).some(([key, value]) => key !== 'barangay_id' && value));

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
      const firstName = String(row.first_name || '').trim();
      const lastName = String(row.last_name || '').trim();
      const name = String(row.name || `${firstName} ${lastName}`).trim();
      const rawAge = row.age;
      const age = rawAge == null || String(rawAge).trim() === '' ? null : numberValue(rawAge);
      const ageBracket = String(row.age_bracket || '').trim();
      const sex = String(row.sex || '').trim().toLowerCase();
      const productionMethod = String(row.production_method || row.method || '').trim().toLowerCase();
      const farmOwner = String(row.salt_farm_owner || row['name_of_salt_farm/owner'] || row.name_of_salt_farm_owner || '').trim();
      const contactNumber = String(row.contact_number || row.contact_no || '').trim();
      const address = String(row.address || '').trim();
      if (!barangay) errors.push(rowError(row, 'barangay must match a barangay in your municipality.'));
      if (!name || name.length > 150) errors.push(rowError(row, 'name is required and must be 150 characters or fewer.'));
      if (age != null && (!Number.isInteger(age) || age < 0 || age > 120)) errors.push(rowError(row, 'age must be a whole number from 0 to 120.'));
      if (ageBracket && !AGE_BRACKET_OPTIONS.includes(ageBracket)) errors.push(rowError(row, 'age_bracket must be 18-30, 31-40, 41-50, 51-60, or 61+.'));
      if (address.length > 255) errors.push(rowError(row, 'address must be 255 characters or fewer.'));
      if (sex && !['male', 'female', 'other'].includes(sex)) errors.push(rowError(row, 'sex must be Male, Female, or Other.'));
      if (productionMethod && !PRODUCTION_METHOD_OPTIONS.some((method) => method.value === productionMethod)) {
        errors.push(rowError(row, 'production method must be Solar, Cooked, or Hybrid.'));
      }
      return {
        barangay_id: barangay?.id,
        name,
        first_name: firstName,
        last_name: lastName,
        age,
        age_bracket: ageBracket || null,
        sex: sex ? sex[0].toUpperCase() + sex.slice(1) : null,
        address,
        salt_farm_owner: farmOwner,
        designation: String(row.designation || '').trim(),
        business_classification: String(row.business_classification || '').trim(),
        contact_number: contactNumber,
        production_method: productionMethod || null,
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
                  <th>Age Bracket</th>
                  <th>Sex</th>
                  <th>Address</th>
                  <th>Name of Salt Farm/Owner</th>
                  <th>Designation</th>
                  <th>Business Classification</th>
                  <th>Contact No.</th>
                  <th>Production Method</th>
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
                        value={entry.age ?? ''}
                        onChange={(event) => updateEntry(index, { age: event.target.value })}
                        placeholder="Age"
                      />
                    </td>
                    <td style={{ width: 132 }}>
                      <Form.Select
                        aria-label={`Age bracket for salt farmer ${index + 1}`}
                        value={entry.age_bracket}
                        onChange={(event) => updateEntry(index, { age_bracket: event.target.value })}
                      >
                        <option value="">Not recorded</option>
                        {AGE_BRACKET_OPTIONS.map((bracket) => <option key={bracket} value={bracket}>{bracket}</option>)}
                      </Form.Select>
                    </td>
                    <td style={{ width: 132 }}>
                      <Form.Select
                        aria-label={`Sex for salt farmer ${index + 1}`}
                        value={entry.sex || ''}
                        onChange={(event) => updateEntry(index, { sex: event.target.value })}
                      >
                        <option value="">Not recorded</option>
                        {SEX_OPTIONS.map((sex) => <option key={sex} value={sex}>{sex}</option>)}
                      </Form.Select>
                    </td>
                    <td>
                      <Form.Control
                        aria-label={`Address for salt farmer ${index + 1}`}
                        maxLength={255}
                        value={entry.address}
                        onChange={(event) => updateEntry(index, { address: event.target.value })}
                      />
                    </td>
                    <td>
                      <Form.Control
                        aria-label={`Salt farm or owner for salt farmer ${index + 1}`}
                        maxLength={255}
                        value={entry.salt_farm_owner}
                        onChange={(event) => updateEntry(index, { salt_farm_owner: event.target.value })}
                      />
                    </td>
                    <td>
                      <Form.Control
                        aria-label={`Designation for salt farmer ${index + 1}`}
                        maxLength={100}
                        value={entry.designation}
                        onChange={(event) => updateEntry(index, { designation: event.target.value })}
                      />
                    </td>
                    <td>
                      <Form.Control
                        aria-label={`Business classification for salt farmer ${index + 1}`}
                        maxLength={100}
                        value={entry.business_classification}
                        onChange={(event) => updateEntry(index, { business_classification: event.target.value })}
                      />
                    </td>
                    <td>
                      <Form.Control
                        aria-label={`Contact number for salt farmer ${index + 1}`}
                        maxLength={32}
                        value={entry.contact_number}
                        onChange={(event) => updateEntry(index, { contact_number: event.target.value })}
                      />
                    </td>
                    <td>
                      <Form.Select
                        aria-label={`Production method for salt farmer ${index + 1}`}
                        value={entry.production_method || ''}
                        onChange={(event) => updateEntry(index, { production_method: event.target.value })}
                      >
                        <option value="">Not recorded</option>
                        {PRODUCTION_METHOD_OPTIONS.map((method) => (
                          <option key={method.value} value={method.value}>{method.label}</option>
                        ))}
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
              <thead><tr><th>Salt Farmer</th><th>Barangay</th><th>Age</th><th>Age Bracket</th><th>Sex</th><th>Address</th><th>Name of Salt Farm/Owner</th><th>Designation</th><th>Business Classification</th><th>Contact No.</th><th>Production Method</th></tr></thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={index}>
                    <td>{entry.name || '—'}</td>
                    <td>{barangays.find((barangay) => String(barangay.id) === String(entry.barangay_id))?.name || '—'}</td>
                    <td>{entry.age === '' || entry.age == null ? '—' : entry.age}</td>
                    <td>{entry.age_bracket || '—'}</td>
                    <td>{entry.sex || '—'}</td>
                    <td>{entry.address || '—'}</td>
                    <td>{entry.salt_farm_owner || '—'}</td>
                    <td>{entry.designation || '—'}</td>
                    <td>{entry.business_classification || '—'}</td>
                    <td>{entry.contact_number || '—'}</td>
                    <td>{PRODUCTION_METHOD_OPTIONS.find((method) => method.value === entry.production_method)?.label || '—'}</td>
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
