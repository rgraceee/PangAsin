import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Card, Table } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import { Boxes, CheckCircle, ClipboardList, Clock, Pencil } from 'lucide-react';
import {
  getEncoderBarangays,
  getEncoderMonths,
  getRecords,
} from '../../services/dataService';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';
import PageHeader from '../admin/PageHeader';
import MunicipalityMapArt from './MunicipalityMapArt';
import PeriodFilters, { usePeriodFilters } from './PeriodFilters';
import RecordsTable from './RecordsTable';
import ProductionRecordForm from './ProductionRecordForm';
import { formatMT } from '../../utils/volumeFormat';
import { STATUS_OPTIONS } from '../../constants/labels';
import { SkeletonList } from '../Skeleton';

const DEFAULT_PER_PAGE = 10;

export default function ProductionRecordsPage() {
  const { user } = useOutletContext();
  const [months, setMonths] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [filters, setFilters] = useState({ barangay_id: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestRef = useRef(0);

  const period = usePeriodFilters(months);
  const { range, rangeError } = period;

  useEffect(() => {
    getEncoderMonths()
      .then((res) => setMonths(res.months || []))
      .catch(() => {});
    getEncoderBarangays()
      .then((res) => setBarangays(res.barangays || []))
      .catch(() => {});
  }, []);

  /* WHAT: Bagong filter = balik sa unang page.
     WHY: kapag nasa page 12 ang reader at pinaliit ang filter, walang
          laman ang page na iyon. */
  useEffect(() => {
    setPage(1);
  }, [filters.barangay_id, filters.status, range.start, range.end]);

  const load = useCallback(() => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setLoading(true);
    setError(null);
    const params = { page, per_page: perPage };
    if (filters.barangay_id) params.barangay_id = filters.barangay_id;
    if (filters.status) params.status = filters.status;
    if (range.start) params.start = range.start;
    if (range.end) params.end = range.end;
    getRecords(params)
      .then((res) => {
        /* WHAT: Only the newest request may update the table.
           WHY: a slow page-N response must not overwrite page 1 after a filter
                change or a quick sequence of page clicks. */
        if (request !== requestRef.current) return;
        const nextPages = res.pages || 0;
        setRecords(res.records || []);
        setSummary(res.summary || null);
        setTotal(res.total || 0);
        setPages(nextPages);
        /* WHAT: If deleting shrank the list below the current page, step back.
           WHY: an empty page with no pager would trap the reader. */
        if (nextPages > 0 && page > nextPages) setPage(nextPages);
      })
      .catch((err) => {
        if (request === requestRef.current) setError(err.message || 'Could not load production records.');
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, [filters.barangay_id, filters.status, range.start, range.end, page, perPage, refreshKey]);

  useEffect(() => { load(); }, [load]);

  /* WHAT: Ang KPI cards ay galing sa server summary ng buong filter.
     WHY: hindi dapat bumaba ang "Records" at "Total Production" kapag
          lumipat ng page. */
  const totals = useMemo(() => {
    if (summary) {
      return {
        count: summary.count || 0,
        pending: summary.pending || 0,
        approved: summary.approved || 0,
        volume: summary.volume_mt || 0,
      };
    }
    const pending = records.filter((r) => r.status === 'pending').length;
    const approved = records.filter((r) => r.status === 'approved').length;
    const volume = records.reduce((sum, r) => sum + (Number(r.production_volume_mt) || 0), 0);
    return { count: records.length, pending, approved, volume };
  }, [summary, records]);

  const municipalityName = user?.municipality_name || 'your municipality';
  const hasFilter = Boolean(filters.barangay_id || filters.status || period.activePreset !== 'all');

  const clearFilters = () => {
    setFilters({ barangay_id: '', status: '' });
    period.resetPeriod();
  };

  const openAdd = () => {
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (id) => {
    setEditingId(id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const refresh = () => setRefreshKey((key) => key + 1);

  return (
    <div>
      <PageHeader
        id="production-records"
        variant="clean"
        compact
        title="Production Records"
        subtitle={`Production records submitted for ${municipalityName}.`}
        art={<MunicipalityMapArt highlightName={municipalityName} />}
      >
        <PeriodFilters filters={period} idPrefix="production-records" showPresets={false} />
        <label className="admin-page-hero-control" htmlFor="production-records-barangay">
          <span className="admin-page-hero-field">Barangay</span>
          <select
            id="production-records-barangay"
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
        <label className="admin-page-hero-control" htmlFor="production-records-status">
          <span className="admin-page-hero-field">Status</span>
          <select
            id="production-records-status"
            className="admin-page-hero-select"
            value={filters.status}
            onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </PageHeader>

      {rangeError && <Alert variant="warning">{rangeError}</Alert>}

      <KpiGrid columns={4}>
        <KpiCard
          icon={Boxes}
          title="Total Production"
          value={formatMT(totals.volume)}
          unit="Metric Tons (MT)"
          info="Sum of production volume across the records that match the current filters."
        />
        <KpiCard
          icon={ClipboardList}
          title="Records"
          value={totals.count}
          info="Number of production records that match the current filters."
        />
        <KpiCard
          icon={Clock}
          title="Pending Review"
          value={totals.pending}
          info="Records waiting for admin approval in the current filter."
        />
        <KpiCard
          icon={CheckCircle}
          title="Approved"
          value={totals.approved}
          info="Approved records in the current filter."
        />
      </KpiGrid>

      {/* Pending Review section — newest submissions first, above the full table. */}
      <Card className="encoder-card admin-card mb-4">
        <Card.Header className="master-toolbar">
          <h2 className="h6 mb-0"><Clock size={16} className="me-2" />Pending Review</h2>
          <div className="master-toolbar__actions">
            <Badge bg="light" text="dark">{totals.pending.toLocaleString()} awaiting approval</Badge>
            <span className="small text-muted">Newest submission first</span>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {loading && (
            <div className="text-center py-4"><SkeletonList rows={3} cols={6} /></div>
          )}
          {totals.pending === 0 && (
            <div className="chart-empty py-4">
              <span className="muni-empty-chip">No pending records</span>
              No production records awaiting approval.
            </div>
          )}
          {totals.pending > 0 && (
            <Table responsive hover className="mb-0 encoder-table admin-table ui-records-table">
              <thead>
                <tr>
                  <th>Record Period</th>
                  <th className="text-end">Volume (MT)</th>
                  <th>Method</th>
                  <th className="text-end">Area per Bed</th>
                  <th className="text-end">Salt Beds</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th className="text-nowrap" aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {records
                  .filter((r) => r.status === 'pending')
                  .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                  .slice(0, 5)
                  .map((r) => {
                    const date = r.record_date ? new Date(`${String(r.record_date).slice(0, 10)}T00:00:00`) : null;
                    const methodLabel = (() => {
                      switch (r.production_method) {
                        case 'solar': return 'Solar';
                        case 'cooked': return 'Cooked';
                        case 'hybrid': return 'Hybrid';
                        default: return r.production_method ?? '—';
                      }
                    })();
                    return (
                      <tr key={r.id}>
                        <td>{date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                        <td className="text-end">{formatMT(r.production_volume_mt)}</td>
                        <td>{methodLabel}</td>
                        <td className="text-end">{r.area_per_salt_bed != null ? `${r.area_per_salt_bed} m²` : '—'}</td>
                        <td className="text-end">{r.num_salt_beds?.toLocaleString()}</td>
                        <td><Badge bg="warning" text="dark">Pending</Badge></td>
                        <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                        <td className="text-nowrap text-end">
                          <button type="button" className="btn btn-link btn-sm p-1 text-primary" onClick={() => openEdit(r.id)} title="Edit" aria-label="Edit pending record">
                            <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <RecordsTable
        user={user}
        records={records}
        barangays={barangays}
        loading={loading}
        error={error}
        hasFilter={hasFilter}
        total={total}
        page={page}
        pages={pages}
        perPage={perPage}
        onPageChange={setPage}
        onPerPageChange={(next) => { setPage(1); setPerPage(next); }}
        onClearFilters={clearFilters}
        onAdd={openAdd}
        onEdit={openEdit}
        onRefresh={refresh}
      />

      {showForm && (
        <ProductionRecordForm
          editingId={editingId}
          user={user}
          onClose={closeForm}
          onSaved={() => { closeForm(); refresh(); }}
          onImported={refresh}
        />
      )}
    </div>
  );
}
