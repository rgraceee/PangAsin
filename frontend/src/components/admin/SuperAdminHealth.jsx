import React, { useEffect, useState } from 'react';
import { Card } from 'react-bootstrap';
import { Activity, Users, Clock, AlertCircle } from 'lucide-react';
import { getAdminStats } from '../../services/dataService';
import PageHeader from './PageHeader';
import ErrorBoundary from '../ErrorBoundary';

export default function SuperAdminHealth() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAdminStats()
      .then((s) => {
        if (!cancelled) {
          setStats(s || {});
          setLoading(false);
        }
      })
      .catch(() => { setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <ErrorBoundary>
      <PageHeader id="superadmin-health" title="System Health" subtitle="SuperAdmin system overview" />
      <Card className="encoder-card admin-card">
        <Card.Body>
          {loading && <div className="text-center py-3">Loading health summary…</div>}
          {!loading && (
            <div className="row g-3">
              <div className="col-md-3">
                <div className="kpi-tile">
                  <div className="kpi-icon"><Activity size={20} strokeWidth={2} /></div>
                  <div className="kpi-value">{stats.last_forecast_run || '—'}</div>
                  <div className="kpi-label">Last forecast run</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="kpi-tile">
                  <div className="kpi-icon"><Clock size={20} strokeWidth={2} /></div>
                  <div className="kpi-value">{stats.last_approved_update || '—'}</div>
                  <div className="kpi-label">Last approved data update</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="kpi-tile">
                  <div className="kpi-icon"><AlertCircle size={20} strokeWidth={2} /></div>
                  <div className="kpi-value">{stats.pending_validations ?? 0}</div>
                  <div className="kpi-label">Pending validations</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="kpi-tile">
                  <div className="kpi-icon"><Users size={20} strokeWidth={2} /></div>
                  <div className="kpi-value">{stats.total_users ?? 0}</div>
                  <div className="kpi-label">Users (all roles)</div>
                </div>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>
    </ErrorBoundary>
  );
}
