import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, ChevronDown, ChevronRight, Info, Lock, RefreshCw,
} from 'lucide-react';
import { getAdminAuditLogs, getAdminMunicipalities } from '../../services/dataService';
import { useToast } from '../Toast';
import { SkeletonList } from '../Skeleton';
import PageHeader from './PageHeader';
import {
  AUDIT_ACTIONS,
  detailLabel,
  formatDetailValue,
  getActionMeta,
  getEntityLabel,
} from '../../utils/auditMeta';
import { formatAbsoluteTime, formatRelativeTime } from '../../utils/relativeTime';

const PER_PAGE = 50;

function AuditDetails({ entry, resolveMunicipalityName }) {
  const details = entry.details || {};
  const changeValue = (field, value) => (
    field === 'municipality_id' && value !== null && value !== undefined
      ? resolveMunicipalityName(value)
      : formatDetailValue(value)
  );
  const changes = details.changes && typeof details.changes === 'object'
    ? details.changes
    : null;
  const deleted = details.deleted && typeof details.deleted === 'object'
    ? details.deleted
    : null;
  const facts = Object.entries(details).filter(
    ([key]) => key !== 'changes' && key !== 'deleted',
  );
  const hasBody = Boolean(changes || deleted || facts.length);

  return (
    <div className="audit-details">
      <div className="audit-details__body">
        {changes && (
          <section className="audit-details__block">
            <h4>Changes</h4>
            <dl className="audit-changes">
              {Object.entries(changes).map(([field, change]) => {
                const from = change && typeof change === 'object' ? change.from : change;
                const to = change && typeof change === 'object' ? change.to : change;
                return (
                  <div className="audit-change" key={field}>
                    <dt>{detailLabel(field)}</dt>
                    <dd>
                      <span className="audit-change__from">{changeValue(field, from)}</span>
                      <ArrowRight size={12} aria-hidden="true" />
                      <span className="audit-change__to">{changeValue(field, to)}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )}

        {deleted && (
          <section className="audit-details__block">
            <h4>Deleted records</h4>
            <dl className="audit-facts">
              {Object.entries(deleted).map(([key, value]) => (
                <div className="audit-fact" key={key}>
                  <dt>{detailLabel(key)}</dt>
                  <dd>{formatDetailValue(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {facts.length > 0 && (
          <section className="audit-details__block">
            <h4>Event data</h4>
            <dl className="audit-facts">
              {facts.map(([key, value]) => (
                <div className="audit-fact" key={key}>
                  <dt>{detailLabel(key)}</dt>
                  <dd>
                    {key === 'municipality_id'
                      ? resolveMunicipalityName(value)
                      : formatDetailValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {!hasBody && (
          <p className="audit-details__empty">No additional event data was recorded.</p>
        )}
      </div>

      <dl className="audit-details__meta">
        <div><dt>Audit ID</dt><dd>#{entry.id}</dd></div>
        <div><dt>Recorded</dt><dd>{formatAbsoluteTime(entry.created_at)}</dd></div>
        <div><dt>Actor ID</dt><dd>{entry.actor_id ?? '—'}</dd></div>
        <div>
          <dt>Entity</dt>
          <dd>
            {getEntityLabel(entry.entity_type)}
            {entry.entity_id ? ` #${entry.entity_id}` : ''}
          </dd>
        </div>
        <div><dt>IP address</dt><dd>{entry.ip_address || '—'}</dd></div>
      </dl>
    </div>
  );
}

export default function AuditLogs() {
  const { toastError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [expanded, setExpanded] = useState(() => new Set());
  const [municipalities, setMunicipalities] = useState([]);

  // WHAT: URL ang source of truth ng page at filters.
  // WHY: Kapag na-refresh o na-share ang link, pareho pa rin ang view;
  //      gumagana rin ang browser back/forward sa pagitan ng pages.
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const appliedFilters = useMemo(() => ({
    action: searchParams.get('action') || '',
    entity_type: searchParams.get('entity_type') || '',
    actor_email: searchParams.get('actor_email') || '',
  }), [searchParams]);
  const [draftFilters, setDraftFilters] = useState(appliedFilters);

  useEffect(() => {
    setDraftFilters(appliedFilters);
  }, [appliedFilters]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = { page, per_page: PER_PAGE };
        Object.entries(appliedFilters).forEach(([key, value]) => {
          if (value) params[key] = value;
        });
        const response = await getAdminAuditLogs(params);
        if (cancelled) return;
        if (response.pages > 0 && page > response.pages) {
          // WHAT: Ibalik sa huling valid page kapag stale o manual ang URL.
          const next = new URLSearchParams(searchParams);
          if (response.pages <= 1) next.delete('page');
          else next.set('page', String(response.pages));
          setSearchParams(next, { replace: true });
          return;
        }
        if (response.pages === 0 && page > 1) {
          const next = new URLSearchParams(searchParams);
          next.delete('page');
          setSearchParams(next, { replace: true });
          return;
        }
        setLogs(response.logs || []);
        setPages(response.pages || 0);
        setTotal(response.total || 0);
      } catch (err) {
        if (cancelled) return;
        const message = err.message || 'Could not load audit logs.';
        setError(message);
        toastError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [page, appliedFilters, reloadToken, toastError, searchParams, setSearchParams]);

  // WHAT: Directory para maging pangalan (at link) ang entity IDs.
  // WHY: Ang audit row ay may entity_id lang; ang admin list ang may name/status.
  useEffect(() => {
    let cancelled = false;
    getAdminMunicipalities()
      .then((response) => {
        if (!cancelled) setMunicipalities(response.municipalities || []);
      })
      .catch(() => {
        // WHAT: Best-effort lang ito; huwag hadlangan ang audit table.
      });
    return () => { cancelled = true; };
  }, [reloadToken]);

  const municipalityById = useMemo(() => {
    const map = new Map();
    municipalities.forEach((municipality) => map.set(municipality.id, municipality));
    return map;
  }, [municipalities]);

  const hasFilters = Boolean(
    appliedFilters.action || appliedFilters.entity_type || appliedFilters.actor_email,
  );
  const draftDirty = Boolean(
    draftFilters.action || draftFilters.entity_type || draftFilters.actor_email,
  );

  const applyFilters = (event) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (draftFilters.action) next.set('action', draftFilters.action);
    if (draftFilters.entity_type) next.set('entity_type', draftFilters.entity_type);
    const actor = draftFilters.actor_email.trim();
    if (actor) next.set('actor_email', actor);
    setSearchParams(next);
  };

  const clearFilters = () => {
    setDraftFilters({ action: '', entity_type: '', actor_email: '' });
    setSearchParams({});
  };

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
  };

  const toggleDetails = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const resolveMunicipalityName = (id) => {
    const municipality = municipalityById.get(Number(id));
    return municipality ? municipality.name : `#${id}`;
  };

  const describeEntity = (entry) => {
    if (entry.entity_type === 'municipality') {
      const municipality = municipalityById.get(entry.entity_id);
      return {
        typeLabel: 'Municipality',
        primary: municipality?.name || entry.details?.name
          || (entry.entity_id ? `Municipality #${entry.entity_id}` : 'Municipality'),
        secondary: entry.entity_id ? `#${entry.entity_id}` : null,
        to: municipality ? `/admin/municipalities?highlight=${municipality.id}` : null,
        inactive: municipality?.status === 'inactive',
      };
    }

    if (entry.entity_type === 'barangay') {
      const municipality = municipalityById.get(Number(entry.details?.municipality_id));
      const name = entry.details?.new_name || entry.details?.name;
      return {
        typeLabel: 'Barangay',
        primary: name || (entry.entity_id ? `Barangay #${entry.entity_id}` : 'Barangay'),
        secondary: municipality ? `in ${municipality.name}` : (entry.entity_id ? `#${entry.entity_id}` : null),
        to: municipality ? `/admin/municipalities?highlight=${municipality.id}` : null,
        inactive: false,
      };
    }

    if (entry.entity_type === 'user') {
      const summaryEmail = entry.summary?.match(/^Updated account (.+)\.$/)?.[1];
      const email = entry.details?.email
        || summaryEmail
        || (entry.action?.startsWith('auth.') ? entry.actor_email : null);
      return {
        typeLabel: 'User',
        primary: email || (entry.entity_id ? `User #${entry.entity_id}` : 'User'),
        secondary: entry.entity_id ? `#${entry.entity_id}` : null,
        to: null,
        inactive: false,
      };
    }

    return {
      typeLabel: getEntityLabel(entry.entity_type),
      primary: entry.entity_id ? `#${entry.entity_id}` : '—',
      secondary: null,
      to: null,
      inactive: false,
    };
  };

  return (
    <>
      <PageHeader
        id="admin-audit-logs"
        variant="clean"
        className="ui-pageheader--admin ui-pageheader--audit"
        title="Audit Log"
        subtitle="Read-only trail of sensitive changes: municipalities, barangays, accounts, boundaries, and sign-ins."
        status={(
          <div className="audit-summary">
            <span className="audit-summary__item">
              <strong>{total}</strong>
              {total === 1 ? 'entry' : 'entries'}
            </span>
            <span className="audit-summary__item">
              <Lock size={12} aria-hidden="true" />
              Read-only
            </span>
            {hasFilters && (
              <span className="audit-summary__item audit-summary__item--filtered">
                Filtered view
              </span>
            )}
          </div>
        )}
        actions={(
          <Button
            variant="outline-secondary"
            onClick={() => setReloadToken((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      <Card className={`encoder-card admin-card audit-card${loading && logs.length ? ' is-loading' : ''}`}>
        <Card.Body>
          <Form onSubmit={applyFilters} className="audit-filters">
            <Row className="g-2 align-items-end">
              <Col xs={12} md={6} lg={3}>
                <Form.Label className="small mb-1" htmlFor="audit-filter-action">Action</Form.Label>
                <Form.Select
                  id="audit-filter-action"
                  size="sm"
                  value={draftFilters.action}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, action: event.target.value }))}
                >
                  <option value="">All actions</option>
                  {AUDIT_ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {getActionMeta(action).label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={12} md={6} lg={2}>
                <Form.Label className="small mb-1" htmlFor="audit-filter-entity">Entity</Form.Label>
                <Form.Select
                  id="audit-filter-entity"
                  size="sm"
                  value={draftFilters.entity_type}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, entity_type: event.target.value }))}
                >
                  <option value="">All entities</option>
                  <option value="municipality">Municipality</option>
                  <option value="barangay">Barangay</option>
                  <option value="user">User</option>
                </Form.Select>
              </Col>
              <Col xs={12} md={6} lg={3}>
                <Form.Label className="small mb-1" htmlFor="audit-filter-actor">Actor email contains</Form.Label>
                <Form.Control
                  id="audit-filter-actor"
                  size="sm"
                  type="search"
                  value={draftFilters.actor_email}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, actor_email: event.target.value }))}
                  placeholder="admin@pangasin.gov.ph"
                />
              </Col>
              <Col xs={6} md={3} lg={2}>
                <Button type="submit" size="sm" variant="primary" className="w-100" disabled={loading}>
                  Apply
                </Button>
              </Col>
              <Col xs={6} md={3} lg={2}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline-secondary"
                  className="w-100"
                  onClick={clearFilters}
                  disabled={loading || (!hasFilters && !draftDirty)}
                >
                  Clear
                </Button>
              </Col>
            </Row>
            <p className="audit-filters__hint">
              Action and entity filters match exactly; actor email matches partially. Newest entries appear first.
            </p>
          </Form>

          <div className="audit-meta">
            <span>
              {total} entr{total === 1 ? 'y' : 'ies'}
              {hasFilters ? ' matching the current filters' : ''}
            </span>
            <span className="audit-meta__right">
              {loading && logs.length > 0 ? 'Updating…' : `Page ${page}${pages ? ` of ${pages}` : ''}`}
              <span aria-hidden="true">·</span>
              50 per page
              <span aria-hidden="true">·</span>
              Newest first
            </span>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}
          {loading && logs.length === 0 && (
            <div className="text-center py-2"><SkeletonList rows={6} cols={6} /></div>
          )}

          {!loading && logs.length === 0 && (
            <div className="audit-empty">
              <Info size={22} aria-hidden="true" />
              <p>
                {hasFilters
                  ? 'No audit entries match the current filters.'
                  : 'No audit entries have been recorded yet.'}
              </p>
              {hasFilters && (
                <Button size="sm" variant="outline-secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {logs.length > 0 && (
            <Table
              responsive
              hover
              size="sm"
              className="mb-0 encoder-table admin-table audit-table"
              aria-label="Audit log entries"
              aria-busy={loading}
            >
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Summary</th>
                  <th>IP</th>
                  <th className="audit-cell-toggle">
                    <span className="visually-hidden">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => {
                  const meta = getActionMeta(entry.action);
                  const ActionIcon = meta.icon;
                  const entity = describeEntity(entry);
                  const isOpen = expanded.has(entry.id);
                  const detailsId = `audit-details-${entry.id}`;
                  return (
                    <React.Fragment key={entry.id}>
                      <tr className={isOpen ? 'audit-row--open' : undefined}>
                        <td className="audit-cell-time">
                          <time dateTime={entry.created_at || undefined} title={formatAbsoluteTime(entry.created_at)}>
                            {formatRelativeTime(entry.created_at)}
                          </time>
                          <span className="audit-cell-time__exact">
                            {formatAbsoluteTime(entry.created_at)}
                          </span>
                        </td>
                        <td className="audit-cell-actor" data-label="Actor">{entry.actor_email || '—'}</td>
                        <td>
                          <span className={`audit-action audit-action--${meta.tone}`}>
                            <ActionIcon size={13} aria-hidden="true" />
                            {meta.label}
                          </span>
                          <code className="audit-action-code">{entry.action}</code>
                        </td>
                        <td className="audit-cell-entity">
                          <span className="audit-entity-type">{entity.typeLabel}</span>
                          {entity.to ? (
                            <Link
                              className="audit-entity-link"
                              to={entity.to}
                              title={`Open Municipality Management and highlight ${entity.primary}`}
                            >
                              {entity.primary}
                            </Link>
                          ) : (
                            <span className="audit-entity-name" title={entity.primary}>
                              {entity.primary}
                            </span>
                          )}
                          {entity.secondary && (
                            <span className="audit-entity-sub">{entity.secondary}</span>
                          )}
                          {entity.inactive && (
                            <span className="audit-entity-flag">inactive</span>
                          )}
                        </td>
                        <td className="audit-cell-summary" data-label="Summary">{entry.summary || '—'}</td>
                        <td className="audit-cell-ip">{entry.ip_address || '—'}</td>
                        <td className="audit-cell-toggle">
                          <Button
                            variant="link"
                            size="sm"
                            className="audit-toggle"
                            onClick={() => toggleDetails(entry.id)}
                            aria-expanded={isOpen}
                            aria-controls={detailsId}
                            aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${meta.label} at ${formatAbsoluteTime(entry.created_at)}`}
                          >
                            {isOpen
                              ? <ChevronDown size={16} aria-hidden="true" />
                              : <ChevronRight size={16} aria-hidden="true" />}
                          </Button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="audit-details-row" id={detailsId}>
                          <td colSpan={7}>
                            <AuditDetails
                              entry={entry}
                              resolveMunicipalityName={resolveMunicipalityName}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </Table>
          )}

          {pages > 1 && (
            <div className="audit-pagination">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={loading || page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Previous
              </Button>
              <span className="audit-pagination__status">Page {page} of {pages}</span>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={loading || page >= pages}
                onClick={() => goToPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}

          <p className="audit-footnote">
            <Lock size={13} aria-hidden="true" />
            Audit entries are immutable and cannot be edited or deleted from this page.
          </p>
        </Card.Body>
      </Card>
    </>
  );
}
