import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Form, Button, Table, Alert, Badge, Spinner, Modal } from 'react-bootstrap';
import { getAdminMunicipalities, getAdminStats, getAdminMonths, createReport, getReports, getReport, getReportDownloadUrl, deleteReport } from '../../services/dataService';
import { Eye, Download, Trash2, FileText, SearchX, ChevronDown, ChevronUp } from 'lucide-react';
import IconButton from '../IconButton';
import PageHeader from './PageHeader';

const CONTENT_TYPES = [
  { id: 'production', label: 'Production' },
  { id: 'producers', label: 'Producers' },
];

const REPORT_TYPES = [
  { id: 'provincial', label: 'Provincial Summary' },
  { id: 'municipality', label: 'Municipality Summary' },
  { id: 'forecast', label: 'Forecast Report' },
  { id: 'data_quality', label: 'Data Quality' },
  { id: 'supply_demand', label: 'Supply & Demand' },
  { id: 'gis', label: 'Geographic Reference' },
  ...CONTENT_TYPES,
];

const TYPE_LABEL = Object.fromEntries(REPORT_TYPES.map((t) => [t.id, t.label]));

const SCOPE_LEVELS = [
  { id: 'province', label: 'Province-wide / All barangays' },
  { id: 'municipality', label: 'Municipality / its barangays' },
  { id: 'barangay', label: 'Single barangay' },
];

const DATA_SECTIONS = [
  ['municipalities', 'Municipalities'],
  ['by_municipality', 'By Municipality'],
  ['by_barangay', 'By Barangay'],
  ['monthly_trend', 'Monthly Trend'],
  ['runs', 'Forecast Runs'],
];

const SUMMARY_LINES = [
  ['Total Production', 'total_production_mt', (v) => `${v} MT`],
  ['Total Registered Producers', 'total_registered_producers', (v) => `${v.toLocaleString()}`],
  ['Male Producers', 'total_male_producers', (v) => `${v.toLocaleString()}`],
  ['Female Producers', 'total_female_producers', (v) => `${v.toLocaleString()}`],
  ['Overall Quality Score', 'overall_quality_score', (v) => `${v}%`],
];

function formatDateRange(start, end) {
  if (!start && !end) return 'All records';
  return [start, end].filter(Boolean).join(' to ');
}

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'number') {
    const rounded = Math.round(value * 100) / 100;
    return rounded.toLocaleString();
  }
  return String(value);
}

// A report "has data" if any of its table sections has rows, or if any of the
// single-number totals is non-zero. Otherwise the filter combination simply
// matched nothing (e.g. no records in that year/barangay).
function dataHasRows(data) {
  if (!data) return false;
  const sectionKeys = ['municipalities', 'by_municipality', 'by_barangay', 'monthly_trend', 'runs'];
  if (sectionKeys.some((k) => Array.isArray(data[k]) && data[k].length > 0)) return true;
  const scalarKeys = ['total_production_mt', 'total_registered_producers', 'total_projected'];
  return scalarKeys.some((k) => typeof data[k] === 'number' && data[k] > 0);
}

function DataTable({ title, rows }) {
  if (!rows || rows.length === 0) return null;
  const headers = Object.keys(rows[0]);
  return (
    <div className="mt-4">
      <h6 className="fw-bold">{title}</h6>
      <Table responsive bordered size="sm" className="mb-0 report-preview-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {headers.map((h) => (
                <td key={h}>{formatCell(row[h])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default function GenerateReports() {
  const [content, setContent] = useState('production');
  const [scope, setScope] = useState('province');
  const [municipalityId, setMunicipalityId] = useState('');
  const [barangayId, setBarangayId] = useState('');
  const [timeMode, setTimeMode] = useState('range');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [year, setYear] = useState('');
  const [years, setYears] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangaysByMuni, setBarangaysByMuni] = useState({});
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showFilesFor, setShowFilesFor] = useState(null);
  const [showReports, setShowReports] = useState(false);
  const [error, setError] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const previewRef = React.useRef(null);

  const loadReports = () => {
    getReports()
      .then((res) => setReports(res.reports || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([
      getAdminMunicipalities().then((res) => setMunicipalities(res.municipalities || [])).catch(() => []),
      getAdminStats()
        .then((stats) => {
          const map = {};
          (stats.by_municipality || []).forEach((m) => {
            map[m.municipality_id] = (m.by_barangay || []).sort((a, b) => a.barangay.localeCompare(b.barangay));
          });
          setBarangaysByMuni(map);
        })
        .catch(() => {}),
      getAdminMonths()
        .then((res) => {
          const seen = new Set();
          const ys = [];
          (res.months || []).forEach((m) => {
            const y = String(m).slice(0, 4);
            if (y && !seen.has(y)) { seen.add(y); ys.push(y); }
          });
          setYears(ys.sort().reverse());
          if (ys.length > 0) setYear(ys[0]);
        })
        .catch(() => {}),
    ]);
    loadReports();
  }, []);

  useEffect(() => {
    setBarangayId('');
  }, [municipalityId, scope]);

  const visibleBarangays = useMemo(
    () => (municipalityId ? barangaysByMuni[Number(municipalityId)] || [] : []),
    [municipalityId, barangaysByMuni]
  );

  const scrollToPreview = () => {
    setTimeout(() => {
      if (previewRef.current) previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const showPreview = (report, data) => {
    setCurrentReport(report);
    setPreviewData(data || null);
    setPreviewLoading(false);
    setPreviewError(null);
    scrollToPreview();
  };

  const handleView = () => {
    setError(null);
    setPreviewError(null);
    if (scope === 'municipality' && !municipalityId) {
      setError('Please select a municipality.');
      return;
    }
    if (scope === 'barangay') {
      if (!municipalityId) { setError('Please select a municipality first.'); return; }
      if (!barangayId) { setError('Please select a barangay.'); return; }
    }
    if (timeMode === 'range' && ((startDate && !endDate) || (!startDate && endDate))) {
      setError('Set both a start and an end date, or leave both empty for all records.');
      return;
    }
    if (timeMode === 'year' && !year) {
      setError('Select a year.');
      return;
    }

    let start = null;
    let end = null;
    if (timeMode === 'range') {
      start = startDate || null;
      end = endDate || null;
    } else {
      start = `${year}-01-01`;
      end = `${year}-12-31`;
    }

    const payload = {
      report_type: content,
      date_range_start: start,
      date_range_end: end,
    };
    if (scope === 'municipality') payload.municipality_id = Number(municipalityId);
    if (scope === 'barangay') payload.barangay_id = Number(barangayId);

    setCreating(true);
    setPreviewData(null);
    setCurrentReport(null);
    createReport(payload)
      .then((res) => {
        setCreating(false);
        showPreview(res.report, res.data);
        setShowReports(true);
        loadReports();
      })
      .catch((err) => {
        setCreating(false);
        setPreviewError(err.message || 'Something went wrong while generating the report. Please try again.');
      });
  };

  // Re-open an existing report's preview from the list. The data is always
  // reloaded for the same report id, so the Download button below it always
  // exports exactly what is on screen.
  const openPreview = (r) => {
    setPreviewError(null);
    setPreviewLoading(true);
    setCurrentReport(r);
    setPreviewData(null);
    getReport(r.id)
      .then((res) => showPreview(res.report, res.data))
      .catch((err) => {
        setPreviewLoading(false);
        setPreviewError(err.message || 'Could not load this report. It may have been deleted.');
      });
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = (r) => {
    setReportToDelete(r);
    setShowDeleteConfirm(true);
  };

  const handleDelete = () => {
    if (!reportToDelete) return;
    setDeleting(true);
    deleteReport(reportToDelete.id)
      .then(() => {
        setShowDeleteConfirm(false);
        setReportToDelete(null);
        setDeleting(false);
        loadReports();
      })
      .catch((err) => {
        setError(err.message);
        setShowDeleteConfirm(false);
        setDeleting(false);
      });
  };

  const previewTables = useMemo(() => {
    if (!previewData) return [];
    return DATA_SECTIONS
      .filter(([key]) => previewData[key] && previewData[key].length > 0)
      .map(([key, label]) => ({ key, label, rows: previewData[key] }));
  }, [previewData]);

  const summaryLines = useMemo(() => {
    if (!previewData) return [];
    return SUMMARY_LINES
      .map(([label, key, fmt]) => (previewData[key] != null ? { label, value: fmt(previewData[key]) } : null))
      .filter(Boolean);
  }, [previewData]);

  const previewScopeLabel = currentReport
    ? currentReport.barangay_name
      ? `Barangay ${currentReport.barangay_name}`
      : currentReport.municipality_name
        ? `Municipality ${currentReport.municipality_name}`
        : 'Province-wide'
    : '';

  return (
    <div>
      <PageHeader
        id="admin-reports"
        variant="sub"
        title="Generate Reports"
        subtitle="Create summary reports for export based on the production records."
      />

      <Card className="encoder-card mb-3">
        <Card.Header as="h5">Create a New Report</Card.Header>
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={3}>
              <Form.Label className="small fw-bold text-uppercase text-muted">Content</Form.Label>
              <Form.Select value={content} onChange={(e) => setContent(e.target.value)}>
                {CONTENT_TYPES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label className="small fw-bold text-uppercase text-muted">Scope</Form.Label>
              <Form.Select value={scope} onChange={(e) => setScope(e.target.value)}>
                {SCOPE_LEVELS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Label className="small fw-bold text-uppercase text-muted">Time</Form.Label>
              <Row className="g-2">
                <Col xs={4}>
                  <Form.Select value={timeMode} onChange={(e) => setTimeMode(e.target.value)} aria-label="Time mode">
                    <option value="range">Date range</option>
                    <option value="year">Year</option>
                  </Form.Select>
                </Col>
                {timeMode === 'range' ? (
                  <>
                    <Col xs={4}>
                      <Form.Control type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" />
                    </Col>
                    <Col xs={4}>
                      <Form.Control type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="End date" />
                    </Col>
                  </>
                ) : (
                  <Col xs={8}>
                    <Form.Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
                      {years.length === 0 && <option value="">No years available</option>}
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </Form.Select>
                  </Col>
                )}
              </Row>
            </Col>
          </Row>

          {(scope === 'municipality' || scope === 'barangay') && (
            <Row className="g-3 mt-1">
              <Col md={3}>
                <Form.Label className="small fw-bold text-uppercase text-muted">Municipality</Form.Label>
                <Form.Select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)}>
                  <option value="">Select municipality&hellip;</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Form.Select>
              </Col>
              {scope === 'barangay' && (
                <Col md={3}>
                  <Form.Label className="small fw-bold text-uppercase text-muted">Barangay</Form.Label>
                  <Form.Select value={barangayId} onChange={(e) => setBarangayId(e.target.value)} disabled={!municipalityId}>
                    <option value="">{municipalityId ? 'Select barangay&hellip;' : 'Select a municipality first'}</option>
                    {visibleBarangays.map((b) => (
                      <option key={b.barangay_id} value={b.barangay_id}>{b.barangay}</option>
                    ))}
                  </Form.Select>
                </Col>
              )}
            </Row>
          )}

          <div className="mt-3 text-end">
            <Button className="admin-page-hero-btn" onClick={handleView} disabled={creating}>
              {creating ? (
                <><Spinner as="span" animation="border" size="sm" className="me-2" />Loading&hellip;</>
              ) : (
                <><Eye size={16} strokeWidth={2.2} className="me-2" />View</>
              )}
            </Button>
          </div>
          {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}
        </Card.Body>
      </Card>

      {previewError && (
        <Alert variant="danger" className="mb-3">
          <strong>Could not show the report.</strong> {previewError}
        </Alert>
      )}

      {(currentReport || previewLoading) && (
        <Card className="encoder-card mb-3" ref={previewRef}>
          <Card.Header as="h5">
            Report Preview
            {currentReport && (
              <small className="text-muted fw-normal ms-2">
                Report #{currentReport.id}
              </small>
            )}
          </Card.Header>
          <Card.Body>
            {previewLoading ? (
              <div className="text-center p-4"><Spinner animation="border" variant="primary" /></div>
            ) : currentReport && (
              <>
                <div className="report-preview-meta">
                  <span><strong>Content:</strong> {TYPE_LABEL[currentReport.report_type] || currentReport.report_type}</span>
                  <span><strong>Scope:</strong> {previewScopeLabel}</span>
                  <span><strong>Period:</strong> {formatDateRange(currentReport.date_range_start, currentReport.date_range_end)}</span>
                </div>

                {summaryLines.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    {summaryLines.map((s) => (
                      <span key={s.label} className="small report-preview-pill">
                        <span className="text-muted">{s.label}:</span> <b>{s.value}</b>
                      </span>
                    ))}
                  </div>
                )}

                {dataHasRows(previewData) ? (
                  previewTables.map((t) => <DataTable key={t.key} title={t.label} rows={t.rows} />)
                ) : (
                  <div className="report-preview-empty">
                    <SearchX size={32} strokeWidth={1.5} />
                    <strong>No records found</strong>
                    <p className="mb-0">
                      No matching records for {previewScopeLabel.toLowerCase()} in{' '}
                      {formatDateRange(currentReport.date_range_start, currentReport.date_range_end)}.
                      Try a wider date range, a different scope, or a different municipality / barangay.
                    </p>
                  </div>
                )}

                <div className="report-preview-footer">
                  <a
                    className="report-dl-btn report-dl-btn--pdf"
                    href={getReportDownloadUrl(currentReport.id, 'pdf')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download size={18} strokeWidth={2.2} />Download PDF file
                  </a>
                  <a
                    className="report-dl-btn report-dl-btn--word"
                    href={getReportDownloadUrl(currentReport.id, 'docx')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download size={18} strokeWidth={2.2} />Download Word (.docx) file
                  </a>
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      )}

      <Card className="encoder-card">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Generated Reports</h5>
          <button
            type="button"
            className="view-reports-link"
            onClick={() => setShowReports((v) => !v)}
            aria-expanded={showReports}
            aria-controls="generated-reports-body"
          >
            {showReports ? 'Hide Reports' : 'View Reports'}
            {showReports ? (
              <ChevronUp size={16} strokeWidth={2.2} className="report-vr-chev" />
            ) : (
              <ChevronDown size={16} strokeWidth={2.2} className="report-vr-chev" />
            )}
          </button>
        </Card.Header>
        <Card.Body id="generated-reports-body" className="p-0">
          {!showReports ? (
            <div className="text-muted p-4 text-center small">
              Reports are hidden. Click &ldquo;View Reports&rdquo; above to see all generated reports.
            </div>
          ) : loading ? (
            <div className="text-center p-4"><Spinner animation="border" variant="primary" /></div>
          ) : reports.length === 0 ? (
            <div className="text-muted p-4 text-center">No reports generated yet. Fill in the form above to create one.</div>
          ) : (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Scope</th>
                  <th>Date Range</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr>
                      <td><Badge bg="info" className="me-1">{TYPE_LABEL[r.report_type] || r.report_type}</Badge></td>
                      <td>{r.barangay_name || r.municipality_name || 'Province-wide'}</td>
                      <td>{formatDateRange(r.date_range_start, r.date_range_end)}</td>
                      <td className="text-uppercase">{r.format}</td>
                      <td><span className={`record-status-badge status-${r.status === 'failed' ? 'rejected' : r.status === 'generated' ? 'approved' : 'pending'}`}>{r.status}</span></td>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '\u2014'}</td>
                      <td className="text-end">
                        <div className="row-actions">
                          <IconButton
                            icon={Eye}
                            label="Preview report"
                            variant="outline-primary"
                            className="row-action-btn"
                            onClick={() => openPreview(r)}
                            disabled={r.status !== 'generated'}
                          />
                          <IconButton
                            icon={Download}
                            label={showFilesFor === r.id ? 'Hide download links' : 'Show download links'}
                            variant={showFilesFor === r.id ? 'primary' : 'outline-success'}
                            className="row-action-btn"
                            onClick={() => setShowFilesFor(showFilesFor === r.id ? null : r.id)}
                            disabled={r.status !== 'generated'}
                          />
                          <IconButton
                            icon={Trash2}
                            label="Delete report"
                            variant="outline-danger"
                            className="row-action-btn"
                            onClick={() => confirmDelete(r)}
                          />
                        </div>
                      </td>
                    </tr>
                    {showFilesFor === r.id && (
                      <tr className="report-files-row">
                        <td colSpan={7}>
                          <div className="report-files-panel">
                            <span className="small text-muted me-3">
                              <FileText size={14} strokeWidth={2} className="me-1" />Files for {TYPE_LABEL[r.report_type] || r.report_type}
                              {' '}{r.barangay_name || r.municipality_name ? `(\u00b7 ${r.barangay_name || r.municipality_name})` : '\u00b7 Province-wide'}:
                            </span>
                            <a
                              className="report-dl-btn report-dl-btn--pdf report-dl-btn--sm"
                              href={getReportDownloadUrl(r.id, 'pdf')}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download size={14} strokeWidth={2.2} />PDF (.pdf)
                            </a>
                            <a
                              className="report-dl-btn report-dl-btn--word report-dl-btn--sm"
                              href={getReportDownloadUrl(r.id, 'docx')}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download size={14} strokeWidth={2.2} />Word (.docx)
                            </a>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Modal show={showDeleteConfirm} onHide={() => !deleting && setShowDeleteConfirm(false)} centered>
        <Modal.Header closeButton={!deleting}>
          <Modal.Title>Delete Report</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {reportToDelete && (
            <p className="mb-0">
              Are you sure you want to delete the <strong>{TYPE_LABEL[reportToDelete.report_type] || reportToDelete.report_type}</strong> report
              {reportToDelete.barangay_name ? ` for ${reportToDelete.barangay_name}` : reportToDelete.municipality_name ? ` for ${reportToDelete.municipality_name}` : ''}?
              This will permanently remove the file and cannot be undone.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? <><Spinner as="span" animation="border" size="sm" className="me-2" />Deleting&hellip;</> : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}