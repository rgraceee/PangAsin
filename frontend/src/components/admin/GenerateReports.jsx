import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Form, Button, Table, Alert, Modal, Badge, Spinner } from 'react-bootstrap';
import { getAdminMunicipalities, createReport, getReports, getReport, getReportDownloadUrl, deleteReport } from '../../services/dataService';
import { Eye, Download, Trash2 } from 'lucide-react';
import IconButton from '../IconButton';
import PageHeader from './PageHeader';

const REPORT_TYPES = [
  { id: 'provincial', label: 'Provincial Summary' },
  { id: 'municipality', label: 'Municipality Summary' },
  { id: 'forecast', label: 'Forecast Report' },
  { id: 'data_quality', label: 'Data Quality' },
  { id: 'supply_demand', label: 'Supply & Demand' },
  { id: 'gis', label: 'Geographic Reference' },
];

const STATUS_VARIANT = {
  generated: 'success',
  pending: 'warning',
  failed: 'danger',
};

const TYPE_LABEL = Object.fromEntries(REPORT_TYPES.map((t) => [t.id, t.label]));

function formatDateRange(start, end) {
  if (!start && !end) return 'All records';
  return [start, end].filter(Boolean).join(' to ');
}

export default function GenerateReports() {
  const [reportType, setReportType] = useState('provincial');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [municipalityId, setMunicipalityId] = useState('');
  const [format, setFormat] = useState('excel');
  const [municipalities, setMunicipalities] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadReports = () => {
    getReports()
      .then((res) => setReports(res.reports || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getAdminMunicipalities()
      .then((res) => setMunicipalities(res.municipalities || []))
      .catch(() => {});
    loadReports();
  }, []);

  useEffect(() => {
    if (reportType !== 'municipality') setMunicipalityId('');
  }, [reportType]);

  const handleGenerate = () => {
    setError(null);
    if (reportType === 'municipality' && !municipalityId) {
      setError('Please select a municipality for the Municipality Summary report.');
      return;
    }
    if ((startDate && !endDate) || (!startDate && endDate)) {
      setError('Set both a start and an end date, or leave both empty for all records.');
      return;
    }
    setCreating(true);
    const payload = {
      report_type: reportType,
      format,
      date_range_start: startDate || null,
      date_range_end: endDate || null,
    };
    if (reportType === 'municipality') {
      payload.municipality_id = Number(municipalityId);
    }
    createReport(payload)
      .then(() => {
        loadReports();
        setCreating(false);
      })
      .catch((err) => { setError(err.message); setCreating(false); });
  };

  const openPreview = (r) => {
    setCurrentReport(r);
    setShowPreview(true);
    setPreviewData(null);
    setPreviewLoading(true);
    getReport(r.id)
      .then((res) => setPreviewData(res.data || null))
      .catch(() => {})
      .finally(() => setPreviewLoading(false));
  };

  const download = (r) => {
    window.open(getReportDownloadUrl(r.id), '_blank');
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

  const previewRows = (obj, prefix = '') => {
    if (!obj) return [];
    return Object.entries(obj).flatMap(([k, v]) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return previewRows(v, `${prefix}${k} `);
      }
      return [{ key: `${prefix}${k}`.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: formatValue(v) }];
    });
  };

  const formatValue = (v) => {
    if (v === null || v === undefined) return '—';
    if (Array.isArray(v)) return `${v.length} rows`;
    if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 100) / 100;
    return String(v);
  };

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
              <Form.Label className="small fw-bold text-uppercase text-muted">Report Type</Form.Label>
              <Form.Select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                {REPORT_TYPES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label className="small fw-bold text-uppercase text-muted">Format</Form.Label>
              <Form.Select value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="excel">Excel (.xlsx)</option>
                <option value="pdf">PDF</option>
              </Form.Select>
            </Col>
            {reportType === 'municipality' ? (
              <Col md={3}>
                <Form.Label className="small fw-bold text-uppercase text-muted">Municipality</Form.Label>
                <Form.Select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)}>
                  <option value="">Select municipality…</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Form.Select>
              </Col>
            ) : (
              <>
                <Col md={2}>
                  <Form.Label className="small fw-bold text-uppercase text-muted">Start Date</Form.Label>
                  <Form.Control type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Col>
                <Col md={2}>
                  <Form.Label className="small fw-bold text-uppercase text-muted">End Date</Form.Label>
                  <Form.Control type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </Col>
              </>
            )}
            <Col md={2} className="text-end">
              <Button className="admin-page-hero-btn w-100" onClick={handleGenerate} disabled={creating}>
                {creating ? (
                  <><Spinner as="span" animation="border" size="sm" className="me-2" />Generating&hellip;</>
                ) : (
                  <><Download size={16} strokeWidth={2.2} className="me-2" />Generate</>
                )}
              </Button>
            </Col>
          </Row>
          {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}
        </Card.Body>
      </Card>

      <Card className="encoder-card">
        <Card.Header as="h5">Generated Reports</Card.Header>
        <Card.Body className="p-0">
          {loading ? (
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
                  <tr key={r.id}>
                    <td><Badge bg="info" className="me-1">{TYPE_LABEL[r.report_type] || r.report_type}</Badge></td>
                    <td>{r.municipality_name || 'Province-wide'}</td>
                    <td>{formatDateRange(r.date_range_start, r.date_range_end)}</td>
                    <td className="text-uppercase">{r.format}</td>
                    <td><span className={`record-status-badge status-${r.status === 'failed' ? 'rejected' : r.status === 'generated' ? 'approved' : 'pending'}`}>{r.status}</span></td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                    <td className="text-end text-nowrap">
                      <IconButton
                        icon={Eye}
                        label="Preview report"
                        variant="outline-primary"
                        onClick={() => openPreview(r)}
                        disabled={r.status !== 'generated'}
                      />
                      <IconButton
                        icon={Download}
                        label="Download report"
                        variant="outline-success"
                        onClick={() => download(r)}
                        disabled={r.status !== 'generated'}
                      />
                      <IconButton
                        icon={Trash2}
                        label="Delete report"
                        variant="outline-danger"
                        onClick={() => confirmDelete(r)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Modal show={showPreview} onHide={() => setShowPreview(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{currentReport ? `${TYPE_LABEL[currentReport.report_type] || currentReport.report_type} Report` : 'Report Preview'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {previewLoading ? (
            <div className="text-center p-4"><Spinner animation="border" variant="primary" /></div>
          ) : currentReport && (
            <>
              <Alert variant="info" className="small">
                Generated from live database records on {currentReport.generated_at ? new Date(currentReport.generated_at).toLocaleString() : '—'} ({currentReport.format.toUpperCase()}).
              </Alert>
              <Table bordered size="sm" className="mb-0">
                <tbody>
                  <tr>
                    <th className="text-muted fw-normal" style={{ width: '35%' }}>Report Type</th>
                    <td>{TYPE_LABEL[currentReport.report_type] || currentReport.report_type}</td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">Scope</th>
                    <td>{currentReport.municipality_name || 'Province-wide'}</td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">Date Range</th>
                    <td>{formatDateRange(currentReport.date_range_start, currentReport.date_range_end)}</td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">Format / Status</th>
                    <td><span className="text-uppercase">{currentReport.format}</span> · <span className={`record-status-badge status-${currentReport.status === 'failed' ? 'rejected' : 'approved'}`}>{currentReport.status}</span></td>
                  </tr>
                </tbody>
              </Table>
              {previewData && (
                <>
                  <h6 className="mt-3 fw-bold">Report Data</h6>
                  <Table bordered size="sm" className="mb-0">
                    <tbody>
                      {previewRows(previewData).map((row, i) => (
                        <tr key={i}>
                          <th className="text-muted fw-normal" style={{ width: '35%' }}>{row.key}</th>
                          <td>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {currentReport && currentReport.status === 'generated' && (
            <Button variant="success" onClick={() => download(currentReport)}>Download {currentReport.format.toUpperCase()}</Button>
          )}
          <Button variant="secondary" onClick={() => setShowPreview(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDeleteConfirm} onHide={() => !deleting && setShowDeleteConfirm(false)} centered>
        <Modal.Header closeButton={!deleting}>
          <Modal.Title>Delete Report</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {reportToDelete && (
            <p className="mb-0">
              Are you sure you want to delete the <strong>{TYPE_LABEL[reportToDelete.report_type] || reportToDelete.report_type}</strong> report
              {reportToDelete.municipality_name ? ` for ${reportToDelete.municipality_name}` : ''}?
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
