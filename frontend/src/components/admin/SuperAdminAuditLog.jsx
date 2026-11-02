import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Table } from 'react-bootstrap';
import { getAuditLog, getLoginEvents, exportCsv } from '../../services/dataService';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import TablePagination from '../ui/TablePagination';
import IconButton from '../IconButton';
import { ScrollText, Activity, RefreshCw, Download, FileText, ChevronDown, ChevronUp, User, Clock, ShieldAlert } from 'lucide-react';
import { getActionMeta, getEntityLabel } from '../../utils/auditMeta';
import { formatDateTimeManila } from '../../utils/superadminUi';

const PER_PAGE = 50;

const ACTION_BADGE_TONE = {
  create: 'success',
  update: 'primary',
  delete: 'danger',
  boundary: 'primary',
  account: 'secondary',
  auth: 'info',
  security: 'warning',
  neutral: 'secondary',
};

function actionBadge(action) {
  const m = getActionMeta(action);
  const tone = ACTION_BADGE_TONE[m.tone || 'neutral'] || 'secondary';
  return <span className={`muni-status-badge muni-status-badge--action-${tone}`}>{m.label}</span>;
}

export default function SuperAdminAuditLog() {
  const { toastSuccess, toastError } = useToast();
  const [tab, setTab] = useState('audit');
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ user: '', action: '', start: '', end: '' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [exporting, setExporting] = useState(null);

  const isAudit = tab === 'audit';
  const reportTitle = isAudit ? 'PangAsin Audit Log Report' : 'PangAsin Login History Report';

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, per_page: perPage, ...filters };
    (isAudit ? getAuditLog(params) : getLoginEvents(params))
      .then((r) => {
        setEntries(r.entries || []);
        setTotal(r.total || 0);
        setPage(Math.min(page, Math.ceil((r.total || 0) / perPage) || 1));
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load log.'); setLoading(false); });
  }, [page, perPage, filters, isAudit]);

  useEffect(() => { load(); }, [load]);

  const handleFilter = (e) => { setPage(1); setFilters({ ...filters, [e.target.name]: e.target.value }); };

  const paged = entries.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

  const filterSummary = () => {
    const parts = [];
    if (filters.user) parts.push(`User: ${filters.user}`);
    if (filters.action) parts.push(`Action: ${filters.action}`);
    if (filters.start) parts.push(`From: ${filters.start}`);
    if (filters.end) parts.push(`To: ${filters.end}`);
    return parts.length ? parts.join('; ') : 'None';
  };

  const handleExport = async (format) => {
    setExporting(format);
    try {
      if (format === 'csv') {
        const blob = await exportCsv(isAudit ? 'audit-log' : 'login-history', filters);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pangasin-${isAudit ? 'audit-log' : 'login-history'}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toastSuccess(`${isAudit ? 'Audit log' : 'Login history'} CSV downloaded.`, 'Export complete');
      } else if (format === 'pdf') {
        openPdfReport();
      }
    } catch (err) { toastError(err.message || 'Export failed.'); }
    finally { setExporting(null); }
  };

  const openPdfReport = () => {
    const generatedAt = new Date().toLocaleString();
    const rows = paged.map((e) => {
      const actor = e.actor_email ? e.actor_email.split('@')[0] : '—';
      const entity = e.entity_type ? `${getEntityLabel(e.entity_type)}#${e.entity_id ?? '—'}` : '—';
      return `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563;white-space:nowrap">${formatDateTimeManila(e.created_at)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563">${actor}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563">${getActionMeta(e.action).label}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563">${entity}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563">${e.summary || '—'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563;white-space:nowrap">${e.ip_address || '—'}</td>
        </tr>
      `;
    }).join('');

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${reportTitle}</title>
        <style>
          @page { size: A4 portrait; margin: 18mm 14mm 16mm 14mm; @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #6b7280; } }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 12px; color: #111827; margin: 0; }
          .header { border-bottom: 3px solid #29b039; padding-bottom: 10px; margin-bottom: 16px; }
          .header h1 { font-size: 18px; margin: 0 0 4px 0; color: #111827; letter-spacing: 0.3px; }
          .header p { margin: 0; color: #6b7280; font-size: 11.5px; }
          .meta { margin-bottom: 14px; font-size: 11px; color: #4b5563; }
          .meta strong { color: #111827; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th { background: #f3f4f6; color: #4b5563; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; text-align: left; padding: 7px 8px; border-bottom: 1px solid #d1d5db; white-space: nowrap; }
          td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11.5px; color: #374151; vertical-align: top; }
          tr:last-child td { border-bottom: none; }
          .empty { color: #6b7280; font-style: italic; padding: 16px; text-align: center; }
          .no-print { position: fixed; top: 10px; right: 10px; z-index: 9999; }
        </style>
      </head>
      <body>
        <button class="no-print" onclick="window.print();window.close()" style="padding:8px 12px;font-size:12px;background:#29b039;color:#fff;border:none;border-radius:8px;cursor:pointer">Print / Save as PDF</button>
        <div class="header">
          <h1>${reportTitle}</h1>
          <p>PangAsin SuperAdmin &bull; Generated ${generatedAt}</p>
        </div>
        <div class="meta"><strong>Filters applied:</strong> ${filterSummary()} &bull; <strong>Records shown:</strong> ${paged.length} of ${total}</div>
        <table>
          <thead>
            <tr>
              <th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Summary</th><th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td class="empty" colSpan="6">No audit records match the current filters.</td></tr>`}
          </tbody>
        </table>
        <div class="meta" style="margin-top:16px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:10px;color:#9ca3af">PangAsin &mdash; Confidential audit record. Generated by SuperAdmin.</div>
      </body>
      </html>
    `);
    win.document.close();
  };

  const toggleRow = (id) => setExpanded(expanded === id ? null : id);

  const detailsRows = (e) => {
    const details = e.details || {};
    const before = details.before || {};
    const after = details.after || {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changedKeys = [...keys].filter((k) => String(before[k]) !== String(after[k]));
    if (keys.size === 0) {
      return (
        <tr>
          <td colSpan="7" className="text-muted small">
            <div className="d-flex align-items-center justify-content-center gap-2 py-3">
              <ShieldAlert size={14} strokeWidth={2} className="text-muted" aria-hidden="true" />
              <span>No field-level changes recorded.</span>
            </div>
          </td>
        </tr>
      );
    }
    return (
      <tr>
        <td colSpan="7">
          <div className="muni-audit-detail">
            <div className="muni-audit-detail__meta">
              <span className="muni-audit-detail__label">Actor:</span>
              <span className="muni-audit-detail__value" title={e.actor_email || ''}>{e.actor_email || '—'}</span>
              <span className="muni-audit-detail__label">IP:</span>
              <span className="muni-audit-detail__value text-nowrap" title={e.ip_address || ''}>{e.ip_address || '—'}</span>
              <span className="muni-audit-detail__label">When:</span>
              <span className="muni-audit-detail__value">{formatDateTimeManila(e.created_at)}</span>
            </div>
            {changedKeys.length > 0 && (
              <div className="muni-audit-detail__changes">
                <span className="muni-audit-detail__label">{changedKeys.length} field{changedKeys.length !== 1 ? 's' : ''} changed</span>
                <Table responsive hover size="sm" className="mb-0">
                  <thead>
                    <tr><th>Field</th><th>Before</th><th>After</th></tr>
                  </thead>
                  <tbody>
                    {changedKeys.map((k) => (
                      <tr key={k}>
                        <td className="text-muted small">{k}</td>
                        <td className="text-truncate" style={{ maxWidth: '220px' }}>{before[k] === undefined || before[k] === null ? '—' : String(before[k])}</td>
                        <td className="text-truncate fw-medium">{after[k] === undefined || after[k] === null ? '—' : String(after[k])}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
            {e.summary && (
              <div className="muni-audit-detail__summary">
                <span className="muni-audit-detail__label">Summary:</span>
                <span className="muni-audit-detail__value" title={e.summary}>{e.summary}</span>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <>
      <PageHeader
        id="superadmin-audit-log"
        variant="clean"
        className="ui-pageheader--admin"
        title={isAudit ? 'Audit Log' : 'Login Events'}
        subtitle="Actor, action, target, reason, IP and timestamp."
      >
        <div className="muni-header-actions">
          <button type="button" className={`ui-btn-${isAudit ? 'primary' : 'outline'} ui-btn--sm`} onClick={() => setTab('audit')}>
            <ScrollText size={14} strokeWidth={2} aria-hidden="true" /> Audit trail
          </button>
          <button type="button" className={`ui-btn-${!isAudit ? 'primary' : 'outline'} ui-btn--sm`} onClick={() => setTab('login')}>
            <Activity size={14} strokeWidth={2} aria-hidden="true" /> Login history
          </button>
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
        </div>
      </PageHeader>

      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2 sa-log-toolbar">
            <span className="text-muted small">{total} entr{total === 1 ? 'y' : 'ies'}</span>
            <div className="d-flex gap-2">
              <button type="button" className="ui-btn-outline ui-btn--sm" onClick={() => { setPage(1); setFilters({ user: '', action: '', start: '', end: '' }); load(); }}><RefreshCw size={14} strokeWidth={2} aria-hidden="true" /> Refresh</button>
              <button type="button" className={`ui-btn-outline ui-btn--sm ${exporting === 'csv' ? 'opacity-50' : ''}`} onClick={() => handleExport('csv')} disabled={exporting === 'csv'}><Download size={13} strokeWidth={2} aria-hidden="true" /> Export CSV</button>
              <button type="button" className={`ui-btn-outline ui-btn--sm ${exporting === 'pdf' ? 'opacity-50' : ''}`} onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}><FileText size={13} strokeWidth={2} aria-hidden="true" /> Export PDF</button>
            </div>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-2"><span className="muni-status-badge muni-status-badge--action-neutral">Loading…</span></div>}
          {!loading && entries.length === 0 && <Alert variant="info">No entries match the current filters.</Alert>}
          {!loading && entries.length > 0 && (
            <Table responsive hover size="sm" className="mb-0 encoder-table admin-table muni-admin-table">
              <thead>
                <tr>
                  <th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Summary</th><th>IP</th><th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((e) => (
                  <React.Fragment key={e.id}>
                    <tr>
                      <td className="text-nowrap small">
                        <div className="d-flex align-items-center gap-1">
                          <Clock size={11} strokeWidth={2} className="text-muted" aria-hidden="true" />
                          <span>{formatDateTimeManila(e.created_at)}</span>
                        </div>
                      </td>
                      <td title={e.actor_email || ''} className="text-truncate" style={{ maxWidth: '150px' }}>
                        <div className="d-flex align-items-center gap-1">
                          <User size={11} strokeWidth={2} className="text-muted" aria-hidden="true" />
                          <span>{e.actor_email ? e.actor_email.split('@')[0] : '—'}</span>
                        </div>
                      </td>
                      <td>{actionBadge(e.action)}</td>
                      <td>
                        {e.entity_type ? (
                          <span className="text-muted small text-truncate" style={{ maxWidth: '140px' }} title={`${getEntityLabel(e.entity_type)} #${e.entity_id ?? '—'}`}>
                            {getEntityLabel(e.entity_type)}#{e.entity_id ?? '—'}
                          </span>
                        ) : <span className="text-muted small">—</span>}
                      </td>
                      <td className="text-truncate" style={{ maxWidth: '220px' }} title={e.summary || ''}>{e.summary || '—'}</td>
                      <td className="text-muted small text-nowrap" title={e.ip_address || ''}>{e.ip_address || '—'}</td>
                      <td className="text-nowrap">
                        <IconButton icon={expanded === e.id ? ChevronUp : ChevronDown} label={expanded === e.id ? 'Collapse details' : 'Show details'} variant="link" onClick={() => toggleRow(e.id)} />
                      </td>
                    </tr>
                    {expanded === e.id && detailsRows(e)}
                  </React.Fragment>
                ))}
              </tbody>
            </Table>
          )}
          {!loading && entries.length > 0 && (
            <div className="px-3 pb-3">
              <TablePagination page={page} pages={Math.ceil(total / perPage) || 1} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} itemLabel="entries" />
            </div>
          )}
        </Card.Body>
      </Card>
    </>
  );
}
