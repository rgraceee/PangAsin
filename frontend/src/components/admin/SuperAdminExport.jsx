import React, { useState } from 'react';
import { Badge, Card } from 'react-bootstrap';
import { exportRecords, exportCsv, downloadBackup } from '../../services/dataService';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import { Download, Database, FileText } from 'lucide-react';

const EXPORT_CARDS = [
  {
    value: 'records',
    label: 'Production Records',
    icon: FileText,
    filters: ['municipality_id', 'start', 'end', 'status'],
  },
  {
    value: 'salt-farmers',
    label: 'Salt Farmers',
    icon: FileText,
    filters: ['municipality_id'],
  },
  {
    value: 'audit-log',
    label: 'Audit Log',
    icon: FileText,
    filters: [],
  },
  {
    value: 'login-history',
    label: 'Login History',
    icon: FileText,
    filters: [],
  },
];

const FILTER_LABELS = {
  municipality_id: 'Municipality',
  start: 'From',
  end: 'To',
  status: 'Status',
};

const FILTER_OPTIONS = {
  status: ['approved', 'pending', 'rejected'],
};

export default function SuperAdminExport() {
  const { toastSuccess, toastError } = useToast();
  const [filters, setFilters] = useState({});
  const [exporting, setExporting] = useState(null);
  const [lastExported, setLastExported] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);

  const setFilter = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (value === '') delete next[key];
      return next;
    });
  };

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const blob = type === 'records'
        ? await exportRecords(filters)
        : await exportCsv(type, filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const card = EXPORT_CARDS.find((c) => c.value === type);
      a.download = `pangasin-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setLastExported(new Date().toISOString());
      toastSuccess(`${card.label} CSV downloaded.`, 'Export complete');
    } catch (err) {
      toastError(err.message || 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const blob = await downloadBackup();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = blob.type.includes('sqlite') ? '.db' : '.sql';
      a.download = `pangasin-backup-${new Date().toISOString().slice(0, 13)}${ext}`;
      a.click();
      window.URL.revokeObjectURL(url);
      setLastBackup(new Date().toISOString());
      toastSuccess('Database backup downloaded.', 'Backup complete');
    } catch (err) {
      toastError(err.message || 'Backup failed.');
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        id="superadmin-export"
        variant="clean"
        title="Export &amp; Backup"
        subtitle="Export authorized system records and create secure database backups."
      >
        <div className="muni-header-actions">
          <span className="muni-status-badge muni-status-badge--status-secondary">
            Exports and backups may contain sensitive system information.
          </span>
        </div>
      </PageHeader>

      {/* Data Exports section */}
      <Card className="encoder-card admin-card mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <Download size={16} strokeWidth={2} aria-hidden="true" />
                <h5 className="card-title mb-0">Data Exports</h5>
              </div>
            </div>
          </div>
          <div className="row g-3">
            {EXPORT_CARDS.map((card) => {
              const CardIcon = card.icon;
              return (
                <div key={card.value} className="col-md-6 col-lg-3">
                  <Card className="encoder-card admin-card h-100 export-card">
                    <Card.Body className="d-flex flex-column">
                      <div className="d-flex align-items-start gap-2 mb-2">
                        <CardIcon size={16} strokeWidth={2} aria-hidden="true" />
                        <span className="fw-medium">{card.label}</span>
                      </div>
                      {card.filters.length > 0 && (
                        <div className="export-filters mb-3">
                          {card.filters.map((f) => {
                            const label = FILTER_LABELS[f] || f;
                            const isSelect = f === 'municipality_id' || f === 'status';
                            const inputType = f === 'start' || f === 'end' ? 'date' : 'text';
                            return (
                              <div key={f} className="export-filter-field mb-2">
                                <label className="form-label fw-medium small">{label}</label>
                                {isSelect ? (
                                  <select
                                    className="form-select"
                                    value={filters[f] || ''}
                                    onChange={(e) => setFilter(f, e.target.value)}
                                  >
                                    <option value="">All</option>
                                    {(FILTER_OPTIONS[f] || []).map((o) => (
                                      <option key={o} value={o}>{o}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    className="form-control"
                                    type={inputType}
                                    value={filters[f] || ''}
                                    onChange={(e) => setFilter(f, e.target.value)}
                                    placeholder={inputType === 'date' ? 'YYYY-MM-DD' : ''}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <form onSubmit={(e) => { e.preventDefault(); handleExport(card.value); }} className="d-grid">
                        <button
                          type="submit"
                          className="ui-btn-primary ui-btn--sm"
                          disabled={exporting === card.value}
                        >
                          {exporting === card.value ? 'Exporting…' : 'Download CSV'}
                        </button>
                      </form>
                    </Card.Body>
                  </Card>
                </div>
              );
            })}
          </div>
          {lastExported && (
            <div className="mt-3">
              <Badge className={`mt-0 muni-status-badge muni-status-badge--status-success`}>
                Last export: {new Date(lastExported).toLocaleString()}
              </Badge>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Database Backup section */}
      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="d-flex align-items-start gap-2 mb-3">
            <Database size={18} strokeWidth={2} className="text-warning" aria-hidden="true" />
            <div>
              <h5 className="card-title mb-1">Database Backup</h5>
              <div className="text-muted small">Create a secure backup of the system database. The backup includes schema and data and is downloadable as a SQL file.</div>
            </div>
          </div>
          <div className="alert alert-warning border-warning mb-3">
            <strong>Warning:</strong> This contains production data. Store the backup securely and never share the file or its contents.
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleBackup(); }} className="d-grid">
            <button
              type="submit"
              className="ui-btn-outline ui-btn--sm"
              disabled={backupLoading}
            >
              <Database size={16} strokeWidth={2} aria-hidden="true" />{' '}{backupLoading ? 'Backing up…' : 'Download DB Backup'}
            </button>
          </form>
          {lastBackup && (
            <Badge className={`mt-0 muni-status-badge muni-status-badge--status-success`}>
              Last backup: {new Date(lastBackup).toLocaleString()}
            </Badge>
          )}
        </Card.Body>
      </Card>
    </>
  );
}
