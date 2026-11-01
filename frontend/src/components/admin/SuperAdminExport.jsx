import React, { useState } from 'react';
import { Button, Card, Badge } from 'react-bootstrap';
import { exportRecords } from '../../services/dataService';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import { Download } from 'lucide-react';

export default function SuperAdminExport() {
  const { toastSuccess, toastError } = useToast();
  const [filters, setFilters] = useState({ municipality_id: '', start: '', end: '', status: '' });
  const [loading, setLoading] = useState(false);
  const [lastExported, setLastExported] = useState(null);

  const handleExport = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const blob = await exportRecords(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pangasin-export-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setLastExported(new Date().toISOString());
      toastSuccess('CSV export downloaded.', 'Export complete');
    } catch (err) { toastError(err.message || 'Export failed.'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <PageHeader id="superadmin-export" title="Export &amp; Backup" subtitle="CSV export of production records, salt farmers, audit log and login history. Never includes password hashes." art={<></>}>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sae-muni">Municipality</label>
          <select id="sae-muni" className="form-select admin-page-hero-select" name="municipality_id" value={filters.municipality_id} onChange={(e) => setFilters({ ...filters, municipality_id: e.target.value })}><option value="">All</option></select>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sae-start">From</label>
          <input id="sae-start" className="form-control admin-page-hero-select" type="date" name="start" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sae-end">To</label>
          <input id="sae-end" className="form-control admin-page-hero-select" type="date" name="end" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sae-status">Status</label>
          <select id="sae-status" className="form-select admin-page-hero-select" name="status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select>
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <form onSubmit={handleExport} className="d-flex gap-2 align-items-end">
            <Button type="submit" variant="primary" disabled={loading}>
              <Download size={16} strokeWidth={2} aria-hidden="true" />{' '}{loading ? 'Exporting…' : 'Download CSV'}
            </Button>
            <Badge className="ms-auto text-bg-light text-dark border">{lastExported ? `Last export: ${new Date(lastExported).toLocaleString()}` : '—'}</Badge>
          </form>
          <div className="mt-3">
            <p className="text-muted small">Scope: production records, salt farmers, audit log, login history. Filters: municipality, date range, status. Password hashes are never included.</p>
            <p className="text-muted small">Backup: SQLite consistent copy via the backup API (other DBs show “unsupported here”). Download is audited, timestamped, and marked Cache-Control: no-store.</p>
          </div>
        </Card.Body>
      </Card>
    </>
  );
}
