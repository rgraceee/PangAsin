import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, Form, Table, Alert, Spinner } from 'react-bootstrap';
import {
  createReport,
  deleteReport,
  getAdminMonths,
  getAdminMunicipalities,
  getAdminStats,
  getEncoderReportOptions,
  getReport,
  getReportDownloadUrl,
  getReportFilterSuggestions,
  getReports,
  previewReport,
} from '../../services/dataService';
import { confirmDelete } from '../../services/feedback';
import { useToast } from '../Toast';
import { SkeletonChart, SkeletonList } from '../Skeleton';
import {
  ChevronDown,
  BarChart3,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Search,
  SearchX,
  Trash2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from './PageHeader';
import { displayHeader } from '../../constants/labels';
import {
  dataHasRows,
  formatCell,
  formatBadgeClass,
  formatDateRange,
  formatLabel,
  lastQuarterRange,
  reportDisplayTitle,
  reportScopeLabel,
  reportTypeLabel,
  thisMonthRange,
} from '../../utils/reportFormatters';

const CONTENT_TYPES = [
  { id: 'production', label: 'Production' },
  { id: 'producers', label: 'Salt Farmers' },
  { id: 'environment', label: 'Environment' },
];

const CONTENT_FILTER_FIELDS = {
  producers: [
    { key: 'q', label: 'Search all salt farmer fields', type: 'search' },
    { key: 'first_name', label: 'First name', type: 'search' },
    { key: 'last_name', label: 'Last name', type: 'search' },
    { key: 'sex', label: 'Sex', type: 'select', options: [['Male', 'Male'], ['Female', 'Female'], ['Unknown', 'Unknown']] },
    { key: 'age_group', label: 'Age group', type: 'select', options: [['under30', 'Under 30'], ['30to44', '30–44'], ['45to59', '45–59'], ['60plus', '60+']] },
    { key: 'production_method', label: 'Production method', type: 'select', options: [['solar', 'Solar'], ['cooked', 'Cooked'], ['hybrid', 'Hybrid']] },
    { key: 'min_age', label: 'Minimum age', type: 'number' },
    { key: 'max_age', label: 'Maximum age', type: 'number' },
    { key: 'salt_farm_owner', label: 'Salt farm / owner', type: 'search' },
    { key: 'designation', label: 'Designation', type: 'search' },
    { key: 'business_classification', label: 'Business classification', type: 'search' },
    { key: 'contact_number', label: 'Contact number', type: 'search' },
    { key: 'address', label: 'Address', type: 'search' },
  ],
  production: [
    { key: 'production_method', label: 'Production method', type: 'select', options: [['solar', 'Solar'], ['cooked', 'Cooked'], ['hybrid', 'Hybrid']] },
    { key: 'min_production_volume_mt', label: 'Minimum production (MT)', type: 'number' },
    { key: 'max_production_volume_mt', label: 'Maximum production (MT)', type: 'number' },
    { key: 'min_num_salt_beds', label: 'Minimum salt beds', type: 'number' },
    { key: 'max_num_salt_beds', label: 'Maximum salt beds', type: 'number' },
    { key: 'min_area_per_salt_bed', label: 'Minimum area per bed (m²)', type: 'number' },
    { key: 'max_area_per_salt_bed', label: 'Maximum area per bed (m²)', type: 'number' },
    { key: 'min_registered_producers', label: 'Minimum registered farmers', type: 'number' },
    { key: 'max_registered_producers', label: 'Maximum registered farmers', type: 'number' },
    { key: 'min_male_producers', label: 'Minimum male farmers', type: 'number' },
    { key: 'max_male_producers', label: 'Maximum male farmers', type: 'number' },
    { key: 'min_female_producers', label: 'Minimum female farmers', type: 'number' },
    { key: 'max_female_producers', label: 'Maximum female farmers', type: 'number' },
    { key: 'min_producers_18_30', label: 'Minimum farmers age 18–30', type: 'number' },
    { key: 'max_producers_18_30', label: 'Maximum farmers age 18–30', type: 'number' },
    { key: 'min_producers_31_40', label: 'Minimum farmers age 31–40', type: 'number' },
    { key: 'max_producers_31_40', label: 'Maximum farmers age 31–40', type: 'number' },
    { key: 'min_producers_41_50', label: 'Minimum farmers age 41–50', type: 'number' },
    { key: 'max_producers_41_50', label: 'Maximum farmers age 41–50', type: 'number' },
    { key: 'min_producers_51_60', label: 'Minimum farmers age 51–60', type: 'number' },
    { key: 'max_producers_51_60', label: 'Maximum farmers age 51–60', type: 'number' },
    { key: 'min_producers_61_plus', label: 'Minimum farmers age 61+', type: 'number' },
    { key: 'max_producers_61_plus', label: 'Maximum farmers age 61+', type: 'number' },
  ],
  environment: [
    { key: 'production_method', label: 'Production method', type: 'select', options: [['solar', 'Solar'], ['cooked', 'Cooked'], ['hybrid', 'Hybrid']] },
    { key: 'min_num_salt_beds', label: 'Minimum salt beds', type: 'number' },
    { key: 'max_num_salt_beds', label: 'Maximum salt beds', type: 'number' },
    { key: 'min_area_per_salt_bed', label: 'Minimum area per bed (m²)', type: 'number' },
    { key: 'max_area_per_salt_bed', label: 'Maximum area per bed (m²)', type: 'number' },
    { key: 'min_production_area_size', label: 'Minimum production area (m²)', type: 'number' },
    { key: 'max_production_area_size', label: 'Maximum production area (m²)', type: 'number' },
  ],
};

const CONTENT_FILTER_LAYOUT = {
  producers: {
    primary: ['q', 'sex', 'age_group', 'production_method'],
    advanced: [{
      label: 'Profile details',
      fields: [
        'first_name',
        'last_name',
        'min_age',
        'max_age',
        'salt_farm_owner',
        'designation',
        'business_classification',
        'contact_number',
        'address',
      ],
    }],
  },
  production: {
    primary: ['min_production_volume_mt', 'max_production_volume_mt'],
    advanced: [
      {
        label: 'Production method',
        fields: ['production_method'],
      },
      {
        label: 'Facility and area',
        fields: [
          'min_num_salt_beds',
          'max_num_salt_beds',
          'min_area_per_salt_bed',
          'max_area_per_salt_bed',
        ],
      },
      {
        label: 'Farmer counts',
        fields: [
          'min_registered_producers',
          'max_registered_producers',
          'min_male_producers',
          'max_male_producers',
          'min_female_producers',
          'max_female_producers',
        ],
      },
      {
        label: 'Farmers by age',
        fields: [
          'min_producers_18_30',
          'max_producers_18_30',
          'min_producers_31_40',
          'max_producers_31_40',
          'min_producers_41_50',
          'max_producers_41_50',
          'min_producers_51_60',
          'max_producers_51_60',
          'min_producers_61_plus',
          'max_producers_61_plus',
        ],
      },
    ],
  },
  environment: {
    primary: ['min_production_area_size', 'max_production_area_size'],
    advanced: [
      {
        label: 'Production method',
        fields: ['production_method'],
      },
      {
        label: 'Facility details',
        fields: [
          'min_num_salt_beds',
          'max_num_salt_beds',
          'min_area_per_salt_bed',
          'max_area_per_salt_bed',
        ],
      },
    ],
  },
};

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
  { id: 'province', label: 'Province-wide' },
  { id: 'municipality', label: 'Municipality' },
  { id: 'barangay', label: 'Barangay' },
];

const TIME_MODES = [
  { id: 'range', label: 'Date range' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_quarter', label: 'Last quarter' },
  { id: 'year', label: 'Year' },
];

const PREVIEW_ROW_LIMIT = 25;
const REPORT_PAGE_SIZE = 8;
const CHART_COLORS = ['#16803c', '#2878b8', '#e58a23', '#8956b3', '#d04f58', '#16a6a1', '#6c757d'];
const RECORD_COUNT_KEY = '__record_count';

function reportDateSearchValues(value) {
  if (!value) return [];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return [String(value)];
  return [String(value), date.toLocaleDateString(), date.toLocaleString()];
}

function SortableReportHeader({ label, column, activeKey, direction, onSort }) {
  const active = activeKey === column;
  return (
    <th aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`report-sort-btn${active ? ' is-active' : ''}`}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        {active ? <span aria-hidden="true">{direction === 'asc' ? '↑' : '↓'}</span> : <span aria-hidden="true">↕</span>}
      </button>
    </th>
  );
}

function chartFieldLabel(key) {
  return key === RECORD_COUNT_KEY ? 'Rows' : displayHeader(key);
}

function chartCategoryValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Not specified';
  return value === null || value === undefined || value === '' ? 'Not specified' : String(value);
}

function buildChartData(rows, categoryKey, seriesKeys) {
  const grouped = new Map();
  rows.forEach((row) => {
    const category = chartCategoryValue(row[categoryKey]);
    const bucket = grouped.get(category) || { [categoryKey]: category, __rows: 0 };
    bucket.__rows += 1;
    seriesKeys.forEach((key) => {
      if (key === RECORD_COUNT_KEY) {
        bucket[key] = bucket.__rows;
      } else if (typeof row[key] === 'number' && Number.isFinite(row[key])) {
        bucket[key] = (bucket[key] || 0) + row[key];
      }
    });
    grouped.set(category, bucket);
  });
  return [...grouped.values()].map(({ __rows, ...row }) => row);
}

const DATA_SECTIONS = [
  ['municipalities', 'Municipalities'],
  ['by_municipality', 'By Municipality'],
  ['by_barangay', 'By Barangay'],
  ['monthly_trend', 'Monthly Trend'],
  ['runs', 'Forecast Runs'],
  ['outlook', 'Municipality Outlook'],
  ['pangasinan', 'Pangasinan'],
  ['philippines', 'Philippines'],
  ['sector_demand_by_scope', 'Sector Demand Breakdown'],
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

function DataTable({ title, rows }) {
  if (!rows || rows.length === 0) return null;
  const headers = Object.keys(rows[0]);
  const previewRows = rows.slice(0, PREVIEW_ROW_LIMIT);
  return (
    <div className="mt-4">
      <h6 className="fw-bold">{title}</h6>
      {rows.length > PREVIEW_ROW_LIMIT && (
        <p className="small text-muted mb-2">
          Showing the first {PREVIEW_ROW_LIMIT} of {rows.length.toLocaleString()} matching rows. The generated report will include all matching rows.
        </p>
      )}
      <Table responsive bordered hover size="sm" className="mb-0 report-preview-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{displayHeader(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previewRows.map((row, i) => (
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

export default function GenerateReports({ encoderMode = false, user = null }) {
  const { toastError, toastSuccess } = useToast();
  const [content, setContent] = useState('production');
  const [scope, setScope] = useState(encoderMode ? 'municipality' : 'province');
  const [municipalityId, setMunicipalityId] = useState(
    encoderMode && user?.municipality_id ? String(user.municipality_id) : '',
  );
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
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState(null);
  const [showReports, setShowReports] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const [reportFormatFilter, setReportFormatFilter] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [reportPage, setReportPage] = useState(1);
  const [configurationError, setConfigurationError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [chartType, setChartType] = useState('bar');
  const [chartTableKey, setChartTableKey] = useState('');
  const [chartCategory, setChartCategory] = useState('');
  const [chartSeries, setChartSeries] = useState([]);
  const [contentFilterValues, setContentFilterValues] = useState({});
  const [activeSuggestionField, setActiveSuggestionField] = useState(null);
  const [contentFilterSuggestions, setContentFilterSuggestions] = useState({});
  const [suggestionLoadingField, setSuggestionLoadingField] = useState(null);
  const [suggestionError, setSuggestionError] = useState(null);
  const previewRef = React.useRef(null);
  const suggestionRequestRef = React.useRef(0);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const response = await getReports();
      setReports(response.reports || []);
    } catch (err) {
      setReportsError(err.message || 'Could not load generated reports. Please try again.');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!activeSuggestionField) return undefined;
    const search = String(contentFilterValues[activeSuggestionField] || '').trim();
    const activeField = CONTENT_FILTER_FIELDS[content]
      .find((field) => field.key === activeSuggestionField);
    if (activeField?.options) {
      setSuggestionError(null);
      setSuggestionLoadingField(null);
      return undefined;
    }

    let suggestionStart = startDate || undefined;
    let suggestionEnd = endDate || undefined;
    if (timeMode === 'year' && year) {
      suggestionStart = `${year}-01-01`;
      suggestionEnd = `${year}-12-31`;
    } else if (timeMode === 'this_month') {
      [suggestionStart, suggestionEnd] = thisMonthRange();
    } else if (timeMode === 'last_quarter') {
      [suggestionStart, suggestionEnd] = lastQuarterRange();
    }

    const requestId = ++suggestionRequestRef.current;
    const timeoutId = window.setTimeout(async () => {
      setSuggestionLoadingField(activeSuggestionField);
      try {
        const response = await getReportFilterSuggestions({
          report_type: content,
          field: activeSuggestionField,
          q: search,
          municipality_id: (encoderMode || scope !== 'province') ? municipalityId || undefined : undefined,
          barangay_id: scope === 'barangay' ? barangayId || undefined : undefined,
          date_range_start: suggestionStart,
          date_range_end: suggestionEnd,
        });
        if (requestId === suggestionRequestRef.current) {
          setContentFilterSuggestions((current) => ({
            ...current,
            [`${content}:${activeSuggestionField}`]: response.suggestions || [],
          }));
          setSuggestionLoadingField(null);
          setSuggestionError(null);
        }
      } catch (err) {
        if (requestId === suggestionRequestRef.current) {
          setSuggestionLoadingField(null);
          setSuggestionError(err.message || 'Could not load filter suggestions.');
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      suggestionRequestRef.current += 1;
    };
  }, [
    activeSuggestionField,
    barangayId,
    content,
    contentFilterValues,
    encoderMode,
    endDate,
    municipalityId,
    scope,
    startDate,
    timeMode,
    year,
  ]);

  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const invalidContentRange = Object.entries(contentFilterValues).some(([field, value]) => {
    if (!field.startsWith('min_') || value === '') return false;
    const maximum = contentFilterValues[field.replace(/^min_/, 'max_')];
    return maximum !== undefined && maximum !== '' && Number(value) > Number(maximum);
  });
  const contentFilterFieldsByKey = Object.fromEntries(
    CONTENT_FILTER_FIELDS[content].map((field) => [field.key, field]),
  );
  const advancedFilterCount = CONTENT_FILTER_LAYOUT[content].advanced
    .flatMap((group) => group.fields)
    .filter((key) => contentFilterValues[key])
    .length;

  const getFieldSuggestions = (field) => {
    const search = String(contentFilterValues[field.key] || '').trim().toLowerCase();
    const fixedOptions = (field.options || [])
      .filter(([value, label]) => (
        !search
        || value.toLowerCase().includes(search)
        || label.toLowerCase().includes(search)
      ))
      .map(([value, label]) => ({ value, label }));
    const dataOptions = (contentFilterSuggestions[`${content}:${field.key}`] || [])
      .filter((value) => String(value).toLowerCase().includes(search))
      .map((value) => ({ value, label: value }));
    return [...new Map(
      [...fixedOptions, ...dataOptions].map((option) => [option.value, option]),
    ).values()].slice(0, 10);
  };

  const selectSuggestion = (fieldKey, value) => {
    invalidateDraftPreview();
    setContentFilterValues((current) => ({ ...current, [fieldKey]: value }));
    setActiveSuggestionField(null);
    setSuggestionError(null);
  };

  const renderSuggestionList = (field) => {
    if (activeSuggestionField !== field.key) {
      return null;
    }
    const suggestions = getFieldSuggestions(field);
    const loading = suggestionLoadingField === field.key;
    return (
      <div className="report-filter-suggestions" role="listbox" aria-label={`${field.label} suggestions`}>
        {suggestionError ? (
          <div className="report-filter-suggestions-message" role="status">{suggestionError}</div>
        ) : loading ? (
          <div className="report-filter-suggestions-message" role="status">Loading suggestions…</div>
        ) : suggestions.length > 0 ? suggestions.map((suggestion) => (
          <button
            type="button"
            className="report-filter-suggestion"
            role="option"
            aria-selected="false"
            key={suggestion.value}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectSuggestion(field.key, suggestion.value)}
          >
            {suggestion.label}
          </button>
        )) : (
          <div className="report-filter-suggestions-message">No matching suggestions</div>
        )}
      </div>
    );
  };

  const renderContentFilterFields = (keys) => {
    const keySet = new Set(keys);
    const renderedKeys = new Set();
    return keys.flatMap((key) => {
      if (renderedKeys.has(key)) return [];
      const field = contentFilterFieldsByKey[key];
      const maximumKey = field.key.startsWith('min_') ? field.key.replace(/^min_/, 'max_') : null;
      const maximumField = maximumKey && keySet.has(maximumKey)
        ? contentFilterFieldsByKey[maximumKey]
        : null;
      renderedKeys.add(key);

      if (maximumField) {
        renderedKeys.add(maximumKey);
        const rangeLabel = field.label.replace(/^Minimum\s+/, '');
        const formattedRangeLabel = rangeLabel.charAt(0).toUpperCase() + rangeLabel.slice(1);
        return [(
          <div className="report-filter-item report-filter-range" key={field.key}>
            <span className="report-filter-item-label">{formattedRangeLabel}</span>
            <div className="report-filter-range-inputs">
              {[field, maximumField].map((rangeField) => (
                <div className="report-filter-suggestion-wrap" key={rangeField.key}>
                  <Form.Control
                    id={`report-content-filter-${rangeField.key}`}
                    aria-label={rangeField.label}
                    type="number"
                    min="0"
                    max={rangeField.key === 'min_age' || rangeField.key === 'max_age' ? '120' : undefined}
                    step="any"
                    value={contentFilterValues[rangeField.key] || ''}
                    disabled={creating}
                    placeholder={rangeField.key.startsWith('min_') ? 'Min' : 'Max'}
                    onChange={(e) => {
                      invalidateDraftPreview();
                      setActiveSuggestionField(rangeField.key);
                      setSuggestionLoadingField(rangeField.key);
                      setSuggestionError(null);
                      setContentFilterValues((current) => ({ ...current, [rangeField.key]: e.target.value }));
                    }}
                    onFocus={() => {
                      setActiveSuggestionField(rangeField.key);
                      setSuggestionLoadingField(rangeField.key);
                      setSuggestionError(null);
                    }}
                    onBlur={() => setActiveSuggestionField((current) => (
                      current === rangeField.key ? null : current
                    ))}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setActiveSuggestionField(null);
                    }}
                  />
                  {renderSuggestionList(rangeField)}
                </div>
              ))}
            </div>
          </div>
        )];
      }

      return [(
        <div
          className={`report-filter-item${field.key === 'q' ? ' report-filter-item--search' : ''}`}
          key={field.key}
        >
          <label className="report-filter-item-label" htmlFor={`report-content-filter-${field.key}`}>
            {field.label}
          </label>
          <div className="report-filter-suggestion-wrap">
            <Form.Control
              id={`report-content-filter-${field.key}`}
              type={field.type === 'select' ? 'search' : field.type}
              value={contentFilterValues[field.key] || ''}
              disabled={creating}
              placeholder={field.key === 'q' ? 'Search all fields' : field.label}
              onFocus={() => {
                setActiveSuggestionField(field.key);
                setSuggestionLoadingField(field.options ? null : field.key);
                setSuggestionError(null);
              }}
              onBlur={() => setActiveSuggestionField((current) => (
                current === field.key ? null : current
              ))}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setActiveSuggestionField(null);
              }}
              onChange={(e) => {
                invalidateDraftPreview();
                setActiveSuggestionField(field.key);
                setSuggestionLoadingField(field.key);
                setSuggestionError(null);
                const typedValue = e.target.value;
                const matchedOption = (field.options || []).find(([value, label]) => (
                  value.toLowerCase() === typedValue.toLowerCase()
                  || label.toLowerCase() === typedValue.toLowerCase()
                ));
                setContentFilterValues((current) => ({
                  ...current,
                  [field.key]: matchedOption ? matchedOption[0] : typedValue,
                }));
              }}
            />
            {renderSuggestionList(field)}
          </div>
        </div>
      )];
    });
  };

  useEffect(() => {
    const setAvailableYears = (months) => {
      const seen = new Set();
      const availableYears = [];
      (months || []).forEach((month) => {
        const value = String(month).slice(0, 4);
        if (value && !seen.has(value)) {
          seen.add(value);
          availableYears.push(value);
        }
      });
      setYears(availableYears.sort().reverse());
      if (availableYears.length > 0) setYear(availableYears[0]);
    };
    if (encoderMode) {
      getEncoderReportOptions()
        .then((res) => {
          setMunicipalities([res.municipality]);
          setMunicipalityId(String(res.municipality.id));
          setBarangaysByMuni({
            [res.municipality.id]: (res.barangays || []).map((barangay) => ({
              barangay_id: barangay.id,
              barangay: barangay.name,
            })),
          });
          setAvailableYears(res.months);
        })
        .catch((err) => {
          setConfigurationError(err.message || 'Could not load your municipality report options.');
        });
    } else {
      Promise.all([
        getAdminMunicipalities()
          .then((res) => setMunicipalities(res.municipalities || []))
          .catch((err) => {
            setConfigurationError(err.message || 'Could not load the municipality list.');
          }),
        getAdminStats()
          .then((stats) => {
            const map = {};
            (stats.by_municipality || []).forEach((m) => {
              map[m.municipality_id] = (m.by_barangay || []).sort((a, b) => a.barangay.localeCompare(b.barangay));
            });
            setBarangaysByMuni(map);
          })
          .catch((err) => {
            setConfigurationError(err.message || 'Could not load barangay options.');
          }),
        getAdminMonths()
          .then((res) => setAvailableYears(res.months))
          .catch((err) => {
            setConfigurationError(err.message || 'Could not load available report years.');
          }),
      ]);
    }
  }, [encoderMode]);

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

  const invalidateDraftPreview = () => {
    setCurrentReport(null);
    setPreviewData(null);
    setChartTableKey('');
    setChartCategory('');
    setChartSeries([]);
  };

  const updateFormValue = (setter, value) => {
    invalidateDraftPreview();
    setter(value);
  };

  const failPreview = (message) => {
    setError(message);
  };

  const buildReportPayload = () => {
    setError(null);
    setPreviewError(null);
    if (scope === 'municipality' && !municipalityId) {
      failPreview('Please select a municipality.');
      return null;
    }
    if (scope === 'barangay') {
      if (!municipalityId) { failPreview('Please select a municipality first.'); return null; }
      if (!barangayId) { failPreview('Please select a barangay.'); return null; }
    }
    if (timeMode === 'range' && ((startDate && !endDate) || (!startDate && endDate))) {
      failPreview('Set both a start and an end date, or leave both empty for all records.');
      return null;
    }
    if (timeMode === 'range' && invalidRange) {
      failPreview('From date must be on or before the To date.');
      return null;
    }
    if (timeMode === 'year' && !year) {
      failPreview('Select a year.');
      return null;
    }
    if (invalidContentRange) {
      failPreview('Minimum filter values cannot exceed their maximum values.');
      return null;
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
      date_range_start: start,
      date_range_end: end,
      filters: Object.fromEntries(
        Object.entries(content === 'producers'
          ? { ...contentFilterValues, view: 'farmers' }
          : contentFilterValues)
          .filter(([, value]) => value !== '' && value !== null && value !== undefined),
      ),
    };
    if (encoderMode || scope === 'municipality') payload.municipality_id = Number(municipalityId);
    if (scope === 'barangay') payload.barangay_id = Number(barangayId);
    return payload;
  };

  const showReportPreview = (report, data) => {
    setCurrentReport(report);
    setPreviewData(data);
    setChartTableKey('');
    setChartCategory('');
    setChartSeries([]);
    scrollToPreview();
  };

  const handlePreview = async () => {
    const payload = buildReportPayload();
    if (!payload) return;
    setCreating(true);
    setPreviewLoading(true);
    setPreviewData(null);
    setCurrentReport(null);
    previewReport(payload)
      .then((res) => {
        showReportPreview({
          report_type: content,
          municipality_id: payload.municipality_id || null,
          municipality_name: municipalities.find((item) => Number(item.id) === Number(payload.municipality_id))?.name || user?.municipality_name || null,
          barangay_id: payload.barangay_id || null,
          barangay_name: (barangaysByMuni[Number(municipalityId)] || [])
            .find((item) => String(item.barangay_id) === String(payload.barangay_id))?.barangay || null,
          date_range_start: payload.date_range_start,
          date_range_end: payload.date_range_end,
        }, res.data);
      })
      .catch((err) => {
        const message = err.message || 'Could not prepare the report preview. Please try again.';
        setPreviewError(message);
        toastError(message);
      })
      .finally(() => {
        setCreating(false);
        setPreviewLoading(false);
      });
  };

  const handleGenerateReport = async () => {
    const payload = buildReportPayload();
    if (!payload) return;
    setCreating(true);
    setPreviewLoading(true);
    setPreviewData(null);
    setCurrentReport(null);
    try {
      const response = await createReport({
        ...payload,
        format,
        title: `${TYPE_LABEL[content] || content} Report`,
      });
      showReportPreview(response.report, response.data);
      setShowReports(true);
      await loadReports();
      toastSuccess('The report has been generated and saved.', 'Report generated');
    } catch (err) {
      const message = err.message || 'Could not generate the report. Please try again.';
      setPreviewError(message);
      toastError(message);
    } finally {
      setCreating(false);
      setPreviewLoading(false);
    }
  };

  const openPreview = async (report) => {
    setPreviewError(null);
    setPreviewLoading(true);
    setCurrentReport(report);
    setPreviewData(null);
    try {
      const response = await getReport(report.id);
      showReportPreview(response.report, response.data);
    } catch (err) {
      const message = err.message || 'Could not load this report. It may have been deleted.';
      setPreviewError(message);
      toastError(message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeleteReport = async (report) => {
    const scopeLabel = report.barangay_name
      ? ` for ${report.barangay_name}`
      : report.municipality_name ? ` for ${report.municipality_name}` : '';
    await confirmDelete({
      title: 'Delete this report?',
      text: `This will permanently remove the ${reportDisplayTitle(report, TYPE_LABEL)} report${scopeLabel} and its files. This cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        await deleteReport(report.id);
        if (currentReport?.id === report.id) {
          setCurrentReport(null);
          setPreviewData(null);
        }
        await loadReports();
        toastSuccess('The report has been deleted.', 'Report deleted');
      },
    });
  };

  const previewTables = useMemo(() => {
    if (!previewData) return [];
    return DATA_SECTIONS.flatMap(([key, label]) => {
      if (key === 'sector_demand_by_scope') {
        const rows = Object.entries(previewData[key] || {}).flatMap(([scopeName, sectors]) => (
          (sectors || []).map((sector) => ({ scope: scopeName, ...sector }))
        ));
        return rows.length ? [{ key, label, rows }] : [];
      }
      if (key === 'pangasinan' || key === 'philippines') {
        const scopeData = previewData[key];
        return scopeData && Object.keys(scopeData).length
          ? [{ key, label: key === 'pangasinan' ? 'Pangasinan' : 'Philippines', rows: [scopeData] }]
          : [];
      }
      return previewData[key]?.length ? [{ key, label, rows: previewData[key] }] : [];
    });
  }, [previewData]);

  const selectedChartTable = previewTables.find((table) => table.key === chartTableKey) || previewTables[0];
  const chartFields = selectedChartTable?.rows?.[0] ? Object.keys(selectedChartTable.rows[0]) : [];
  const chartCategories = chartFields.filter((key) => (
    selectedChartTable.rows.some((row) => {
      const value = row[key];
      return typeof value === 'string' || Array.isArray(value);
    })
  ));
  const chartMeasures = [
    { key: RECORD_COUNT_KEY, label: 'Rows' },
    ...chartFields
      .filter((key) => selectedChartTable?.rows?.some((row) => typeof row[key] === 'number' && Number.isFinite(row[key])))
      .map((key) => ({ key, label: chartFieldLabel(key) })),
  ];

  useEffect(() => {
    if (!selectedChartTable) {
      if (chartTableKey) setChartTableKey('');
      if (chartCategory) setChartCategory('');
      if (chartSeries.length) setChartSeries([]);
      return;
    }
    if (chartTableKey !== selectedChartTable.key) setChartTableKey(selectedChartTable.key);
    if (!chartCategories.includes(chartCategory)) {
      setChartCategory(chartCategories[0] || '');
    }
    const measureKeys = chartMeasures.map((measure) => measure.key);
    const validSeries = chartSeries.filter((key) => measureKeys.includes(key));
    if (!validSeries.length && measureKeys.length) {
      setChartSeries([chartMeasures.find((measure) => measure.key !== RECORD_COUNT_KEY)?.key || RECORD_COUNT_KEY]);
    } else if (validSeries.length !== chartSeries.length) {
      setChartSeries(validSeries);
    }
  }, [selectedChartTable, chartTableKey, chartCategories, chartCategory, chartMeasures, chartSeries]);

  useEffect(() => {
    if (chartType === 'pie' && chartSeries.length > 1) {
      setChartSeries([chartSeries[0]]);
    }
  }, [chartType, chartSeries]);

  const chartData = useMemo(() => (
    selectedChartTable && chartCategory && chartSeries.length
      ? buildChartData(selectedChartTable.rows, chartCategory, chartType === 'pie' ? chartSeries.slice(0, 1) : chartSeries)
      : []
  ), [selectedChartTable, chartCategory, chartSeries, chartType]);

  const summaryLines = useMemo(() => {
    if (!previewData) return [];
    const lines = SUMMARY_LINES
      .map(([label, key, fmt]) => (previewData[key] != null ? { label, value: fmt(previewData[key]) } : null))
      .filter(Boolean);
    if (previewData.pangasinan?.demand_volume_mt != null) {
      lines.push({ label: 'Pangasinan demand', value: `${previewData.pangasinan.demand_volume_mt} Metric Tons (MT)` });
    }
    if (previewData.pangasinan?.local_production_mt != null) {
      lines.push({ label: 'Pangasinan production', value: `${previewData.pangasinan.local_production_mt} Metric Tons (MT)` });
    }
    if (previewData.philippines?.demand_volume_mt != null) {
      lines.push({ label: 'Philippines demand', value: `${previewData.philippines.demand_volume_mt} Metric Tons (MT)` });
    }
    return lines;
  }, [previewData]);

  const previewScopeLabel = currentReport ? reportScopeLabel(currentReport) : '';

  const filteredReports = useMemo(() => {
    const term = reportSearch.trim().toLowerCase();
    return reports.filter((report) => {
      if (reportFormatFilter && report.format !== reportFormatFilter) return false;
      if (!term) return true;
      const searchable = [
        reportDisplayTitle(report, TYPE_LABEL),
        reportTypeLabel(report, TYPE_LABEL),
        report.report_type,
        reportScopeLabel(report),
        report.municipality_name,
        report.barangay_name,
        formatDateRange(report.date_range_start, report.date_range_end),
        formatLabel(report.format),
        report.requester_name,
        report.status,
        ...reportDateSearchValues(report.created_at),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(term);
    });
  }, [reportFormatFilter, reportSearch, reports]);

  const sortedReports = useMemo(() => {
    const rows = [...filteredReports];
    rows.sort((left, right) => {
      const leftValue = sortKey === 'report'
        ? reportDisplayTitle(left, TYPE_LABEL)
        : sortKey === 'scope'
          ? reportScopeLabel(left)
          : sortKey === 'period'
            ? `${left.date_range_start || ''} ${left.date_range_end || ''}`
            : sortKey === 'format'
              ? formatLabel(left.format)
              : sortKey === 'requester'
                ? left.requester_name || ''
                : left.created_at || '';
      const rightValue = sortKey === 'report'
        ? reportDisplayTitle(right, TYPE_LABEL)
        : sortKey === 'scope'
          ? reportScopeLabel(right)
          : sortKey === 'period'
            ? `${right.date_range_start || ''} ${right.date_range_end || ''}`
            : sortKey === 'format'
              ? formatLabel(right.format)
              : sortKey === 'requester'
                ? right.requester_name || ''
                : right.created_at || '';
      const comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return sortDir === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [filteredReports, sortDir, sortKey]);

  const reportPageCount = Math.max(1, Math.ceil(sortedReports.length / REPORT_PAGE_SIZE));
  const safeReportPage = Math.min(reportPage, reportPageCount);
  const pagedReports = sortedReports.slice(
    (safeReportPage - 1) * REPORT_PAGE_SIZE,
    safeReportPage * REPORT_PAGE_SIZE,
  );

  useEffect(() => {
    if (reportPage > reportPageCount) setReportPage(reportPageCount);
  }, [reportPage, reportPageCount]);

  const toggleReportSort = (key) => {
    if (sortKey === key) {
      setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'created_at' ? 'desc' : 'asc');
    }
  };

  const clearReportFilters = () => {
    setReportSearch('');
    setReportFormatFilter('');
    setReportPage(1);
  };

  return (
    <div className="rg-page">
      <PageHeader
        id={encoderMode ? 'encoder-reports' : 'admin-reports'}
        variant="clean"
        className="ui-pageheader--admin ui-pageheader--no-map"
        title="Generate Reports"
        subtitle={encoderMode
          ? `Filter and visualize production, salt farmer, and environment data for ${user?.municipality_name || 'your municipality'}, or save PDF and Excel reports.`
          : 'Filter report data, build charts, and save reports as PDF or Excel.'}
      >
        <div className="rg-hero-row">
            <div className="report-filter-field admin-page-hero-control">
              <label className="admin-page-hero-field" htmlFor="report-content">Content</label>
              <Form.Select
                id="report-content"
                className="admin-page-hero-select"
                value={content}
                disabled={creating}
                onChange={(e) => {
                  updateFormValue(setContent, e.target.value);
                  setContentFilterValues({});
                }}
              >
                {CONTENT_TYPES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Form.Select>
            </div>

            <div className="report-filter-field report-filter-field--scope admin-page-hero-control">
              <label className="admin-page-hero-field" htmlFor="report-scope">Scope</label>
              <Form.Select
                id="report-scope"
                className="admin-page-hero-select"
                value={scope}
                disabled={creating}
                onChange={(e) => updateFormValue(setScope, e.target.value)}
              >
                {(encoderMode
                  ? [
                    { id: 'municipality', label: 'My Municipality' },
                    { id: 'barangay', label: 'Barangay' },
                  ]
                  : SCOPE_LEVELS).map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Form.Select>
            </div>

            <div className="report-filter-field report-filter-field--time admin-page-hero-control">
              <label className="admin-page-hero-field" htmlFor="report-time-mode">Time</label>
              <Form.Select
                id="report-time-mode"
                className="admin-page-hero-select"
                value={timeMode}
                disabled={creating}
                onChange={(e) => updateFormValue(setTimeMode, e.target.value)}
              >
                {TIME_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>{mode.label}</option>
                ))}
              </Form.Select>
            </div>

            {timeMode === 'range' && (
              <>
                <div className="report-filter-field report-filter-field--date admin-page-hero-control">
                  <label className="admin-page-hero-field" htmlFor="report-start-date">From date</label>
                  <Form.Control
                    id="report-start-date"
                    className="admin-page-hero-input"
                    type="date"
                    value={startDate}
                    disabled={creating}
                    max={endDate || undefined}
                    onChange={(e) => updateFormValue(setStartDate, e.target.value)}
                    aria-invalid={invalidRange || undefined}
                    aria-describedby={invalidRange ? 'report-date-error' : undefined}
                  />
                </div>
                <div className="report-filter-field report-filter-field--date admin-page-hero-control">
                  <label className="admin-page-hero-field" htmlFor="report-end-date">To date</label>
                  <Form.Control
                    id="report-end-date"
                    className="admin-page-hero-input"
                    type="date"
                    value={endDate}
                    disabled={creating}
                    min={startDate || undefined}
                    onChange={(e) => updateFormValue(setEndDate, e.target.value)}
                    aria-invalid={invalidRange || undefined}
                    aria-describedby={invalidRange ? 'report-date-error' : undefined}
                  />
                </div>
              </>
            )}

            {timeMode === 'year' && (
              <div className="report-filter-field report-filter-field--year admin-page-hero-control">
                <label className="admin-page-hero-field" htmlFor="report-year">Year</label>
                <Form.Select
                  id="report-year"
                  className="admin-page-hero-select"
                  value={year}
                  disabled={creating}
                  onChange={(e) => updateFormValue(setYear, e.target.value)}
                >
                  {years.length === 0 && <option value="">No years available</option>}
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Form.Select>
              </div>
            )}

            <div className="report-generate-group">
              <div className="report-chart-type-options" role="group" aria-label="Chart type">
                {[
                  { id: 'bar', label: 'Bar', icon: BarChart3 },
                  { id: 'line', label: 'Line', icon: LineChartIcon },
                  { id: 'pie', label: 'Pie', icon: PieChartIcon },
                ].map((option) => {
                  const Icon = option.icon;
                  return (
                  <button
                    key={option.id}
                    type="button"
                    className={`report-chart-type-option${chartType === option.id ? ' is-active' : ''}`}
                    aria-pressed={chartType === option.id}
                    disabled={creating}
                    onClick={() => setChartType(option.id)}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {option.label}
                  </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="ui-btn-outline report-generate-btn"
                onClick={handlePreview}
                disabled={creating}
                aria-busy={creating}
              >
                  {creating ? (
                    <><Spinner as="span" animation="border" size="sm" aria-hidden="true" />Loading data&hellip;</>
                  ) : (
                    <><Eye size={16} strokeWidth={2} aria-hidden="true" />Build chart</>
                  )}
              </button>
              <div className="report-format-options" role="group" aria-label="Report export format">
                {[
                  { id: 'pdf', label: 'PDF' },
                  { id: 'excel', label: 'Excel' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`report-format-option${format === option.id ? ' is-active' : ''}`}
                    aria-pressed={format === option.id}
                    disabled={creating}
                    onClick={() => setFormat(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ui-btn-primary report-generate-btn"
                onClick={handleGenerateReport}
                disabled={creating}
                aria-busy={creating}
              >
                {creating ? (
                  <><Spinner as="span" animation="border" size="sm" aria-hidden="true" />Generating&hellip;</>
                ) : (
                  <><FileDown size={16} strokeWidth={2} aria-hidden="true" />Generate report</>
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
              <div className="report-filter-field admin-page-hero-control">
                <label className="admin-page-hero-field" htmlFor="report-municipality">Municipality</label>
                {encoderMode ? (
                  <Form.Control
                    id="report-municipality"
                    className="admin-page-hero-input"
                    value={user?.municipality_name || municipalities[0]?.name || ''}
                    readOnly
                    aria-label="Municipality"
                  />
                ) : (
                  <Form.Select
                    id="report-municipality"
                    className="admin-page-hero-select"
                    value={municipalityId}
                    disabled={creating}
                    onChange={(e) => updateFormValue(setMunicipalityId, e.target.value)}
                  >
                    <option value="">Select municipality&hellip;</option>
                    {municipalities.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Form.Select>
                )}
              </div>
              {scope === 'barangay' && (
                <div className="report-filter-field admin-page-hero-control">
                  <label className="admin-page-hero-field" htmlFor="report-barangay">Barangay</label>
                  <Form.Select
                    id="report-barangay"
                    className="admin-page-hero-select"
                    value={barangayId}
                    disabled={creating || !municipalityId}
                    onChange={(e) => updateFormValue(setBarangayId, e.target.value)}
                  >
                    <option value="">{municipalityId ? 'Select barangay\u2026' : 'Select a municipality first'}</option>
                    {visibleBarangays.map((b) => (
                      <option key={b.barangay_id} value={b.barangay_id}>{b.barangay}</option>
                    ))}
                  </Form.Select>
                </div>
              )}
            </div>
          )}

          <Card className="report-content-filters">
            <Card.Header className="d-flex align-items-center justify-content-between gap-2">
              <div>
                <h2 className="h6 mb-0">{TYPE_LABEL[content]} filters</h2>
              </div>
              <button
                type="button"
                className="ui-btn-text"
                aria-label={`Clear ${TYPE_LABEL[content]} content filters`}
                onClick={() => updateFormValue(setContentFilterValues, {})}
                disabled={creating || Object.values(contentFilterValues).every((value) => !value)}
              >
                Clear filters
              </button>
            </Card.Header>
            <Card.Body>
              {invalidContentRange && (
                <p className="report-field-error" role="alert">
                  Minimum values cannot exceed their corresponding maximum values.
                </p>
              )}
              <div className="report-filter-grid">
                {renderContentFilterFields(CONTENT_FILTER_LAYOUT[content].primary)}
              </div>
              {CONTENT_FILTER_LAYOUT[content].advanced.length > 0 && (
                <details className="report-filter-advanced">
                  <summary>
                    <span>More filters</span>
                    {advancedFilterCount > 0 && (
                      <span className="report-filter-count">{advancedFilterCount} active</span>
                    )}
                  </summary>
                  <div className="report-filter-grid report-filter-grid--advanced">
                    {CONTENT_FILTER_LAYOUT[content].advanced.map((group) => {
                      const activeGroupFilterCount = group.fields
                        .filter((key) => contentFilterValues[key])
                        .length;
                      return (
                        <details className="report-filter-group" key={group.label}>
                          <summary>
                            <span>{group.label}</span>
                            {activeGroupFilterCount > 0 && (
                              <span className="report-filter-count">{activeGroupFilterCount} active</span>
                            )}
                          </summary>
                          <div className="report-filter-grid report-filter-grid--group">
                            {renderContentFilterFields(group.fields)}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </details>
              )}
            </Card.Body>
          </Card>

          {error && <Alert variant="danger" className="report-form-error" role="alert">{error}</Alert>}
          {configurationError && (
            <Alert variant="danger" className="report-form-error" role="alert">
              {configurationError}
            </Alert>
          )}


      </PageHeader>

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
                <Eye size={16} strokeWidth={2} />
              </span>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h5 className="admin-card-head-title">Report Preview</h5>
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            {previewLoading ? (
              <div className="text-center p-2"><SkeletonChart height={280} /></div>
            ) : currentReport && (
              <>
                <div className="report-preview-meta">
                  <span><strong>Report:</strong> {previewData?.report_title || TYPE_LABEL[currentReport.report_type]}</span>
                  <span><strong>Content:</strong> {TYPE_LABEL[currentReport.report_type]}</span>
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
                  <>
                    <section className="report-chart-builder mt-4" aria-label="Chart builder">
                      <div className="report-chart-controls">
                        <div className="report-filter-field">
                          <label className="admin-page-hero-field" htmlFor="report-chart-data">Chart data</label>
                          <Form.Select
                            id="report-chart-data"
                            value={selectedChartTable?.key || ''}
                            onChange={(event) => {
                              setChartTableKey(event.target.value);
                              setChartCategory('');
                              setChartSeries([]);
                            }}
                          >
                            {previewTables.map((table) => (
                              <option key={table.key} value={table.key}>{table.label}</option>
                            ))}
                          </Form.Select>
                        </div>
                        <div className="report-filter-field">
                          <label className="admin-page-hero-field" htmlFor="report-chart-category">Category</label>
                          <Form.Select
                            id="report-chart-category"
                            value={chartCategory}
                            onChange={(event) => setChartCategory(event.target.value)}
                            disabled={!chartCategories.length}
                          >
                            {chartCategories.map((key) => (
                              <option key={key} value={key}>{chartFieldLabel(key)}</option>
                            ))}
                          </Form.Select>
                        </div>
                      </div>

                      <fieldset className="report-chart-series">
                        <legend>{chartType === 'pie' ? 'Value column' : 'Data columns'}</legend>
                        {chartMeasures.length ? chartMeasures.map((measure) => (
                          <label className="report-chart-series-option" key={measure.key}>
                            <input
                              type={chartType === 'pie' ? 'radio' : 'checkbox'}
                              name="report-chart-series"
                              value={measure.key}
                              checked={chartSeries.includes(measure.key)}
                              onChange={(event) => {
                                if (chartType === 'pie') {
                                  setChartSeries([measure.key]);
                                } else {
                                  setChartSeries((current) => (
                                    event.target.checked
                                      ? [...current, measure.key]
                                      : current.filter((key) => key !== measure.key)
                                  ));
                                }
                              }}
                            />
                            {measure.label}
                          </label>
                        )) : (
                          <span className="text-muted">No numeric columns are available for this data.</span>
                        )}
                      </fieldset>

                      <div className="report-print-area">
                        <div className="report-chart-heading">
                          <h2>{previewData?.report_title || 'Report chart'}</h2>
                          <p>{previewScopeLabel} · {formatDateRange(currentReport.date_range_start, currentReport.date_range_end)}</p>
                          <h3>{selectedChartTable?.label} — {chartType.charAt(0).toUpperCase() + chartType.slice(1)} chart</h3>
                        </div>
                        {chartData.length && chartSeries.length && chartCategory ? (
                          <div className="report-chart-visual" aria-label={`${chartType} chart`}>
                            <ResponsiveContainer width="100%" height="100%">
                              {chartType === 'pie' ? (
                                <PieChart>
                                  <Tooltip />
                                  <Legend />
                                  <Pie
                                    data={chartData}
                                    dataKey={chartSeries[0]}
                                    nameKey={chartCategory}
                                    outerRadius="72%"
                                    label
                                  >
                                    {chartData.map((entry, index) => (
                                      <Cell key={entry[chartCategory]} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                  </Pie>
                                </PieChart>
                              ) : chartType === 'line' ? (
                                <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 28, left: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey={chartCategory} angle={-25} textAnchor="end" interval="preserveStartEnd" />
                                  <YAxis />
                                  <Tooltip />
                                  <Legend />
                                  {chartSeries.map((key, index) => (
                                    <Line
                                      key={key}
                                      type="monotone"
                                      dataKey={key}
                                      name={chartFieldLabel(key)}
                                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                                      strokeWidth={2}
                                      dot={false}
                                    />
                                  ))}
                                </LineChart>
                              ) : (
                                <BarChart data={chartData} margin={{ top: 12, right: 24, bottom: 28, left: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey={chartCategory} angle={-25} textAnchor="end" interval="preserveStartEnd" />
                                  <YAxis />
                                  <Tooltip />
                                  <Legend />
                                  {chartSeries.map((key, index) => (
                                    <Bar
                                      key={key}
                                      dataKey={key}
                                      name={chartFieldLabel(key)}
                                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                                    />
                                  ))}
                                </BarChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="report-chart-empty" role="status">
                            Choose a category and at least one numeric column to build a chart.
                          </div>
                        )}
                      </div>

                      <div className="report-preview-footer report-chart-actions">
                        <button
                          type="button"
                          className="ui-btn-primary report-generate-btn"
                          onClick={() => window.print()}
                          disabled={!chartData.length || !chartSeries.length || !chartCategory}
                        >
                          <FileDown size={16} strokeWidth={2} aria-hidden="true" />
                          Save chart as PDF
                        </button>
                        <span className="small text-muted">Choose “Save as PDF” in the print dialog.</span>
                      </div>
                    </section>
                    {previewTables.map((table) => <DataTable key={table.key} title={table.label} rows={table.rows} />)}
                  </>
                ) : (
                  <div className="report-preview-empty">
                    <SearchX size={32} strokeWidth={1.5} aria-hidden="true" />
                    <strong>No matching records found</strong>
                    <p className="mb-0">
                      No matching records for {previewScopeLabel.toLowerCase()} in{' '}
                      {formatDateRange(currentReport.date_range_start, currentReport.date_range_end)}.
                      Try a wider date range, a different scope, or adjust the content filters.
                    </p>
                  </div>
                )}

              </>
            )}
          </Card.Body>
        </Card>
      )}

      <Card className="encoder-card report-card report-list-card">
        <Card.Header className="report-list-head">
          <div className="admin-card-head">
            <span className="report-card-icon report-card-icon--list" aria-hidden="true">
              <ClipboardList size={16} strokeWidth={2} />
            </span>
            <div className="report-card-head-text">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h5 className="admin-card-head-title">Generated Reports</h5>
                {!reportsLoading && reports.length > 0 && (
                  <span className="badge text-bg-light rounded-pill">{reports.length}</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className={`ui-btn-outline report-view-btn${showReports ? ' is-open' : ''}`}
            onClick={() => setShowReports((visible) => !visible)}
            aria-expanded={showReports}
            aria-controls="generated-reports-body"
          >
            {showReports ? 'Hide Reports' : 'View Reports'}
            <ChevronDown size={16} strokeWidth={2} className="report-view-chev" aria-hidden="true" />
          </button>
        </Card.Header>
        <Card.Body id="generated-reports-body">
          {reportsError ? (
            <Alert variant="danger" className="mb-0" role="alert">
              <strong>Could not load generated reports.</strong> {reportsError}
              <button type="button" className="ui-btn-outline report-clear-btn" onClick={loadReports}>
                Retry
              </button>
            </Alert>
          ) : !showReports ? (
            <div className="report-empty-state">
              <span className="report-empty-icon" aria-hidden="true"><EyeOff size={22} strokeWidth={1.8} /></span>
              <strong>Reports are hidden</strong>
            </div>
          ) : reportsLoading ? (
            <div className="text-center py-3"><SkeletonList rows={5} cols={6} /></div>
          ) : reports.length === 0 ? (
            <div className="report-empty-state">
              <span className="report-empty-icon" aria-hidden="true"><FileText size={22} strokeWidth={1.8} /></span>
              <strong>No reports yet</strong>
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
                    placeholder="Search reports by name, scope, period, format, or date"
                    value={reportSearch}
                    onChange={(event) => {
                      setReportSearch(event.target.value);
                      setReportPage(1);
                    }}
                  />
                </div>
                <div className="report-format-filter">
                  <label className="visually-hidden" htmlFor="report-format-filter">Filter by format</label>
                  <Form.Select
                    id="report-format-filter"
                    value={reportFormatFilter}
                    onChange={(event) => {
                      setReportFormatFilter(event.target.value);
                      setReportPage(1);
                    }}
                  >
                    <option value="">All formats</option>
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel (XLSX)</option>
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
                  <button type="button" className="ui-btn-outline report-clear-btn" onClick={clearReportFilters}>
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="report-table-wrap">
                    <Table responsive hover className="mb-0 report-list-table encoder-table admin-table">
                      <thead>
                        <tr>
                          <SortableReportHeader label="Report" column="report" activeKey={sortKey} direction={sortDir} onSort={toggleReportSort} />
                          <SortableReportHeader label="Scope" column="scope" activeKey={sortKey} direction={sortDir} onSort={toggleReportSort} />
                          <SortableReportHeader label="Period" column="period" activeKey={sortKey} direction={sortDir} onSort={toggleReportSort} />
                          <SortableReportHeader label="Format" column="format" activeKey={sortKey} direction={sortDir} onSort={toggleReportSort} />
                          <SortableReportHeader label="Generated by" column="requester" activeKey={sortKey} direction={sortDir} onSort={toggleReportSort} />
                          <SortableReportHeader label="Date" column="created_at" activeKey={sortKey} direction={sortDir} onSort={toggleReportSort} />
                          <th className="report-actions-head">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedReports.map((report) => {
                          const generated = report.status === 'generated';
                          return (
                            <tr key={report.id}>
                              <td>
                                <div className="report-cell-name">
                                  <button
                                    type="button"
                                    className="report-name-btn"
                                    onClick={() => openPreview(report)}
                                    disabled={!generated}
                                  >
                                    {reportDisplayTitle(report, TYPE_LABEL)}
                                  </button>
                                  {report.status && report.status !== 'generated' && (
                                    <span className="badge text-bg-secondary">{report.status}</span>
                                  )}
                                </div>
                              </td>
                              <td>{reportScopeLabel(report)}</td>
                              <td>{formatDateRange(report.date_range_start, report.date_range_end)}</td>
                              <td>
                                <span className={`report-format-badge ${formatBadgeClass(report.format)}`}>
                                  {formatLabel(report.format)}
                                </span>
                              </td>
                              <td>{report.requester_name || '—'}</td>
                              <td>{report.created_at ? new Date(report.created_at).toLocaleDateString() : '—'}</td>
                              <td className="report-actions-cell">
                                <div className="report-row-actions">
                                  <button
                                    type="button"
                                    className="ui-btn-outline ui-btn--sm report-row-btn"
                                    onClick={() => openPreview(report)}
                                    disabled={!generated}
                                    aria-label={`Preview ${reportDisplayTitle(report, TYPE_LABEL)} report`}
                                    title="Preview report"
                                  >
                                    <Eye size={14} strokeWidth={2.2} aria-hidden="true" />
                                  </button>
                                  {generated && (
                                    <>
                                      <a
                                        className="ui-btn-outline ui-btn--sm report-row-btn"
                                        href={getReportDownloadUrl(report.id, 'pdf')}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Download PDF for ${reportDisplayTitle(report, TYPE_LABEL)} report`}
                                        title="Download PDF"
                                      >
                                        <Download size={14} strokeWidth={2.2} aria-hidden="true" />
                                        <span className="visually-hidden">PDF</span>
                                      </a>
                                      <a
                                        className="ui-btn-outline ui-btn--sm report-row-btn"
                                        href={getReportDownloadUrl(report.id, 'excel')}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Download Excel for ${reportDisplayTitle(report, TYPE_LABEL)} report`}
                                        title="Download Excel"
                                      >
                                        <Download size={14} strokeWidth={2.2} aria-hidden="true" />
                                        <span className="visually-hidden">Excel</span>
                                      </a>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    className="ui-btn-danger ui-btn--sm report-row-btn"
                                    onClick={() => handleDeleteReport(report)}
                                    aria-label={`Delete ${reportDisplayTitle(report, TYPE_LABEL)} report`}
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
                  </div>
                  {reportPageCount > 1 && (
                    <div className="report-pagination">
                      <span className="report-pagination-info">
                        Page {safeReportPage} of {reportPageCount}
                      </span>
                      <div className="report-pagination-btns">
                        <button
                          type="button"
                          className="ui-btn-outline ui-btn--sm"
                          onClick={() => setReportPage((page) => Math.max(1, page - 1))}
                          disabled={safeReportPage === 1}
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          className="ui-btn-outline ui-btn--sm"
                          onClick={() => setReportPage((page) => Math.min(reportPageCount, page + 1))}
                          disabled={safeReportPage === reportPageCount}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Card.Body>
      </Card>

    </div>
  );
}
