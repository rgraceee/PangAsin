import React, { useEffect, useState } from 'react';
import { Alert, Badge, Card, Form, Spinner, Table } from 'react-bootstrap';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { createEncoderProducerReport, getEncoderBarangays, getEncoderProducerReports } from '../../services/dataService';
import { useToast } from '../Toast';
import ReportModal from './ReportModal';
import ReportSection from './ReportSection';
import ReportField from './ReportField';
import ReportSummary from './ReportSummary';
import ReportImportActions from './ReportImportActions';
import { findBarangay, numberValue, rowError } from './reportImportUtils';

const SEX_OPTIONS = ['Male', 'Female', 'Other'];
const STEPS = [
  { key: 'producer', label: 'Producer' },
  { key: 'review', label: 'Review' },
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

  // WHAT: May unsaved input ba? WHY: para may confirm bago isara ang modal.
  const hasData = entries.length > 1
    || entries.some((entry) => entry.barangay_id || entry.name || entry.age || entry.sex || entry.address);

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

      <ReportModal
        show={open}
        title="New Producer Report"
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
              title={!canReview ? 'Complete every producer row to continue.' : undefined}
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
              {saving ? 'Submitting…' : 'Submit Producer Report'}
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
          <ReportSection title="Producer Details">
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
                    <th>Address</th>
                    <th aria-label="Row actions" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={index}>
                      <td>
                        <Form.Select
                          aria-label={`Barangay for producer ${index + 1}`}
                          value={entry.barangay_id}
                          onChange={(event) => updateEntry(index, { barangay_id: event.target.value })}
                        >
                          <option value="">Select…</option>
                          {barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}
                        </Form.Select>
                      </td>
                      <td>
                        <Form.Control
                          aria-label={`Name for producer ${index + 1}`}
                          maxLength={150}
                          value={entry.name}
                          onChange={(event) => updateEntry(index, { name: event.target.value })}
                          placeholder="Full name"
                        />
                      </td>
                      <td style={{ width: 92 }}>
                        <Form.Control
                          aria-label={`Age for producer ${index + 1}`}
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
                          aria-label={`Sex for producer ${index + 1}`}
                          value={entry.sex}
                          onChange={(event) => updateEntry(index, { sex: event.target.value })}
                        >
                          <option value="">Select…</option>
                          {SEX_OPTIONS.map((sex) => <option key={sex} value={sex}>{sex}</option>)}
                        </Form.Select>
                      </td>
                      <td>
                        <Form.Control
                          aria-label={`Address for producer ${index + 1}`}
                          maxLength={255}
                          value={entry.address}
                          onChange={(event) => updateEntry(index, { address: event.target.value })}
                          placeholder="Home address"
                        />
                      </td>
                      <td style={{ width: 44 }}>
                        {entries.length > 1 && (
                          <button
                            type="button"
                            className="ui-report-row-remove"
                            aria-label={`Remove producer ${index + 1}`}
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
                title: 'Review Producer Report',
                onEdit: () => setStep(0),
                rows: [
                  ['Report Type', 'Producer'],
                  ['Municipality', user?.municipality_name || '—'],
                  ['Producers', entries.length],
                ],
              }]}
            />
            <div className="ui-report-table-wrap">
              <table className="ui-report-table">
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
              </table>
            </div>
          </>
        )}
      </ReportModal>
    </>
  );
}
