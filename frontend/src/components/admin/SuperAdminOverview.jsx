import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Table } from 'react-bootstrap';
import { Activity, Users, Clock, AlertCircle, Database, Play, Mail, ShieldAlert, UserPlus } from 'lucide-react';
import {
  getSuperAdminHealth,
  getSuperAdminSmtp,
  getSuperAdminUsers,
  getAuditLog,
  runSuperAdminForecast,
  sendSmtpTest,
} from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import ErrorBoundary from '../ErrorBoundary';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';
import { SkeletonList } from '../Skeleton';
import { formatDateTimeManila, humanizeAction, actionIcon } from '../../utils/superadminUi';
import { getEntityLabel } from '../../utils/auditMeta';

export default function SuperAdminOverview() {
  const { toastSuccess, toastError } = useToast();
  const { activeNames } = useMunicipalityDirectory();
  const [stats, setStats] = useState({});
  const [smtp, setSmtp] = useState(null);
  const [lockedCount, setLockedCount] = useState(0);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forecastRunning, setForecastRunning] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getSuperAdminHealth().then((s) => setStats(s || {})).catch(() => setStats({})),
      getSuperAdminSmtp().then((s) => setSmtp(s || null)).catch(() => setSmtp(null)),
      getSuperAdminUsers({ per_page: 100 }).then((r) => {
        const users = Array.isArray(r.users) ? r.users : [];
        setLockedCount(users.filter((u) => u.status === 'locked').length);
      }).catch(() => setLockedCount(0)),
      getAuditLog({ page: 1, per_page: 10 }).then((r) => setAudits(Array.isArray(r.entries) ? r.entries : (r.logs || []))).catch(() => setAudits([])),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const usersByRole = stats.users_by_role || {};
  const totalUsers = Object.values(usersByRole).reduce((a, b) => a + b, 0);
  const smtpConfigured = Boolean(smtp && smtp.smtp_configured);

  const handleRunForecast = async () => {
    const ok = await confirmAction({
      title: 'Run forecast for all municipalities?',
      text: 'Regenerates forecasts using current production data. May take a moment.',
      confirmText: 'Run forecast',
      danger: false,
    });
    if (!ok) return;
    setForecastRunning(true);
    try {
      const res = await runSuperAdminForecast();
      toastSuccess(`Forecast run completed (run #${res.run_id}).`, 'Forecast complete');
      load();
    } catch (err) { toastError(err.message || 'Forecast run failed.'); }
    finally { setForecastRunning(false); }
  };

  const handleSmtpTest = async () => {
    setSmtpTesting(true);
    try {
      await sendSmtpTest();
      toastSuccess('Test email sent successfully.', 'SMTP test');
    } catch (err) { toastError(err.message || 'SMTP test failed.'); }
    finally { setSmtpTesting(false); }
  };

  const handleCreateUser = () => {
    window.location.href = '/superadmin/users';
  };

  const actorShort = (email) => {
    if (!email) return '—';
    const local = email.split('@')[0];
    return local.length > 12 ? `${local.slice(0, 12)}…` : local;
  };

  const alerts = [];
  if (stats.pending_validations > 0) alerts.push({ tone: 'warning', text: `You have ${stats.pending_validations} pending validation(s) awaiting review.` });
  if (lockedCount > 0) alerts.push({ tone: 'danger', text: `You have ${lockedCount} locked account(s). Unlock them in User Management.` });
  if (!smtpConfigured) alerts.push({ tone: 'warning', text: 'SMTP is not configured. Test emails cannot be sent.' });
  if (stats.last_forecast_run === null) alerts.push({ tone: 'info', text: 'No forecast run has been executed yet.' });

  return (
    <ErrorBoundary>
      <PageHeader
        id="superadmin-overview"
        variant="clean"
        className="ui-pageheader--admin"
        title="Overview"
        subtitle="SuperAdmin system overview"
        art={(
          <MunicipalityMapArt
            mode="province"
            activeNames={activeNames}
            selectableNames={[]}
          />
        )}
      />
      {error && (
        <Alert variant="danger" dismissible>
          {error}
          <button type="button" className="ui-btn-outline ui-btn--sm float-end" onClick={load}>Retry</button>
        </Alert>
      )}
      {loading ? (
        <div className="text-center py-4"><SkeletonList rows={8} cols={6} /><SkeletonList rows={4} cols={4} /></div>
      ) : (
        <>
          <KpiGrid columns={4}>
            <KpiCard icon={AlertCircle} title="Pending validations" value={stats.pending_validations ?? 0} tone={stats.pending_validations ? 'bad' : 'default'} badge={stats.pending_validations ?? 0} />
            <KpiCard icon={ShieldAlert} title="Failed logins (24h)" value={stats.failed_logins_24h ?? 0} tone={stats.failed_logins_24h ? 'bad' : 'default'} badge={stats.failed_logins_24h ?? 0} />
            <KpiCard icon={Users} title="Users (all roles)" value={totalUsers} tone="default" />
            <KpiCard icon={ShieldAlert} title="Locked accounts" value={lockedCount} tone={lockedCount ? 'bad' : 'default'} badge={lockedCount} />
            <KpiCard icon={Activity} title="Last forecast run" value={formatDateTimeManila(stats.last_forecast_run)} tone={stats.last_forecast_run ? 'default' : 'bad'} />
            <KpiCard icon={Clock} title="Last approved data update" value={formatDateTimeManila(stats.last_approved_update)} tone="default" />
            <KpiCard icon={Database} title="Database size" value={stats.db_size || 'Never'} tone="default" />
            <KpiCard icon={Mail} title="SMTP status" value={smtpConfigured ? 'Configured' : 'Not configured'} tone={smtpConfigured ? 'good' : 'bad'} badge={smtpConfigured ? 'OK' : 'OFF'} />
          </KpiGrid>

          <div className="row g-3 mt-3">
            <div className="col-md-4">
              <div className="d-grid">
                <button type="button" className="ui-btn-primary ui-btn--sm w-100" onClick={handleRunForecast} disabled={forecastRunning}>
                  <Play size={16} strokeWidth={2} aria-hidden="true" /> {forecastRunning ? 'Running…' : 'Run forecast now'}
                </button>
              </div>
            </div>
            <div className="col-md-4">
              <div className="d-grid">
                <button type="button" className="ui-btn-outline ui-btn--sm w-100" onClick={handleSmtpTest} disabled={smtpTesting}>
                  <Mail size={16} strokeWidth={2} aria-hidden="true" /> {smtpTesting ? 'Testing…' : 'Send test email'}
                </button>
              </div>
            </div>
            <div className="col-md-4">
              <div className="d-grid">
                <button type="button" className="ui-btn-outline ui-btn--sm w-100" onClick={handleCreateUser} disabled={false}>
                  <UserPlus size={16} strokeWidth={2} aria-hidden="true" /> Create user
                </button>
              </div>
            </div>
          </div>

          <div className="row g-3 mt-3">
            <div className="col-md-8">
              <Card className="encoder-card admin-card">
                <Card.Body>
                  <PageHeader id="superadmin-overview-recent-audit" variant="section" title="Recent audit events" subtitle="Last 10 entries" />
                  {!loading && audits.length === 0 && <Alert variant="info">No recent audit events.</Alert>}
                  {!loading && audits.length > 0 && (
                    <Table responsive hover size="sm" className="mb-0 encoder-table admin-table muni-admin-table" aria-label="Recent audit events">
                      <thead>
                        <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Summary</th></tr>
                      </thead>
                      <tbody>
                        {audits.map((entry) => {
                          const entity = entry.entity_type ? `${getEntityLabel(entry.entity_type)}#${entry.entity_id ?? '—'}` : null;
                          const Icon = actionIcon(entry.action);
                          return (
                            <tr key={entry.id}>
                              <td className="text-nowrap">{formatDateTimeManila(entry.created_at)}</td>
                              <td title={entry.actor_email || ''}>{actorShort(entry.actor_email)}</td>
                              <td>
                                <button type="button" className="muni-action-btn muni-action-btn--edit" title={humanizeAction(entry.action)} aria-label={humanizeAction(entry.action)}>
                                  <Icon size={12} strokeWidth={2} aria-hidden="true" />
                                </button>
                              </td>
                              <td>{entity ? <span className="text-muted small">{entity}</span> : <span className="text-muted small">—</span>}</td>
                              <td className="text-truncate" style={{ maxWidth: '260px' }} title={entry.summary || ''}>{entry.summary || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  )}
                </Card.Body>
              </Card>
            </div>
            <div className="col-md-4 d-none d-md-block">
              <Card className="encoder-card admin-card">
                <Card.Body>
                  <PageHeader id="superadmin-overview-alerts" variant="section" title="Alerts" subtitle="Conditions that need attention" />
                  <div className="alerts-list">
                    {alerts.map((a, i) => (
                      <Alert key={i} variant={a.tone}>{a.text}</Alert>
                    ))}
                    {alerts.length === 0 && <Alert variant="success">All systems nominal.</Alert>}
                  </div>
                </Card.Body>
              </Card>
            </div>
          </div>
        </>
      )}
    </ErrorBoundary>
  );
}
