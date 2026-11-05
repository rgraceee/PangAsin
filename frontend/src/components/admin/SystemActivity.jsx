// WHAT: System > Activity page - superadmin-only audit logs and login history.
// WHY: SuperAdmin reviews authentication and administrative actions without
//      exposing this page to Admins or Encoders.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Table, Tabs } from 'react-bootstrap';
import { getAuditLog, getLoginEvents } from '../../services/dataService';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import PageHeader from './PageHeader';

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function SystemActivity() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('audit');
  const { toastError } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const request = activeTab === 'audit'
      ? getAuditLog({ page: 1, per_page: 50 })
      : getLoginEvents({ page: 1, per_page: 50 });
    request
      .then((result) => { setRows(result.entries || []); setLoading(false); })
      .catch((err) => {
        setError(err.message || 'Failed to load activity.');
        setRows([]);
        setLoading(false);
        toastError(err.message || 'Failed to load activity.');
      });
  }, [activeTab, toastError]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        variant="clean"
        className="ui-pageheader--admin"
        title="Activity"
        subtitle="Audit log and sign-in history for the whole system."
      />

      <Card className="encoder-card admin-card">
        <Card.Body>
          <Tabs activeKey={activeTab} onSelect={(key) => setActiveTab(key || 'audit')} className="mb-3">
            <Tabs.Tab eventKey="audit" title="Audit Log" />
            <Tabs.Tab eventKey="login" title="Login History" />
          </Tabs>

          {error && <Alert variant="danger">{error}</Alert>}
          {loading && <div className="text-center py-2"><SkeletonList rows={8} cols={5} /></div>}
          {!loading && rows.length === 0 && (
            <Alert variant="info">
              {activeTab === 'audit' ? 'No audit log entries found.' : 'No login events found.'}
            </Alert>
          )}

          {!loading && rows.length > 0 && activeTab === 'audit' && (
            <Table responsive hover size="sm" className="mb-0 encoder-table admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatTime(entry.created_at)}</td>
                    <td>{entry.actor_email || '—'}</td>
                    <td>{entry.action || '—'}</td>
                    <td>{entry.entity_type ? `${entry.entity_type} #${entry.entity_id ?? '—'}` : '—'}</td>
                    <td>{entry.summary || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {!loading && rows.length > 0 && activeTab === 'login' && (
            <Table responsive hover size="sm" className="mb-0 encoder-table admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Email</th>
                  <th>Result</th>
                  <th>IP Address</th>
                  <th>User Agent</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((event) => (
                  <tr key={event.id}>
                    <td>{formatTime(event.created_at)}</td>
                    <td>{event.email || '—'}</td>
                    <td>
                      <span className={`record-status-badge ${event.success ? 'status-approved' : 'status-rejected'}`}>
                        {event.success ? 'success' : 'failed'}
                      </span>
                    </td>
                    <td>{event.ip || '—'}</td>
                    <td className="text-truncate" style={{ maxWidth: 280 }}>{event.user_agent || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </>
  );
}
