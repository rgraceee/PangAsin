import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Card, Table } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import { Clock, Layers, Leaf, MapPin, Plus } from 'lucide-react';
import {
  createEncoderEnvironmentReport,
  getEncoderBarangays,
  getEncoderEnvironmentReports,
} from '../../services/dataService';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';
import { SkeletonList } from '../Skeleton';
import PageHeader from '../admin/PageHeader';
import MunicipalityMapArt from './MunicipalityMapArt';
import ReportImportActions from './ReportImportActions';
import EnvironmentReportForm from './EnvironmentReportForm';
import PeriodFilters, { usePeriodFilters } from './PeriodFilters';
import { findBarangay, numberValue, rowError } from './reportImportUtils';
import { STATUS_LABELS, STATUS_OPTIONS } from '../../constants/labels';

const METHODS = [
  { id: 'cooked', label: 'Cooked' },
  { id: 'solar', label: 'Solar' },
  { id: 'hybrid', label: 'Hybrid' },
];

const STATUS_VARIANTS = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

function submittedDate(report) {
  const raw = report.created_at || report.submitted_at || '';
  return raw ? String(raw).slice(0, 10) : '';
}

export default function EnvironmentRecordsPage() {
  const { user } = useOutletContext();
  const [reports, setReports] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [filters, setFilters] = useState({ barangay_id: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  /* WHAT: Year options mula sa mga buwan na may environment report.
     WHY: hindi lahat ng production months ay may environment report. */
  const reportMonths = useMemo(
    () => [...new Set(reports.map((report) => submittedDate(report).slice(0, 7)).filter(Boolean))],
    [reports],
  );
  const period = usePeriodFilters(reportMonths);
  const { range, rangeError } = period;

  useEffect(() => {
    getEncoderBarangays()
      .then((result) => setBarangays(result.barangays || []))
      .catch((err) => setError(err.message || 'Could not load barangays.'));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getEncoderEnvironmentReports()
      .then((result) => setReports(result.reports || []))
      .catch((err) => setError(err.message || 'Could not load environment records.'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return reports.filter((report) => {
      if (filters.barangay_id && String(report.barangay_id) !== String(filters.barangay_id)) return false;
      if (filters.status && report.status !== filters.status) return false;
      const submitted = submittedDate(report);
      if (range.start && (!submitted || submitted < range.start)) return false;
      if (range.end && (!submitted || submitted > range.end)) return false;
      return true;
    });
  }, [reports, filters.barangay_id, filters.status, range.start, range.end]);

  const totals = useMemo(() => {
    const pending = filtered.filter((report) => report.status === 'pending').length;
    const covered = new Set(filtered.map((report) => report.barangay_id));

    // WHAT: Pinakabagong report lang kada barangay ang bilangin.
    // WHY: kapag may re-report, hindi dapat doble ang salt beds.
    const latestBeds = new Map();
    [...filtered]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .forEach((report) => {
        if (!latestBeds.has(report.barangay_id)) {
          latestBeds.set(report.barangay_id, Number(report.num_salt_beds) || 0);
        }
      });
    const saltBeds = [...latestBeds.values()].reduce((sum, value) => sum + value, 0);

    return { count: filtered.length, pending, covered: covered.size, saltBeds };
  }, [filtered]);

  const hasFilter = Boolean(filters.barangay_id || filters.status || period.activePreset !== 'all');
  const municipalityName = user?.municipality_name || 'your municipality';

  const clearFilters = () => {
    setFilters({ barangay_id: '', status: '' });
    period.resetPeriod();
  };
  const refresh = () => setRefreshKey((key) => key + 1);

  const importEnvironmentRows = async (rows) => {
    const errors = [];
    const prepared = rows.map((row) => {
      const barangay = findBarangay(row, barangays);
      const numSaltBeds = numberValue(row.num_salt_beds);
      const areaPerSaltBed = numberValue(row.area_per_salt_bed);
      const productionAreaSize = numberValue(row.production_area_size);
      const productionMethods = String(row.production_methods || '')
        .split(/[|;,]/)
        .map((method) => method.trim().toLowerCase())
        .filter(Boolean);
      if (!barangay) errors.push(rowError(row, 'barangay must match a barangay in your municipality.'));
      if (!Number.isInteger(numSaltBeds) || numSaltBeds <= 0) errors.push(rowError(row, 'num_salt_beds must be a positive whole number.'));
      if (!Number.isFinite(areaPerSaltBed) || areaPerSaltBed < 0) errors.push(rowError(row, 'area_per_salt_bed must be zero or greater.'));
      if (!Number.isFinite(productionAreaSize) || productionAreaSize < 0) errors.push(rowError(row, 'production_area_size must be zero or greater.'));
      if (!productionMethods.length || productionMethods.some((method) => !METHODS.some((option) => option.id === method))) {
        errors.push(rowError(row, 'production_methods must contain cooked, solar, and/or hybrid, separated by |.'));
      }
      return {
        barangay_id: barangay?.id,
        num_salt_beds: numSaltBeds,
        area_per_salt_bed: areaPerSaltBed,
        production_area_size: productionAreaSize,
        production_methods: [...new Set(productionMethods)],
        rowNumber: row._row_number,
      };
    });
    if (errors.length) throw new Error(errors.join(' '));

    const failures = [];
    let imported = 0;
    for (const row of prepared) {
      try {
        const { rowNumber, ...payload } = row;
        await createEncoderEnvironmentReport(payload);
        imported += 1;
      } catch (rowFailure) {
        failures.push(rowError({ _row_number: row.rowNumber }, rowFailure.message || 'Could not create report.'));
      }
    }
    if (imported) refresh();
    if (!imported) throw new Error(failures.join(' ') || 'No environment rows were imported.');
    return {
      message: `Imported ${imported} of ${rows.length} environment row${rows.length === 1 ? '' : 's'}.${failures.length ? ` ${failures.join(' ')}` : ''}`,
      isError: failures.length > 0,
    };
  };

  return (
    <div>
      <PageHeader
        id="environment-records"
        variant="clean"
        compact
        title="Environment Records"
        subtitle={`Environment reports submitted for ${municipalityName}.`}
        art={<MunicipalityMapArt highlightName={municipalityName} />}
      >
        {/* WHAT: Parehong period filter ng Production Records, wala lang quick range. */}
        <PeriodFilters filters={period} idPrefix="environment-records" showPresets={false} />
        <label className="admin-page-hero-control" htmlFor="environment-records-barangay">
          <span className="admin-page-hero-field">Barangay</span>
          <select
            id="environment-records-barangay"
            className="admin-page-hero-select"
            value={filters.barangay_id}
            onChange={(e) => setFilters((current) => ({ ...current, barangay_id: e.target.value }))}
          >
            <option value="">All barangays</option>
            {barangays.map((barangay) => (
              <option key={barangay.id} value={barangay.id}>{barangay.name}</option>
            ))}
          </select>
        </label>
        <label className="admin-page-hero-control" htmlFor="environment-records-status">
          <span className="admin-page-hero-field">Status</span>
          <select
            id="environment-records-status"
            className="admin-page-hero-select"
            value={filters.status}
            onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]?.label || status}
              </option>
            ))}
          </select>
        </label>
      </PageHeader>

      {rangeError && <Alert variant="warning">{rangeError}</Alert>}

      <KpiGrid columns={4}>
        <KpiCard
          icon={Leaf}
          title="Environment Records"
          value={totals.count}
          info="Environment reports that match the current filters."
        />
        <KpiCard
          icon={MapPin}
          title="Barangays Reported"
          value={totals.covered}
          supporting={barangays.length ? `of ${barangays.length} barangay${barangays.length === 1 ? '' : 's'}` : undefined}
          info="Distinct barangays covered by the environment reports in the current filter."
        />
        <KpiCard
          icon={Layers}
          title="Salt Beds Covered"
          value={totals.saltBeds.toLocaleString()}
          info="Salt beds from the latest environment report of each barangay, so re-reports are not double counted."
        />
        <KpiCard
          icon={Clock}
          title="Pending Review"
          value={totals.pending}
          info="Environment reports waiting for admin approval in the current filter."
        />
      </KpiGrid>

      <Card className="encoder-card admin-card">
        <Card.Header className="master-toolbar">
          <h2 className="h6 mb-0"><Leaf size={16} className="me-2" />Environment Records</h2>
          <div className="master-toolbar__actions">
            <Badge bg="light" text="dark">{filtered.length.toLocaleString()} shown</Badge>
            {hasFilter && (
              <button type="button" className="ui-btn-text" onClick={clearFilters}>Clear filters</button>
            )}
            <ReportImportActions
              templateUrl="/static/templates/environment-report-template.csv"
              onImport={importEnvironmentRows}
              disabled={!barangays.length}
            />
            <button type="button" className="ui-btn-primary ui-btn-primary--sm" onClick={() => setShowForm(true)}>
              <Plus size={16} aria-hidden="true" />Add Environment Record
            </button>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {error && <Alert variant="danger" className="m-3">{error}</Alert>}
          {loading ? (
            <div className="text-center py-4"><SkeletonList rows={6} cols={7} /></div>
          ) : filtered.length === 0 ? (
            <div className="chart-empty py-5">
              {hasFilter
                ? 'No environment records match the selected filters.'
                : 'No environment records yet. Use “Add Environment Record” to submit one.'}
            </div>
          ) : (
            <Table responsive hover className="mb-0 encoder-table admin-table ui-records-table">
              <thead>
                <tr><th>Report Type</th><th>Barangay</th><th className="text-end">Salt Beds</th><th>Methods</th><th className="text-end">Area</th><th>Status</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {filtered.map((report) => (
                  <tr key={report.id}>
                    <td><span className="ui-type-pill">Environment</span></td>
                    <td>{report.barangay}</td>
                    <td className="text-end">{Number(report.num_salt_beds).toLocaleString()}</td>
                    <td>{(report.production_methods || []).map((method) => method[0].toUpperCase() + method.slice(1)).join(', ')}</td>
                    <td className="text-end">{Number(report.production_area_size).toLocaleString()} m²</td>
                    <td><Badge bg={STATUS_VARIANTS[report.status] || 'secondary'}>{STATUS_LABELS[report.status]?.label || report.status}</Badge></td>
                    <td>{report.created_at ? new Date(report.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {showForm && (
        <EnvironmentReportForm
          user={user}
          barangays={barangays}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refresh(); }}
          onImport={importEnvironmentRows}
        />
      )}
    </div>
  );
}
