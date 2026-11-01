// WHAT: System > Activity page - superadmin-only audit logs and login history.
// WHY: SuperAdmin needs to review all authentication and administrative actions
//      across the system for audit and compliance.
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, Table, Tabs } from 'react-bootstrap';
import { getAuditLog, getLoginEvents } from '../../services/dataService';
import { useToast } from '../Toast';
import PageHeader from './PageHeader';

export default function SystemActivity() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loginEvents, setLoginEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('audit');
  const [toastError] = useToast();

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const { entries } = await getAuditLog({ page: 1, per_page: 50 });
      setAuditLogs(entries || []);
    } catch (e) {
      toastError(e.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoginEvents = async () => {
    setLoading(true);
    try {
      const { entries } = await getLoginEvents({ page: 1, per_page: 50 });
      setLoginEvents(entries || []);
    } catch (e) {
      toastError(e.message || 'Failed to load login events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
    else fetchLoginEvents();
  }, [activeTab, toastError]);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Help & Support" />
      <Card>
        <CardHeader>
          <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k)}>
            <Tabs.Tab eventKey="audit" title="Audit Log" />
            <Tabs.Tab eventKey="login" title="Login History" />
          </Tabs>
        </CardHeader>
        <CardBody>
          <h5 className="mb-3">Audit Log</h5>
          <p className="text-muted mb-3">
            All administrative actions performed in the system, including
            user management, production records, and system configuration
            changes.
          </p>
          <div className="table-container">
            {loading ? (
              <div className="text-center py-4">Loading audit log...</div>
            ) : (
              <></>
            )}
            {loading ? null : (
              <Table striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {(auditLogs || []).map((log) => (
                    <tr key={log.id}>
                      <td>{log.created_at || '—'}</td>
                      <td>{log.actor_name || log.actor_email || '—'}</td>
                      <td>{log.action || '—'}</td>
                      <td>{log.target_type} #{log.target_id || '—'}</td>
                      <td>
                        {log.details ? (
                          <span
                            className="badge bg-info text-white"
                            style={{ fontSize: '0.75rem' }}
                          >
                            Details
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {(auditLogs || []).length === 0 && (
              <div className="text-center py-4 text-muted">
                No audit log entries found.
              </div>
            )}
          </div>
        </CardBody>
        <CardBody>
          <h5 className="mb-3">Login History</h5>
          <p className="text-muted mb-3">
            All login attempts (successful and failed) across the system,
            including IP address and user agent for auditing purposes.
          </p>
          <div className="table-container">
            {loading ? (
              <div className="text-center py-4">Loading login history...</div>
            ) : (
              <Table striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {(loginEvents || []).map((event) => (
                    <tr key={event.id}>
                      <td>{event.created_at || '—'}</td>
                      <td>{event.user_id || '—'}</td>
                      <td>{event.email || '—'}</td>
                      <td>
                        <span
                          className={`badge ${
                            event.success
                              ? 'bg-success'
                              : 'bg-danger'
                          }`}
                        >
                          {event.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td>{event.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {(loginEvents || []).length === 0 && (
              <div className="text-center py-4 text-muted">
                No login events found.
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
