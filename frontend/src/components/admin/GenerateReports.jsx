import React, { useState } from 'react';
import { Row, Col, Card, Form, Button, Table, Alert, Modal, Badge } from 'react-bootstrap';

const REPORT_TYPES = [
  { id: 'production', label: 'Production Summary' },
  { id: 'ranking', label: 'Municipality Ranking' },
  { id: 'validation', label: 'Validation Status' },
  { id: 'quality', label: 'Data Quality' },
];

export default function GenerateReports() {
  const [reportType, setReportType] = useState('production');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generated, setGenerated] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = () => {
    setError(null);
    const selected = REPORT_TYPES.find((r) => r.id === reportType);
    if (!startDate || !endDate) {
      setError('Please set both a start and end date range.');
      return;
    }
    const report = {
      id: Date.now(),
      type: reportType,
      typeLabel: selected.label,
      start: startDate,
      end: endDate,
      created: new Date().toLocaleString(),
    };
    setGenerated([report, ...generated]);
  };

  const openPreview = (r) => {
    setCurrentReport(r);
    setShowPreview(true);
  };

  return (
    <div>
      <h2 className="mb-1">Generate Reports</h2>
      <p className="text-muted">Create summary reports for export based on the production records.</p>

      <Card className="encoder-card mb-3">
        <Card.Header as="h5">Create a New Report</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={4}>
              <Form.Label className="small fw-bold text-uppercase text-muted">Report Type</Form.Label>
              <Form.Select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                {REPORT_TYPES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label className="small fw-bold text-uppercase text-muted">Start Date</Form.Label>
              <Form.Control type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Col>
            <Col md={3}>
              <Form.Label className="small fw-bold text-uppercase text-muted">End Date</Form.Label>
              <Form.Control type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Col>
            <Col md={2} className="d-flex align-items-end">
              <Button variant="primary" onClick={handleGenerate}>Generate</Button>
            </Col>
          </Row>
          {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}
        </Card.Body>
      </Card>

      <Card className="encoder-card">
        <Card.Header as="h5">Generated Reports</Card.Header>
        <Card.Body className="p-0">
          {generated.length === 0 ? (
            <div className="text-muted p-4 text-center">No reports generated yet. Fill in the form above to create one.</div>
          ) : (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date Range</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {generated.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Badge bg="info" className="me-1">{r.typeLabel}</Badge>
                    </td>
                    <td>{r.start} to {r.end}</td>
                    <td>{r.created}</td>
                    <td>
                      <Button size="sm" variant="outline-primary" onClick={() => openPreview(r)}>Preview</Button>
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
          <Modal.Title>{currentReport ? `${currentReport.typeLabel} Report` : 'Report Preview'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {currentReport && (
            <>
              <Alert variant="info" className="small">
                This is a simulated preview. Export functionality is a placeholder.
              </Alert>
              <Table bordered size="sm" className="mb-0">
                <tbody>
                  <tr>
                    <th className="text-muted fw-normal" style={{ width: '35%' }}>Report Type</th>
                    <td>{currentReport.typeLabel}</td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">Date Range</th>
                    <td>{currentReport.start} to {currentReport.end}</td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">Generated</th>
                    <td>{currentReport.created}</td>
                  </tr>
                  <tr>
                    <th className="text-muted fw-normal">Status</th>
                    <td><span className="record-status-badge status-approved">Ready</span></td>
                  </tr>
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPreview(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
