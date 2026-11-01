import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Table } from 'react-bootstrap';
import { getAuditLog, getLoginEvents } from '../../services/dataService';
import { SkeletonList } from '../Skeleton';
import PageHeader from './PageHeader';
import TablePagination from '../ui/TablePagination';
import { ScrollText, Activity, RefreshCw } from 'lucide-react';
import { getActionMeta, getEntityLabel } from '../../utils/auditMeta';

const PER_PAGE = 50;

function statusLabel(action) {
  const m = getActionMeta(action);
  return <span className={`record-status-badge status-${m.tone || 'neutral'}`}>{m.label}</span>;
}

export default function SuperAdminAuditLog() {
  const [tab, setTab] = useState('audit');
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ user: '', action: '', start: '', end: '' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, per_page: perPage, ...filters };
    (tab === 'audit' ? getAuditLog(params) : getLoginEvents(params))
      .then((r) => {
        setEntries(r.entries || []);
        setTotal(r.total || 0);
        setPage(Math.min(page, Math.ceil((r.total || 0) / perPage) || 1));
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load log.'); setLoading(false); });
  }, [page, perPage, filters, tab]);

  useEffect(() => { load(); }, [load]);

  const handleFilter = (e) => { setPage(1); setFilters({ ...filters, [e.target.name]: e.target.value }); };

  const paged = entries.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

  return (
    <>
      <PageHeader id="superadmin-audit-log" title="Audit Log" subtitle="Actor, action, target, reason, IP and timestamp." art={<></>}>
        <div className="admin-page-hero-control">
          <Button variant={tab === 'audit' ? 'primary' : 'outline-primary'} size="sm" onClick={() => setTab('audit')}>
            <ScrollText size={14} strokeWidth={2} aria-hidden="true" /> Audit trail
          </Button>
          <Button variant={tab === 'login' ? 'primary' : 'outline-primary'} size="sm" onClick={() => setTab('login')}>
            <Activity size={14} strokeWidth={2} aria-hidden="true" /> Login history
          </Button>
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sal-user">User</label>
          <input id="sal-user" className="form-control admin-page-hero-select" name="user" value={filters.user} placeholder="Filter by user email" onChange={handleFilter} />
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sal-action">Action</label>
          <input id="sal-action" className="form-control admin-page-hero-select" name="action" value={filters.action} placeholder="Filter by action" onChange={handleFilter} />
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sal-start">From</label>
          <input id="sal-start" className="form-control admin-page-hero-select" type="date" name="start" value={filters.start} onChange={handleFilter} />
        </div>
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="sal-end">To</label>
          <input id="sal-end" className="form-control admin-page-hero-select" type="date" name="end" value={filters.end} onChange={handleFilter} />
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">{total} entr{total === 1 ? 'y' : 'ies'}</span>
            <Button variant="outline-secondary" size="sm" onClick={() => { setPage(1); setFilters({ user: '', action: '', start: '', end: '' }); load(); }}><RefreshCw size={14} strokeWidth={2} aria-hidden="true" /></Button>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-2"><SkeletonList rows={6} cols={6} /></div>}
          {!loading && entries.length === 0 && <Alert variant="info">No entries match the current filters.</Alert>}
          {!loading && entries.length > 0 && (
            <Table responsive striped hover size="sm" className="mb-0 encoder-table admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th><th>Actor</th><th>Action</th><th>Target</th><th>Summary</th><th>IP</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((e) => (
                  <tr key={e.id}>
                    <td>{e.created_at ? new Date(e.created_at).toLocaleString() : '—'}</td>
                    <td>{e.actor_email || '—'}</td>
                    <td>{statusLabel(e.action)}</td>
                    <td><span className="text-muted small">{getEntityLabel(e.entity_type)}</span> {e.entity_id ?? '—'}</td>
                    <td className="text-truncate" style={{ maxWidth: '340px' }} title={e.summary || ''}>{e.summary || '—'}</td>
                    <td className="text-muted small">{e.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {!loading && entries.length > 0 && (
            <TablePagination page={page} pages={Math.ceil(total / perPage) || 1} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} itemLabel="entries" />
          )}
        </Card.Body>
      </Card>
    </>
  );
}
