import React, { useEffect, useState, useMemo } from 'react';
import { Card, Form, Table, Alert, Spinner } from 'react-bootstrap';
import { getAdminMunicipalities, getAdminStats, getAdminMonths, createReport, getReports, getReport, getReportDownloadUrl, deleteReport } from '../../services/dataService';
import { confirmDelete } from '../../services/feedback';
import { useToast } from '../Toast';
import { SkeletonList, SkeletonChart } from '../Skeleton';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FileText,
  Info,
  Search,
  SearchX,
  Sparkles,
  Trash2,
} from 'lucide-react';
import PageHeader from './PageHeader';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';
import { displayHeader } from '../../constants/labels';

const CONTENT_TYPES = [
  { id: 'production', label: 'Production' },
  { id: 'producers', label: 'Salt Farmers' },
  { id: 'environment', label: 'Environment' },
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

const TIME_MODES = [
  { id: 'range', label: 'Date range' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_quarter', label: 'Last quarter' },
  { id: 'year', label: 'Year' },
];

const FORMAT_OPTIONS = [
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'Word' },
];

const PAGE_SIZE = 8;

const DATA_SECTIONS = [
  ['municipalities', 'Municipalities'],
  ['by_municipality', 'By Municipality'],
  ['by_barangay', 'By Barangay'],
  ['monthly_trend', 'Monthly Trend'],
  ['runs', 'Forecast Runs'],
  ['producers', 'Salt Farmer Entries'],
  ['environment_reports', 'Environment Reports'],
];

const SUMMARY_LINES = [
  ['Total Production', 'total_production_mt', (v) => `${v} Metric Tons (MT)`],
  ['Total Registered Salt Farmers', 'total_registered_producers', (v) => `${v.toLocaleString()}`],
  ['Male Salt Farmers', 'total_male_producers', (v) => `${v.toLocaleString()}`],
  ['Female Salt Farmers', 'total_female_producers', (v) => `${v.toLocaleString()}`],
  ['Other Salt Farmers', 'total_other_producers', (v) => `${v.toLocaleString()}`],
  ['Environment Reports', 'total_reports', (v) => `${v.toLocaleString()}`],
  ['Environment Salt Beds', 'total_salt_beds', (v) => `${v.toLocaleString()}`],
  ['Environment Production Area', 'total_production_area_sqm', (v) => `${v.toLocaleString()} m²`],
  ['Overall Quality Score', 'overall_quality_score', (v) => `${v}%`],
];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function thisMonthRange() {
  const now = new Date();
  return [
    toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    toISODate(now),
  ];
}

function lastQuarterRange() {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) - 1;
  const year = now.getFullYear() + Math.floor(quarter / 4);
  const index = ((quarter % 4) + 4) % 4;
  const start = new Date(year, index * 3, 1);
  const end = new Date(year, index * 3 + 3, 0);
  return [toISODate(start), toISODate(end)];
}

function formatDateRange(start, end) {
  if (!start && !end) return 'All records';
  return [start, end].filter(Boolean).join(' to ');
}

function formatDateTime(value) {
  if (!value) return '\u2014';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '\u2014';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'number') {
    const rounded = Math.round(value * 100) / 100;
    return rounded.toLocaleString();
  }
  return String(value);
}

function reportScopeLabel(report) {
  if (!report) return '';
  if (report.barangay_name) return `Barangay ${report.barangay_name}`;
  if (report.municipality_name) return `Municipality ${report.municipality_name}`;
  return 'Province-wide';
}

function reportTypeLabel(report) {
  if (!report) return '';
  return TYPE_LABEL[report.report_type] || report.report_type || '\u2014';
}

function formatLabel(format) {
  if (!format) return '\u2014';
  if (format === 'docx') return 'DOCX';
  if (format === 'pdf') return 'PDF';
  return String(format).toUpperCase();
}

function formatBadgeClass(format) {
  if (format === 'pdf') return 'report-format-badge--pdf';
  if (format === 'docx') return 'report-format-badge--docx';
  return 'report-format-badge--other';
}

// A report "has data" if any of its table sections has rows, or if any of the
// single-number totals is non-zero. Otherwise the filter combination simply
// matched nothing (e.g. no records in that year/barangay).
function dataHasRows(data) {
  if (!data) return false;
  const sectionKeys = ['municipalities', 'by_municipality', 'by_barangay', 'monthly_trend', 'runs', 'producers', 'environment_reports'];
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
              <th key={h}>{displayHeader(h)}</th>
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

function SortableTh({ label, column, activeKey, direction, onSort }) {
  const active = activeKey === column;
  return (
    <th aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`report-sort-btn${active ? ' is-active' : ''}`}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        {active
          ? (direction === 'asc'
            ? <ArrowUp size={12} aria-hidden="true" />
            : <ArrowDown size={12} aria-hidden="true" />)
          : <ArrowUpDown size={12} aria-hidden="true" />}
      </button>
    </th>
  );
}

const SORT_ACCESSORS = {
  report: reportTypeLabel,
  scope: reportScopeLabel,
  period: (r) => r.date_range_start || '',
  format: (r) => r.format || '',
  requester: (r) => r.requester_name || '',
  created_at: (r) => r.created_at || '',
};

export default function GenerateReports() {
  const { toastSuccess, toastError } = useToast();
  const [content, setContent] = useState('production');
  const [scope, setScope] = useState('province');
  const [municipalityId, setMunicipalityId] = useState('');
  const [barangayId, setBarangayId] = useState('');
  const [timeMode, setTimeMode] = useState('range');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [year, setYear] = useState('');
  const [years, setYears] = useState([]);
  const [format, setFormat] = useState('pdf');
  const [municipalities, setMunicipalities] = useState([]);
  const [barangaysByMuni, setBarangaysByMuni] = useState({});
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [error, setError] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [generateStatus, setGenerateStatus] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [reportFormatFilter, setReportFormatFilter] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const { activeNames } = useMunicipalityDirectory();
  const previewRef = React.useRef(null);

  const invalidRange = Boolean(startDate && endDate && startDate > endDate);

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

  useEffect(() => {
    setPage(1);
  }, [reportSearch, reportFormatFilter, sortKey, sortDir]);

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

  const failGeneration = (message) => {
    setError(message);
    setGenerateStatus(message);
  };

  const handleView = () => {
    setError(null);
    setPreviewError(null);
    if (scope === 'municipality' && !municipalityId) {
      failGeneration('Please select a municipality.');
      return;
    }
    if (scope === 'barangay') {
      if (!municipalityId) { failGeneration('Please select a municipality first.'); return; }
      if (!barangayId) { failGeneration('Please select a barangay.'); return; }
    }
    if (timeMode === 'range' && ((startDate && !endDate) || (!startDate && endDate))) {
      failGeneration('Set both a start and an end date, or leave both empty for all records.');
      return;
    }
    if (timeMode === 'range' && invalidRange) {
      failGeneration('From date must be on or before the To date.');
      return;
    }
    if (timeMode === 'year' && !year) {
      failGeneration('Select a year.');
      return;
    }

    let start = null;
    let end = null;
    if (timeMode === 'range') {
      start = startDate || null;
      end = endDate || null;
    } else if (timeMode === 'year') {
      start = `${year}-01-01`;
      end = `${year}-12-31`;
    } else if (timeMode === 'this_month') {
      [start, end] = thisMonthRange();
    } else if (timeMode === 'last_quarter') {
      [start, end] = lastQuarterRange();
    }

    const payload = {
      report_type: content,
      format,
      date_range_start: start,
      date_range_end: end,
    };
    if (scope === 'municipality') payload.municipality_id = Number(municipalityId);
    if (scope === 'barangay') payload.barangay_id = Number(barangayId);

    setGenerateStatus('Generating report\u2026');
    setCreating(true);
    setPreviewData(null);
    setCurrentReport(null);
    createReport(payload)
      .then((res) => {
        setCreating(false);
        showPreview(res.report, res.data);
        setShowReports(true);
        loadReports();
        setGenerateStatus('Report generated. Preview is ready.');
        toastSuccess('The report has been generated and is ready to preview.', 'Report generated');
      })
      .catch((err) => {
        setCreating(false);
        const message = err.message || 'Something went wrong while generating the report. Please try again.';
        setPreviewError(message);
        setGenerateStatus(message);
        toastError(message);
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
        const message = err.message || 'Could not load this report. It may have been deleted.';
        setPreviewError(message);
        toastError(message);
      });
  };

  const handleDelete = async (r) => {
    const label = r.barangay_name
      ? ` for ${r.barangay_name}`
      : r.municipality_name ? ` for ${r.municipality_name}` : '';
    const confirmed = await confirmDelete({
      title: 'Delete this report?',
      text: `This will permanently remove the <strong>${reportTypeLabel(r)}</strong> report${label} and its file. This cannot be undone.`,
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    deleteReport(r.id)
      .then(() => {
        if (currentReport && currentReport.id === r.id) {
          setCurrentReport(null);
          setPreviewData(null);
        }
        loadReports();
        toastSuccess('The report has been deleted.', 'Report deleted');
      })
      .catch((err) => {
        const message = err.message || 'Could not delete this report.';
        setError(message);
        toastError(message);
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

  const previewScopeLabel = currentReport ? reportScopeLabel(currentReport) : '';

  const filteredReports = useMemo(() => {
    const term = reportSearch.trim().toLowerCase();
    return reports.filter((r) => {
      if (reportFormatFilter && r.format !== reportFormatFilter) return false;
      if (!term) return true;
      const haystack = [
        reportTypeLabel(r),
        r.report_type,
        r.municipality_name,
        r.barangay_name,
        r.requester_name,
        r.status,
        r.format,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [reports, reportSearch, reportFormatFilter]);

  const sortedReports = useMemo(() => {
    const accessor = SORT_ACCESSORS[sortKey] || SORT_ACCESSORS.created_at;
    const rows = [...filteredReports];
    rows.sort((a, b) => {
      const av = accessor(a) || '';
      const bv = accessor(b) || '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filteredReports, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedReports.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedReports = sortedReports.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageNumbers = useMemo(() => {
    const first = Math.max(1, Math.min(safePage - 2, totalPages - 4));
    const last = Math.min(totalPages, first + 4);
    const numbers = [];
    for (let i = first; i <= last; i += 1) numbers.push(i);
    return numbers;
  }, [safePage, totalPages]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'created_at' ? 'desc' : 'asc');
    }
  };

  const clearReportFilters = () => {
    setReportSearch('');
    setReportFormatFilter('');
  };

  const filterRowClass = timeMode === 'range'
    ? 'report-filter-row report-filter-row--range'
    : timeMode === 'year'
      ? 'report-filter-row report-filter-row--year'
      : 'report-filter-row report-filter-row--preset';

  return (
    <div>
      <PageHeader
        id="admin-reports"
        variant="clean"
        className="ui-pageheader--admin report-hero"
        title="Generate Reports"
        subtitle="Create summary reports for export based on the production records."
        art={<MunicipalityMapArt mode="province" activeNames={activeNames} />}
      />

      <Card className="encoder-card report-card">
        <Card.Header>
          <div className="admin-card-head">
            <span className="report-card-icon report-card-icon--create" aria-hidden="true">
              <FilePlus2 size={19} strokeWidth={2} />
            </span>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h5 className="admin-card-head-title">Create a New Report</h5>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          <div className={`report-form ${filterRowClass}`}>
            <div className="report-filter-field">
              <label className="report-form-label" htmlFor="report-content">Content</label>
              <Form.Select id="report-content" value={content} onChange={(e) => setContent(e.target.value)}>
                {CONTENT_TYPES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Form.Select>
            </div>

            <div className="report-filter-field report-filter-field--scope">
              <label className="report-form-label" htmlFor="report-scope">Scope</label>
              <Form.Select id="report-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
                {SCOPE_LEVELS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Form.Select>
            </div>

            <div className="report-filter-field report-filter-field--time">
              <label className="report-form-label" htmlFor="report-time-mode">Time</label>
              <Form.Select
                id="report-time-mode"
                value={timeMode}
                onChange={(e) => setTimeMode(e.target.value)}
              >
                {TIME_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>{mode.label}</option>
                ))}
              </Form.Select>
            </div>

            {timeMode === 'range' && (
              <>
                <div className="report-filter-field report-filter-field--date">
                  <label className="report-form-label" htmlFor="report-start-date">From date</label>
                  <Form.Control
                    id="report-start-date"
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                    aria-invalid={invalidRange || undefined}
                    aria-describedby={invalidRange ? 'report-date-error' : undefined}
                  />
                </div>
                <div className="report-filter-field report-filter-field--date">
                  <label className="report-form-label" htmlFor="report-end-date">To date</label>
                  <Form.Control
                    id="report-end-date"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    aria-invalid={invalidRange || undefined}
                    aria-describedby={invalidRange ? 'report-date-error' : undefined}
                  />
                </div>
              </>
            )}

            {timeMode === 'year' && (
              <div className="report-filter-field report-filter-field--year">
                <label className="report-form-label" htmlFor="report-year">Year</label>
                <Form.Select
                  id="report-year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  {years.length === 0 && <option value="">No years available</option>}
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Form.Select>
              </div>
            )}

            <div className="report-generate-group">
              <div className="report-format-seg" role="group" aria-label="Export format">
                {FORMAT_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className={`report-format-option${format === option.id ? ' is-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="report-format"
                      value={option.id}
                      checked={format === option.id}
                      onChange={() => setFormat(option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="ui-btn-primary report-generate-btn"
                onClick={handleView}
                disabled={creating}
                aria-busy={creating}
              >
                {creating ? (
                  <><Spinner as="span" animation="border" size="sm" aria-hidden="true" />Generating&hellip;</>
                ) : (
                  <><Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />Generate report</>
                )}
              </button>
            </div>
          </div>

          {invalidRange && (
            <p id="report-date-error" className="report-field-error" role="alert">
              From date must be on or before the To date.
            </p>
          )}

          {scope !== 'province' && (
            <div className="report-form report-scope-fields">
              <div className="report-filter-field">
                <label className="report-form-label" htmlFor="report-municipality">Municipality</label>
                <Form.Select id="report-municipality" value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)}>
                  <option value="">Select municipality&hellip;</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Form.Select>
              </div>
              {scope === 'barangay' && (
                <div className="report-filter-field">
                  <label className="report-form-label" htmlFor="report-barangay">Barangay</label>
                  <Form.Select id="report-barangay" value={barangayId} onChange={(e) => setBarangayId(e.target.value)} disabled={!municipalityId}>
                    <option value="">{municipalityId ? 'Select barangay\u2026' : 'Select a municipality first'}</option>
                    {visibleBarangays.map((b) => (
                      <option key={b.barangay_id} value={b.barangay_id}>{b.barangay}</option>
                    ))}
                  </Form.Select>
                </div>
              )}
            </div>
          )}

          {error && <Alert variant="danger" className="report-form-error" role="alert">{error}</Alert>}

          <p className="report-filter-hint">
            <Info size={14} strokeWidth={2} aria-hidden="true" />
            <span>Reports are built from approved records, then downloaded as PDF or Word.</span>
          </p>

          <p className="visually-hidden" role="status" aria-live="polite">
            {creating ? 'Generating report\u2026' : generateStatus}
          </p>
        </Card.Body>
      </Card>

      {previewError && (
        <Alert variant="danger" className="report-card">
          <strong>Could not show the report.</strong> {previewError}
        </Alert>
      )}

      {(currentReport || previewLoading) && (
        <Card className="encoder-card report-card" ref={previewRef}>
          <Card.Header>
            <div className="admin-card-head">
              <span className="report-card-icon report-card-icon--preview" aria-hidden="true">
                <Eye size={19} strokeWidth={2} />
              </span>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h5 className="admin-card-head-title">Report Preview</h5>
                {currentReport && (
                  <span className="badge text-bg-light">Report #{currentReport.id}</span>
                )}
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            {previewLoading ? (
              <div className="text-center p-2"><SkeletonChart height={280} /></div>
            ) : currentReport && (
              <>
                <div className="report-preview-meta">
                  <span><strong>Content:</strong> {reportTypeLabel(currentReport)}</span>
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
                    <SearchX size={32} strokeWidth={1.5} aria-hidden="true" />
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
                    <Download size={18} strokeWidth={2.2} aria-hidden="true" />Download PDF file
                  </a>
                  <a
                    className="report-dl-btn report-dl-btn--word"
                    href={getReportDownloadUrl(currentReport.id, 'docx')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download size={18} strokeWidth={2.2} aria-hidden="true" />Download Word (.docx) file
                  </a>
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      )}

      <Card className="encoder-card report-card report-list-card">
        <Card.Header className="report-list-head">
          <div className="admin-card-head">
            <span className="report-card-icon report-card-icon--list" aria-hidden="true">
              <ClipboardList size={19} strokeWidth={2} />
            </span>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h5 className="admin-card-head-title">Generated Reports</h5>
              {!loading && reports.length > 0 && (
                <span className="badge text-bg-light">{reports.length}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            className={`ui-btn-outline report-view-btn${showReports ? ' is-open' : ''}`}
            onClick={() => setShowReports((v) => !v)}
            aria-expanded={showReports}
            aria-controls="generated-reports-body"
          >
            {showReports ? 'Hide Reports' : 'View Reports'}
            <ChevronDown size={16} strokeWidth={2.2} className="report-view-chev" aria-hidden="true" />
          </button>
        </Card.Header>
        <Card.Body id="generated-reports-body">
          {!showReports ? (
            <div className="report-empty-state">
              <span className="report-empty-icon" aria-hidden="true"><EyeOff size={22} strokeWidth={1.8} /></span>
              <strong>Reports are hidden</strong>
              <p className="mb-0">Use &ldquo;View Reports&rdquo; to browse, download, or delete generated reports.</p>
            </div>
          ) : loading ? (
            <div className="text-center py-3"><SkeletonList rows={5} cols={6} /></div>
          ) : reports.length === 0 ? (
            <div className="report-empty-state">
              <span className="report-empty-icon" aria-hidden="true"><FileText size={22} strokeWidth={1.8} /></span>
              <strong>No reports yet</strong>
              <p className="mb-0">Generate your first report above and it will appear here.</p>
            </div>
          ) : (
            <>
              <div className="report-table-toolbar">
                <div className="report-search">
                  <Search size={16} strokeWidth={2} className="report-search-icon" aria-hidden="true" />
                  <label className="visually-hidden" htmlFor="report-search">Search reports</label>
                  <input
                    id="report-search"
                    type="search"
                    className="form-control"
                    placeholder="Search report, scope, or requester"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                  />
                </div>
                <div className="report-format-filter">
                  <label className="visually-hidden" htmlFor="report-format-filter">Filter by format</label>
                  <Form.Select
                    id="report-format-filter"
                    value={reportFormatFilter}
                    onChange={(e) => setReportFormatFilter(e.target.value)}
                  >
                    <option value="">All formats</option>
                    <option value="pdf">PDF</option>
                    <option value="docx">Word (DOCX)</option>
                  </Form.Select>
                </div>
                <span className="report-table-count" aria-live="polite">
                  {sortedReports.length} of {reports.length} report{reports.length === 1 ? '' : 's'}
                </span>
              </div>

              {sortedReports.length === 0 ? (
                <div className="report-empty-state">
                  <span className="report-empty-icon" aria-hidden="true"><SearchX size={22} strokeWidth={1.8} /></span>
                  <strong>No reports match your filters</strong>
                  <p className="mb-0">Try a different search term or format.</p>
                  <button type="button" className="ui-btn-outline report-clear-btn" onClick={clearReportFilters}>
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <Table responsive hover className="mb-0 report-list-table admin-table">
                    <thead>
                      <tr>
                        <SortableTh label="Report" column="report" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                        <SortableTh label="Scope" column="scope" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                        <SortableTh label="Period" column="period" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                        <SortableTh label="Format" column="format" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                        <SortableTh label="Generated by" column="requester" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                        <SortableTh label="Date" column="created_at" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                        <th className="report-actions-head">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedReports.map((r) => {
                        const generated = r.status === 'generated';
                        return (
                          <tr key={r.id}>
                            <td>
                              <div className="report-cell-name">
                                <button
                                  type="button"
                                  className="report-name-btn"
                                  onClick={() => openPreview(r)}
                                  disabled={!generated}
                                  title={generated ? 'Preview report' : 'Preview unavailable'}
                                >
                                  {reportTypeLabel(r)}
                                </button>
                                <span className={`report-status-badge report-status-badge--${r.status}`}>
                                  {r.status}
                                </span>
                              </div>
                            </td>
                            <td>{reportScopeLabel(r)}</td>
                            <td className="report-period-cell">{formatDateRange(r.date_range_start, r.date_range_end)}</td>
                            <td>
                              <span className={`report-format-badge ${formatBadgeClass(r.format)}`}>
                                {formatLabel(r.format)}
                              </span>
                            </td>
                            <td>{r.requester_name || '\u2014'}</td>
                            <td className="report-date-cell">{formatDateTime(r.created_at)}</td>
                            <td className="report-actions-cell">
                              <div className="report-row-actions">
                                <a
                                  className={`report-row-action report-row-action--pdf${generated ? '' : ' is-disabled'}`}
                                  href={generated ? getReportDownloadUrl(r.id, 'pdf') : undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Download PDF for ${reportTypeLabel(r)} report`}
                                  aria-disabled={!generated}
                                  tabIndex={generated ? undefined : -1}
                                  onClick={(e) => { if (!generated) e.preventDefault(); }}
                                >
                                  <Download size={14} strokeWidth={2.2} aria-hidden="true" />PDF
                                </a>
                                <a
                                  className={`report-row-action report-row-action--docx${generated ? '' : ' is-disabled'}`}
                                  href={generated ? getReportDownloadUrl(r.id, 'docx') : undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Download Word for ${reportTypeLabel(r)} report`}
                                  aria-disabled={!generated}
                                  tabIndex={generated ? undefined : -1}
                                  onClick={(e) => { if (!generated) e.preventDefault(); }}
                                >
                                  <Download size={14} strokeWidth={2.2} aria-hidden="true" />Word
                                </a>
                                <button
                                  type="button"
                                  className="report-row-action report-row-action--delete"
                                  onClick={() => handleDelete(r)}
                                  aria-label={`Delete ${reportTypeLabel(r)} report`}
                                  title="Delete report"
                                >
                                  <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>

                  <div className="report-pagination">
                    <span className="report-pagination-info">
                      Showing {pageStart + 1}&ndash;{Math.min(pageStart + PAGE_SIZE, sortedReports.length)} of {sortedReports.length}
                    </span>
                    <div className="report-pagination-btns">
                      <button
                        type="button"
                        className="report-page-btn"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        aria-label="Previous page"
                      >
                        <ChevronLeft size={15} aria-hidden="true" />
                      </button>
                      {pageNumbers.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`report-page-btn${n === safePage ? ' is-active' : ''}`}
                          onClick={() => setPage(n)}
                          aria-label={`Page ${n}`}
                          aria-current={n === safePage ? 'page' : undefined}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="report-page-btn"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        aria-label="Next page"
                      >
                        <ChevronRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
