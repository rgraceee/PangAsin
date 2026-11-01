import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Alert } from 'react-bootstrap';
import { Activity, Users, Clock, AlertCircle, Database, Play } from 'lucide-react';
import { getSuperAdminHealth, runSuperAdminForecast } from '../../services/dataService';
import { confirmAction } from '../../services/feedback';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';
import ErrorBoundary from '../ErrorBoundary';

const KPI = ({ icon: Icon, value, label, variant = 'text-muted' }) => (
  <div className="kpi-tile">
    <div className="kpi-icon"><Icon size={20} strokeWidth={2} /></div>
    <div className="kpi-value">{value}</div>
    <div className="kpi-label">{label}</div>
  </div>
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
      <PageHeader id="superadmin-health" title="System Health" subtitle="SuperAdmin system overview" />
      {error && <Alert variant="danger">{error}</Alert>}
      <Card className="encoder-card admin-card">
        <Card.Body>
          <div className="row g-3 mb-3">
            <div className="col-md-2">
              <KPI icon={Activity} value={stats.last_forecast_run || '—'} label="Last forecast run" />
            </div>
            <div className="col-md-2">
              <KPI icon={Clock} value={stats.last_approved_update || '—'} label="Last approved data update" />
            </div>
            <div className="col-md-2">
              <KPI icon={AlertCircle} value={stats.pending_validations ?? 0} label="Pending validations" />
            </div>
            <div className="col-md-2">
              <KPI icon={Users} value={Object.values(stats.users_by_role || {}).reduce((a, b) => a + b, 0)} label="Users (all roles)" />
            </div>
            <div className="col-md-2">
              <KPI icon={AlertCircle} value={stats.failed_logins_24h ?? 0} label="Failed logins (24h)" />
            </div>
            <div className="col-md-2">
              <KPI icon={Database} value={stats.db_type || '—'} label="Database" />
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <div className="kpi-tile">
                <div className="kpi-icon"><Database size={20} strokeWidth={2} /></div>
                <div className="kpi-value">{stats.db_size || '—'}</div>
                <div className="kpi-label">Database size</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="kpi-tile">
                <div className="kpi-icon"><Activity size={20} strokeWidth={2} /></div>
                <div className="kpi-value">{stats.app_version || '—'}</div>
                <div className="kpi-label">App version</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="d-grid">
                <Button
                  variant="outline-primary"
                  onClick={handleRunForecast}
                  disabled={forecastRunning}
                  className="w-100"
                >
                  <Play size={16} strokeWidth={2} aria-hidden="true" />
                  {forecastRunning ? 'Running forecast…' : 'Run forecast now'}
                </Button>
              </div>
            </div>
          </div>
          <div className="row g-3">
            {Object.entries(stats.users_by_role || {}).map(([role, count]) => (
              <div key={role} className="col-md-3">
                <div className="kpi-tile">
                  <div className="kpi-icon"><Users size={20} strokeWidth={2} /></div>
                  <div className="kpi-value">{count}</div>
                  <div className="kpi-label">{role.charAt(0).toUpperCase() + role.slice(1)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>
    </ErrorBoundary>
  );
}
