import React, { useRef, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { Download, FileUp } from 'lucide-react';
import Papa from 'papaparse';

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeRows(rawRows) {
  return rawRows
    .map((row, index) => ({
      ...Object.fromEntries(Object.entries(row).map(([key, value]) => [
        normalizeHeader(key),
        typeof value === 'string' ? value.trim() : value,
      ])),
      _row_number: index + 2,
    }))
    .filter((row) => Object.entries(row).some(([key, value]) => key !== '_row_number' && value !== ''));
}

export default function ReportImportActions({ templateUrl, onImport, onValidate, disabled = false }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [pendingRows, setPendingRows] = useState(null);
  const [previewWarnings, setPreviewWarnings] = useState([]);

  const runImport = async (rows) => {
    const result = await onImport(rows);
    setIsError(Boolean(result?.isError));
    setMessage(result?.message || result || `Imported ${rows.length} row${rows.length === 1 ? '' : 's'}.`);
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('');
    setIsError(false);
    setPendingRows(null);
    setPreviewWarnings([]);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let rawRows;
      if (extension === 'csv') {
        const parsed = Papa.parse(file, { header: true, skipEmptyLines: 'greedy' });
        if (parsed.errors.length) throw new Error(parsed.errors[0].message);
        rawRows = parsed.data;
      } else if (extension === 'xlsx') {
        const { default: readXlsxFile } = await import('read-excel-file/browser');
        const matrix = await readXlsxFile(file);
        if (!matrix.length) throw new Error('The selected file has no worksheet rows.');
        const headers = matrix[0].map(normalizeHeader);
        rawRows = matrix.slice(1).map((row) => Object.fromEntries(
          headers.map((header, index) => [header, row[index] ?? '']),
        ));
      } else {
        throw new Error('Choose a CSV or .xlsx file.');
      }
      const rows = normalizeRows(rawRows);
      if (!rows.length) throw new Error('The selected file contains no report rows.');
      // WHAT: Kung may onValidate, dito ipapakita ang mga soft warning bago
      //       tuluyang i-import (preview/confirm step).
      // WHY: Hindi basta-basta naisasama ang kahina-hinalang value; kailangan
      //      munang kumpirmahin ng encoder.
      if (onValidate) {
        const { errors, warnings } = await onValidate(rows);
        if (errors && errors.length) {
          setIsError(true);
          setMessage(errors.join(' '));
          return;
        }
        if (warnings && warnings.length) {
          setPendingRows(rows);
          setPreviewWarnings(warnings);
          return;
        }
      }
      await runImport(rows);
    } catch (error) {
      setIsError(true);
      setMessage(error.message || 'Could not import this file.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const confirmImport = async () => {
    if (!pendingRows) return;
    const rows = pendingRows;
    setPendingRows(null);
    setPreviewWarnings([]);
    setBusy(true);
    try {
      await runImport(rows);
    } catch (error) {
      setIsError(true);
      setMessage(error.message || 'Could not import this file.');
    } finally {
      setBusy(false);
    }
  };

  const cancelPreview = () => {
    setPendingRows(null);
    setPreviewWarnings([]);
    setMessage('');
    setIsError(false);
  };

  return (
    <div className="ui-import-row">
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.xlsx"
        className="visually-hidden"
        aria-label="Choose CSV or Excel report file"
        disabled={busy || disabled}
        onChange={handleFile}
      />
      {/* WHAT: Quiet ghost buttons sa halip na blue outlined buttons. WHY: bagong clean look. */}
      <button type="button" className="ui-btn-ghost" onClick={() => fileInput.current?.click()} disabled={busy || disabled}>
        {busy ? <Spinner animation="border" size="sm" /> : <FileUp size={15} aria-hidden="true" />}
        {busy ? 'Importing…' : 'Import CSV / XLSX'}
      </button>
      <a className="ui-btn-ghost" href={templateUrl} download>
        <Download size={15} aria-hidden="true" />CSV template
      </a>
      {pendingRows && (
        <div className="ui-import-panel ui-import-panel--warning" role="status" aria-live="polite">
          <div className="fw-semibold mb-1">
            Review before importing — {pendingRows.length} row{pendingRows.length === 1 ? '' : 's'} flagged:
          </div>
          <ul className="mb-0 ps-3">
            {previewWarnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
          <div className="ui-import-panel__actions">
            <button type="button" className="ui-btn-primary" onClick={confirmImport} disabled={busy}>
              Import anyway
            </button>
            <button type="button" className="ui-btn-outline" onClick={cancelPreview} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <div
          className={`ui-import-panel ${isError ? 'ui-import-panel--warning' : 'ui-import-panel--success'}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      )}
    </div>
  );
}
