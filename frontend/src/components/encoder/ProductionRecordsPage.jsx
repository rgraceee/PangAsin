import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import { Boxes, CheckCircle, ClipboardList, Clock } from 'lucide-react';
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

export default function ProductionRecordsPage() {
  const { user } = useOutletContext();
  const [months, setMonths] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({ barangay_id: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = {};
    if (filters.barangay_id) params.barangay_id = filters.barangay_id;
    if (filters.status) params.status = filters.status;
    if (range.start) params.start = range.start;
    if (range.end) params.end = range.end;
    getRecords(params)
      .then((res) => { setRecords(res.records || []); })
      .catch((err) => { setError(err.message || 'Could not load production records.'); })
      .finally(() => setLoading(false));
  }, [filters.barangay_id, filters.status, range.start, range.end, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const pending = records.filter((r) => r.status === 'pending').length;
    const approved = records.filter((r) => r.status === 'approved').length;
    const volume = records.reduce((sum, r) => sum + (Number(r.production_volume_mt) || 0), 0);
    return { count: records.length, pending, approved, volume };
  }, [records]);

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

      <RecordsTable
        user={user}
        records={records}
        barangays={barangays}
        loading={loading}
        error={error}
        hasFilter={hasFilter}
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
