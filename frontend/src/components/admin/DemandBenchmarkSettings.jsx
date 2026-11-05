import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Form, Row } from 'react-bootstrap';
import { Plus, Trash2 } from 'lucide-react';
import {
  getAdminSupplyDemand,
  updateAdminDemandBenchmark,
  updateAdminSectorDemandSettings,
} from '../../services/dataService';
import { useToast } from '../Toast';
import { SkeletonBlock } from '../Skeleton';
import PageHeader from './PageHeader';
import './GenerateReports.css';
import { fmtMT } from '../../utils/volumeFormat';

const SCOPES = [
  {
    key: 'provincial',
    name: 'Pangasinan',
    demandLabel: 'Local demand (Pangasinan)',
    supplyLabel: 'Local supply (Pangasinan)',
    sourceDefault: 'DOST NICER / ASIN Center benchmark',
  },
  {
    key: 'national',
    name: 'Philippines',
    demandLabel: 'National demand (Philippines)',
    supplyLabel: 'Domestic supply (Philippines)',
    sourceDefault: 'PSA / industry reference',
  },
];

function findBenchmark(data, scope, year) {
  return (data?.benchmarks_by_year?.[scope] || [])
    .find((benchmark) => String(benchmark.year) === String(year));
}

function makeForm(data, scope, year) {
  const benchmark = findBenchmark(data, scope, year);
  return {
    year: String(year),
    demand_volume: benchmark?.demand_volume ?? '',
    local_production: benchmark?.local_production ?? '',
    source_name: benchmark?.source_name ?? SCOPES.find((item) => item.key === scope).sourceDefault,
    source_reference: benchmark?.source_reference ?? '',
    notes: benchmark?.notes ?? '',
  };
}

function withOthersRemainder(sectors = []) {
  const configured = sectors.filter((sector) => sector.name.trim().toLowerCase() !== 'others');
  const allocated = configured.reduce(
    (total, sector) => total + (Number(sector.percentage) || 0),
    0,
  );
  const others = sectors.find((sector) => sector.name.trim().toLowerCase() === 'others');
  return [
    ...configured,
    {
      ...(others || {}),
      name: 'Others',
      percentage: Math.max(Math.round((100 - allocated) * 100) / 100, 0),
    },
  ];
}

export default function DemandBenchmarkSettings() {
  const { toastSuccess, toastError } = useToast();
  const [data, setData] = useState(null);
  const [forms, setForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [savingScope, setSavingScope] = useState('');
  const [sectorScope, setSectorScope] = useState('national');
  const [sectorForms, setSectorForms] = useState({ national: [], provincial: [] });
  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorPercentage, setNewSectorPercentage] = useState('');
  const [sectorError, setSectorError] = useState('');
  const [savingSectors, setSavingSectors] = useState(false);

  useEffect(() => {
    let active = true;
    getAdminSupplyDemand()
      .then((response) => {
        if (!active) return;
        const availableYears = (response.available_years || []).map(String);
        const initialForms = {};
        SCOPES.forEach(({ key }) => {
          const latest = (response.benchmarks_by_year?.[key] || [])[0];
          const year = String(latest?.year ?? response.pangasinan?.year ?? new Date().getFullYear());
          if (!availableYears.includes(year)) availableYears.push(year);
          initialForms[key] = makeForm(response, key, year);
        });
        setData({ ...response, available_years: availableYears.sort((a, b) => b.localeCompare(a)) });
        setForms(initialForms);
        setSectorForms({
          national: withOthersRemainder(response.sector_settings_by_scope?.national),
          provincial: withOthersRemainder(response.sector_settings_by_scope?.provincial),
        });
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Could not load demand benchmark settings.');
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const availableYears = useMemo(
    () => data?.available_years || [],
    [data],
  );

  const updateForm = (scope, patch) => {
    setForms((current) => ({ ...current, [scope]: { ...current[scope], ...patch } }));
    setFormErrors((current) => ({ ...current, [scope]: '' }));
  };

  const changeYear = (scope, year) => {
    setForms((current) => ({
      ...current,
      [scope]: makeForm(data, scope, year),
    }));
    setFormErrors((current) => ({ ...current, [scope]: '' }));
  };

  const activeSectors = withOthersRemainder(sectorForms[sectorScope]);
  const configuredSectors = activeSectors.filter(
    (sector) => sector.name.trim().toLowerCase() !== 'others',
  );
  const configuredPercentage = configuredSectors.reduce(
    (total, sector) => total + (Number(sector.percentage) || 0),
    0,
  );
  const totalSectorPercentage = configuredPercentage <= 100
    ? 100
    : configuredPercentage;
  const selectedBenchmark = sectorScope === 'national'
    ? data?.philippines
    : data?.pangasinan;
  const sectorTotals = sectorScope === 'national'
    ? {
      demand: Number(selectedBenchmark?.demand_volume) || 0,
      supply: (Number(selectedBenchmark?.local_production) || 0)
        + (Number(selectedBenchmark?.import_volume) || 0),
      production: Number(selectedBenchmark?.local_production) || 0,
    }
    : {
      demand: Number(selectedBenchmark?.demand_volume) || 0,
      supply: Number(selectedBenchmark?.local_production) || 0,
      production: Number(selectedBenchmark?.local_production) || 0,
    };

  const addSector = () => {
    const name = newSectorName.trim();
    const percentage = Number(newSectorPercentage);
    if (!name || !Number.isFinite(percentage)) return;
    if (name.toLowerCase() === 'others') {
      setSectorError('Others is calculated automatically from unallocated percentages.');
      return;
    }
    if (percentage < 0 || percentage > 100) {
      setSectorError('Sector percentage must be from 0 to 100%.');
      return;
    }
    if (configuredSectors.some((sector) => sector.name.trim().toLowerCase() === name.toLowerCase())) {
      setSectorError('Sector names must be unique within this scope.');
      return;
    }
    if (configuredPercentage + percentage > 100) {
      setSectorError('Combined sector percentages cannot exceed 100%.');
      return;
    }
    setSectorForms((current) => ({
      ...current,
      [sectorScope]: [
        ...current[sectorScope],
        { name, percentage: String(percentage) },
      ],
    }));
    setNewSectorName('');
    setNewSectorPercentage('');
    setSectorError('');
  };

  const updateSector = (index, patch) => {
    if (activeSectors[index]?.name.trim().toLowerCase() === 'others') return;
    setSectorForms((current) => ({
      ...current,
      [sectorScope]: current[sectorScope].map((sector, i) => (
        i === index ? { ...sector, ...patch } : sector
      )),
    }));
    setSectorError('');
  };

  const removeSector = (index) => {
    if (activeSectors[index]?.name.trim().toLowerCase() === 'others') return;
    setSectorForms((current) => ({
      ...current,
      [sectorScope]: current[sectorScope].filter((_, i) => i !== index),
    }));
    setSectorError('');
  };

  const saveSectors = async (event) => {
    event.preventDefault();
    setSectorError('');
    const invalid = configuredSectors.some((sector) => (
      !sector.name.trim()
      || !Number.isFinite(Number(sector.percentage))
      || Number(sector.percentage) < 0
      || Number(sector.percentage) > 100
    ));
    if (invalid) {
      setSectorError('Enter a sector name and a percentage from 0 to 100 for every row.');
      return;
    }
    if (configuredPercentage > 100) {
      setSectorError('Combined sector percentages cannot exceed 100%.');
      return;
    }

    setSavingSectors(true);
    try {
      const result = await updateAdminSectorDemandSettings({
        geographic_scope: sectorScope,
        sectors: configuredSectors.map(({ name, percentage }) => ({
          name: name.trim(),
          percentage: Number(percentage),
        })),
      });
      setSectorForms((current) => ({
        ...current,
        [sectorScope]: withOthersRemainder(
          result.sectors || [
            ...configuredSectors,
            { name: 'Others', percentage: 100 - configuredPercentage },
          ],
        ),
      }));
      toastSuccess(
        `${SCOPES.find((item) => item.key === sectorScope).name} sector allocations saved.`,
        'Sector settings updated',
      );
    } catch (err) {
      const message = err.status === 401
        ? 'Your admin session has expired. Sign in again to save sector settings.'
        : err.status === 403
          ? 'Admin access is required to save sector settings.'
          : err.data?.errors?.join(' ')
        || err.message
        || 'Could not save sector settings.';
      setSectorError(message);
    } finally {
      setSavingSectors(false);
    }
  };

  const save = async (event, scope) => {
    event.preventDefault();
    const form = forms[scope];
    if (!form) return;
    setSavingScope(scope);
    setFormErrors((current) => ({ ...current, [scope]: '' }));
    try {
      const payload = {
        geographic_scope: scope,
        year: Number(form.year),
        demand_volume: Number(form.demand_volume),
        source_name: form.source_name,
        source_reference: form.source_reference,
        notes: form.notes,
      };
      if (scope === 'national') {
        payload.local_production = form.local_production === ''
          ? null
          : Number(form.local_production);
      }
      const result = await updateAdminDemandBenchmark(payload);
      const refreshed = await getAdminSupplyDemand();
      setData((current) => ({
        ...refreshed,
        available_years: current?.available_years || refreshed.available_years || [],
      }));
      setForms((current) => ({
        ...current,
        [scope]: {
          ...current[scope],
          local_production: result.benchmark.local_production ?? '',
        },
      }));
      toastSuccess(`${SCOPES.find((item) => item.key === scope).name} benchmark saved.`, 'Benchmark updated');
    } catch (err) {
      const message = err.data?.errors?.join(' ')
        || err.message
        || 'Could not save this demand benchmark.';
      setFormErrors((current) => ({ ...current, [scope]: message }));
      toastError(message, 'Benchmark not saved');
    } finally {
      setSavingScope('');
    }
  };

  if (loading) {
    return (
      <div className="skeleton-dashboard">
        <SkeletonBlock width="40%" height={24} />
        <SkeletonBlock width="65%" height={13} />
        <div className="row g-3 mt-2">
          <div className="col-lg-6"><div className="skeleton-card"><SkeletonBlock height={340} /></div></div>
          <div className="col-lg-6"><div className="skeleton-card"><SkeletonBlock height={340} /></div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rg-page admin-benchmark-settings">
      <PageHeader
        id="admin-demand-benchmarks"
        variant="clean"
        className="ui-pageheader--admin ui-pageheader--no-map"
        title="Demand Benchmark Settings"
        subtitle="Manage annual demand benchmarks for Pangasinan and the Philippines."
      />
      {error && <Alert variant="danger" role="alert">{error}</Alert>}
      <Alert variant="info">
        Pangasinan local supply is calculated from recorded production for the selected year and is not manually editable.
        Imports are not edited here.
      </Alert>
      <Row className="g-3">
        {SCOPES.map(({ key, name, demandLabel, supplyLabel }) => {
          const form = forms[key] || {};
          const isProvincial = key === 'provincial';
          const annualSupply = data?.local_supply_by_year?.[form.year] ?? 0;
          return (
            <Col lg={6} key={key}>
              <Card className="encoder-card h-100">
                <Card.Header as="h5">{name} benchmark</Card.Header>
                <Form onSubmit={(event) => save(event, key)}>
                  <Card.Body>
                    {formErrors[key] && <Alert variant="danger" role="alert">{formErrors[key]}</Alert>}
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor={`${key}-benchmark-year`}>Year</Form.Label>
                      <Form.Select
                        id={`${key}-benchmark-year`}
                        value={form.year || ''}
                        onChange={(event) => changeYear(key, event.target.value)}
                        required
                      >
                        {availableYears.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor={`${key}-benchmark-demand`}>{demandLabel} (Metric Tons (MT))</Form.Label>
                      <Form.Control
                        id={`${key}-benchmark-demand`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.demand_volume ?? ''}
                        onChange={(event) => updateForm(key, { demand_volume: event.target.value })}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor={`${key}-benchmark-supply`}>{supplyLabel} (Metric Tons (MT))</Form.Label>
                      <Form.Control
                        id={`${key}-benchmark-supply`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={isProvincial ? annualSupply : (form.local_production ?? '')}
                        onChange={(event) => updateForm(key, { local_production: event.target.value })}
                        readOnly={isProvincial}
                      />
                      {isProvincial && (
                        <Form.Text>
                          Automatically calculated: {fmtMT(annualSupply)} MT produced in {form.year}.
                        </Form.Text>
                      )}
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor={`${key}-benchmark-source`}>Source</Form.Label>
                      <Form.Control
                        id={`${key}-benchmark-source`}
                        maxLength={255}
                        value={form.source_name ?? ''}
                        onChange={(event) => updateForm(key, { source_name: event.target.value })}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor={`${key}-benchmark-reference`}>Source reference</Form.Label>
                      <Form.Control
                        id={`${key}-benchmark-reference`}
                        as="textarea"
                        rows={2}
                        value={form.source_reference ?? ''}
                        onChange={(event) => updateForm(key, { source_reference: event.target.value })}
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label htmlFor={`${key}-benchmark-notes`}>Notes</Form.Label>
                      <Form.Control
                        id={`${key}-benchmark-notes`}
                        as="textarea"
                        rows={2}
                        value={form.notes ?? ''}
                        onChange={(event) => updateForm(key, { notes: event.target.value })}
                      />
                    </Form.Group>
                  </Card.Body>
                  <Card.Footer className="d-flex justify-content-end">
                    <button
                      type="submit"
                      className="ui-btn-primary"
                      disabled={Boolean(savingScope)}
                    >
                      {savingScope === key ? 'Saving…' : `Save ${name} benchmark`}
                    </button>
                  </Card.Footer>
                </Form>
              </Card>
            </Col>
          );
        })}
      </Row>
      <Card className="encoder-card mt-4">
        <Card.Header as="h5">Sector Demand Breakdown Settings</Card.Header>
        <Card.Body>
          <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Sector settings scope">
            {SCOPES.map(({ key, name }) => (
              <button
                type="button"
                key={key}
                className={sectorScope === key ? 'ui-btn-primary' : 'ui-btn-outline'}
                aria-pressed={sectorScope === key}
                onClick={() => {
                  setSectorScope(key);
                  setSectorError('');
                }}
              >
                {name}
              </button>
            ))}
          </div>
          {sectorError && <Alert variant="danger" role="alert">{sectorError}</Alert>}
          <Form onSubmit={saveSectors}>
            {activeSectors.length > 0 ? (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Sector</th>
                      <th scope="col" style={{ minWidth: 150 }}>Share of demand (%)</th>
                      <th scope="col">Calculated demand (MT)</th>
                      <th scope="col">Calculated supply (MT)</th>
                      <th scope="col">Calculated produced (MT)</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSectors.map((sector, index) => {
                      const share = (Number(sector.percentage) || 0) / 100;
                      return (
                        <tr key={sector.id || `${sector.name}-${index}`}>
                          <td>
                            <Form.Control
                              aria-label={`Sector ${index + 1} name`}
                              maxLength={100}
                              value={sector.name}
                              onChange={(event) => updateSector(index, { name: event.target.value })}
                              readOnly={sector.name.trim().toLowerCase() === 'others'}
                              required
                            />
                          </td>
                          <td>
                            <Form.Control
                              aria-label={`${sector.name || `Sector ${index + 1}`} percentage`}
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={sector.percentage}
                              onChange={(event) => updateSector(index, { percentage: event.target.value })}
                              readOnly={sector.name.trim().toLowerCase() === 'others'}
                              required
                            />
                          </td>
                          <td>{fmtMT(sectorTotals.demand * share)}</td>
                          <td>{fmtMT(sectorTotals.supply * share)}</td>
                          <td>{fmtMT(sectorTotals.production * share)}</td>
                          <td>
                            <button
                              type="button"
                              className="ui-btn-text ui-btn--sm"
                              aria-label={`Remove ${sector.name || `sector ${index + 1}`}`}
                              onClick={() => removeSector(index)}
                              disabled={sector.name.trim().toLowerCase() === 'others'}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted">No sectors configured for {SCOPES.find((item) => item.key === sectorScope).name}.</p>
            )}
            <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
              <Form.Group>
                <Form.Label htmlFor="new-sector-name">New sector</Form.Label>
                <Form.Control
                  id="new-sector-name"
                  maxLength={100}
                  value={newSectorName}
                  onChange={(event) => setNewSectorName(event.target.value)}
                  placeholder="e.g. Food Processing"
                />
              </Form.Group>
              <Form.Group>
                <Form.Label htmlFor="new-sector-percentage">Share (%)</Form.Label>
                <Form.Control
                  id="new-sector-percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={newSectorPercentage}
                  onChange={(event) => setNewSectorPercentage(event.target.value)}
                  placeholder="50"
                />
              </Form.Group>
              <button
                type="button"
                className="ui-btn-outline"
                onClick={addSector}
                disabled={!newSectorName.trim() || newSectorPercentage === ''}
              >
                <Plus size={16} aria-hidden="true" />
                Add sector
              </button>
            </div>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <span className={configuredPercentage > 100 ? 'text-danger' : 'text-muted'}>
                Total allocated: {totalSectorPercentage.toFixed(2)}% / 100% (including Others free space)
              </span>
              <button
                type="submit"
                className="ui-btn-primary"
                disabled={savingSectors || configuredPercentage > 100}
              >
                {savingSectors ? 'Saving…' : `Save ${SCOPES.find((item) => item.key === sectorScope).name} sectors`}
              </button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
