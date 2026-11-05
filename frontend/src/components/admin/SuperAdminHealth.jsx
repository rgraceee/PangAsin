import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Table } from 'react-bootstrap';
import { Activity, Users, Clock, AlertCircle, Database, Play } from 'lucide-react';
import { getSuperAdminHealth, runSuperAdminForecast } from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import ErrorBoundary from '../ErrorBoundary';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';

const KPI = ({ icon: Icon, title, value, unit, caption, tone = 'default', badge, description }) => (
  <KpiCard icon={Icon} title={title} value={value} unit={unit} caption={caption} tone={tone} badge={badge} description={description} />
);

export default function SuperAdminHealth() {
  const { toastSuccess, toastError } = useToast();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [forecastRunning, setForecastRunning] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSuperAdminHealth()
      .then((s) => {
        setStats(s || {});
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Could not load health summary.'); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const usersByRole = stats.users_by_role || {};
  const totalUsers = Object.values(usersByRole).reduce((a, b) => a + b, 0);

  const handleRunForecast = async () => {
    const ok = await confirmAction({
      title: 'Run forecast for all municipalities?',
      text: 'This will regenerate forecasts using current production data. It may take a moment.',
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

  return (
    <ErrorBoundary>
      <PageHeader id="superadmin-health" variant="clean" title="System Health" subtitle="SuperAdmin system overview" />
      {error && <Alert variant="danger">{error}</Alert>}
      <Card className="encoder-card admin-card">
        <Card.Body>
          <KpiGrid columns={5}>
            <KPI icon={Activity} title="Last forecast run" value={stats.last_forecast_run || '—'} unit="run" caption="Most recent" tone="default" description="Timestamp of the most recent forecast run." />
            <KPI icon={Clock} title="Last approved data update" value={stats.last_approved_update || '—'} unit="update" caption="Most recent" tone="default" description="Timestamp when production data was last approved." />
            <KPI icon={AlertCircle} title="Pending validations" value={stats.pending_validations ?? 0} unit="pending items" caption="Selected period" tone={stats.pending_validations ? 'bad' : 'default'} badge={stats.pending_validations ?? 0} description="Records awaiting admin validation." />
            <KPI icon={Users} title="Users (all roles)" value={totalUsers} unit="users" caption="All time" tone="default" description="Total registered users across all roles." />
            <KPI icon={AlertCircle} title="Failed logins (24h)" value={stats.failed_logins_24h ?? 0} unit="attempts" caption="Last 24 hours" tone={stats.failed_logins_24h ? 'bad' : 'default'} badge={stats.failed_logins_24h ?? 0} description="Failed login attempts in the last 24 hours." />
          </KpiGrid>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <KPI icon={Database} title="Database size" value={stats.db_size || '—'} unit="MB" caption="Current" tone="default" />
            </div>
            <div className="col-md-4">
              <KPI icon={Activity} title="App version" value={stats.app_version || '—'} unit="version" caption="Current" tone="default" />
            </div>
            <div className="col-md-4">
              <div className="d-grid">
                <button
                  type="button"
                  className="ui-btn-outline ui-btn--sm w-100"
                  onClick={handleRunForecast}
                  disabled={forecastRunning}
                >
                  <Play size={16} strokeWidth={2} aria-hidden="true" />
                  {forecastRunning ? 'Running forecast…' : 'Run forecast now'}
                </button>
              </div>
            </div>
          </div>
          <div className="row g-3">
            {Object.entries(usersByRole).map(([role, count]) => (
              <div key={role} className="col-md-3">
                <KPI icon={Users} title={role.charAt(0).toUpperCase() + role.slice(1)} value={count} tone="default" />
              </div>
            ))}
          </div>
          <div className="row g-3">
            <div className="col-md-4">
              <Table responsive hover size="sm" className="mb-0 encoder-table admin-table">
                <tbody>
                  <tr><td className="fw-medium">Database type</td><td>{stats.db_type || '—'}</td></tr>
                </tbody>
              </Table>
            </div>
          </div>
        </Card.Body>
      </Card>
    </ErrorBoundary>
  );
}
