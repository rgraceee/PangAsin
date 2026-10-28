import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAdminMonths } from '../../services/dataService';

/* WHAT: Mga pagpipilian sa Municipality filter (7 salt-producing + Pangasinan).
   WHY: parehas na ayos sa SALT_LIST ng MunicipalityMapArt para tugma ang highlight. */
export const MUNI_OPTIONS = ['Alaminos City', 'Anda', 'Bani', 'Bolinao', 'Dasol', 'Infanta', 'San Fabian'];

/* WHAT: Buong pangalan ng buwan para sa Month dropdown (January..December).
   WHY: mas malinaw kaysa Jan/Feb at kasya pa rin sa filter. */
const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }));
const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => String(i + 1));

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/* WHAT: Isang source of truth para sa URL-driven na muni/period filters.
   WHY: pareho ang reading, validation, at default ng filter bar at ng section
        na gumagamit ng values nito (Municipality Analytics). */
export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [adminMonths, setAdminMonths] = useState([]);

  useEffect(() => {
    let active = true;
    getAdminMonths({ source: 'municipality_production' })
      .then((res) => {
        if (active) setAdminMonths(res.months || []);
      })
      .catch(() => {
        if (active) setAdminMonths([]);
      });
    return () => { active = false; };
  }, []);

  const urlMuni = searchParams.get('muni') || '';
  const urlMonthRaw = searchParams.get('month') || '';
  const urlYearRaw = searchParams.get('year') || '';
  const urlStartRaw = searchParams.get('start') || '';
  const urlEndRaw = searchParams.get('end') || '';

  /* WHAT: 'year' (Year + Month) o 'range' (Start/End date + Apply).
     WHY: dalawang paraan ng pag-scope ng period sa parehong data source. */
  const mode = searchParams.get('mode') === 'range' ? 'range' : 'year';

  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  /* WHAT: Default na period = ngayong buwan; kung wala ito sa adminMonths ay
     gamitin ang pinakahuling buwan na may data.
     WHY: kapag walang URL params, may sensible na default pa rin ang dashboard. */
  const resolvedDefaultMonth = useMemo(() => {
    if (adminMonths.length > 0 && !adminMonths.includes(todayIso)) {
      return adminMonths[adminMonths.length - 1];
    }
    return todayIso;
  }, [adminMonths, todayIso]);

  /* WHAT: '' = All months. Specific month lang kapag may valid na ?month=1..12.
     WHY: ang '/trends?month=13' ay magbabalik ng 400; i-ignore ang invalid. */
  const isAllMonths = urlMonthRaw === '' || urlMonthRaw === 'all';
  const monthNumber = Number(urlMonthRaw);
  const hasValidMonth = !isAllMonths && Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12;
  const hasValidYear = /^\d{4}$/.test(urlYearRaw);

  const selectedMuni = urlMuni; // '' = Pangasinan (province-wide)
  const selYear = hasValidYear ? urlYearRaw : resolvedDefaultMonth.slice(0, 4);
  const selMonth = hasValidMonth ? String(monthNumber) : '';

  /* WHAT: Pinagsamang period key (YYYY-MM) o '' kapag "All months".
     WHY: ito ang ipinapasa sa /trends para sa month-scoped reporting stats. */
  const selectedAdminMonth = (isAllMonths || !selMonth)
    ? ''
    : `${selYear}-${String(Number(selMonth)).padStart(2, '0')}`;

  /* WHAT: Range lang ang gagamitin kapag kumpleto at maayos ang dalawang date.
     WHY: hindi dapat mag-request ang section ng half-open o baliktad na range. */
  const hasValidRange = isIsoDate(urlStartRaw) && isIsoDate(urlEndRaw) && urlStartRaw <= urlEndRaw;
  const rangeStart = hasValidRange ? urlStartRaw : '';
  const rangeEnd = hasValidRange ? urlEndRaw : '';

  const yearOptions = useMemo(() => {
    const years = new Set(adminMonths.map((m) => m.slice(0, 4)));
    years.add(String(new Date().getFullYear()));
    if (resolvedDefaultMonth) years.add(resolvedDefaultMonth.slice(0, 4));
    if (hasValidYear) years.add(urlYearRaw);
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [adminMonths, resolvedDefaultMonth, hasValidYear, urlYearRaw]);

  const periodHasData = selectedAdminMonth
    ? adminMonths.includes(selectedAdminMonth)
    : adminMonths.some((month) => month.startsWith(`${selYear}-`));

  /* WHAT: Default pa rin ang ?month=all, kaya hindi lalabas ang Reset dahil lang doon.
     WHY: pareho na ang kahulugan ng walang ?month at ?month=all. */
  const isDefaultFilters = urlMuni === '' && mode === 'year'
    && (urlMonthRaw === '' || urlMonthRaw === 'all') && urlYearRaw === '';

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const resetFilters = () => setSearchParams({});

  return {
    searchParams,
    setSearchParams,
    adminMonths,
    selectedMuni,
    selMonth,
    selYear,
    selectedAdminMonth,
    yearOptions,
    periodHasData,
    isDefaultFilters,
    mode,
    rangeStart,
    rangeEnd,
    updateParam,
    resetFilters,
  };
}

/* WHAT: Municipality / period filter bar (Year/Month o Start/End date range).
   WHY: dating nasa dashboard header; ngayon nasa itaas ng Municipality Analytics.
        Pareho pa rin ang IDs at URL params kaya walang binago sa backend. */
export default function DashboardFilters({ className = '' }) {
  const {
    searchParams,
    setSearchParams,
    selectedMuni,
    selMonth,
    selYear,
    yearOptions,
    adminMonths,
    periodHasData,
    isDefaultFilters,
    mode,
    rangeStart,
    rangeEnd,
    updateParam,
    resetFilters,
  } = useDashboardFilters();

  /* WHAT: Draft lang ang date inputs hanggang mapindot ang Apply.
     WHY: hindi dapat mag-refetch sa bawat keystroke ng date picker. */
  const [draftStart, setDraftStart] = useState(rangeStart);
  const [draftEnd, setDraftEnd] = useState(rangeEnd);

  useEffect(() => {
    setDraftStart(rangeStart);
    setDraftEnd(rangeEnd);
  }, [rangeStart, rangeEnd]);

  const rangeComplete = Boolean(draftStart && draftEnd);
  const rangeError = rangeComplete && draftStart > draftEnd
    ? 'Start date must be on or before end date.'
    : null;
  const canApplyRange = rangeComplete && !rangeError;
  const rangeApplied = Boolean(rangeStart && rangeEnd);

  const changeMode = (value) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('mode', value);
    if (value === 'year') {
      next.delete('mode');
      next.delete('start');
      next.delete('end');
    } else if (!rangeApplied) {
      /* WHAT: Sensible na simula sa Date range mode.
         WHY: may laman agad ang inputs bago pa pindutin ang Apply. */
      setDraftStart(`${selYear}-01-01`);
      setDraftEnd(`${selYear}-12-31`);
    }
    setSearchParams(next);
  };

  const applyRange = () => {
    if (!canApplyRange) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set('mode', 'range');
    next.set('start', draftStart);
    next.set('end', draftEnd);
    next.delete('year');
    next.delete('month');
    setSearchParams(next);
  };

  return (
    <div className={`dashboard-filters ${className}`.trim()}>
      <label className="dashboard-filter" htmlFor="admin-muni">
        <span className="dashboard-filter__label">Municipality</span>
        <select
          id="admin-muni"
          className="form-select"
          value={selectedMuni}
          onChange={(e) => updateParam('muni', e.target.value)}
        >
          <option value="">Pangasinan</option>
          {MUNI_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>

      <label className="dashboard-filter" htmlFor="admin-period-mode">
        <span className="dashboard-filter__label">Filter by</span>
        <select
          id="admin-period-mode"
          className="form-select"
          value={mode}
          onChange={(e) => changeMode(e.target.value)}
        >
          <option value="year">Year</option>
          <option value="range">Date range</option>
        </select>
      </label>

      {mode === 'year' ? (
        <>
          <label className="dashboard-filter" htmlFor="admin-year">
            <span className="dashboard-filter__label">Year</span>
            <select
              id="admin-year"
              className="form-select"
              value={selYear}
              onChange={(e) => updateParam('year', e.target.value)}
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>

          <label className="dashboard-filter" htmlFor="admin-month">
            <span className="dashboard-filter__label">Month</span>
            <select
              id="admin-month"
              className="form-select"
              value={selMonth}
              onChange={(e) => updateParam('month', e.target.value)}
            >
              <option value="">All months</option>
              {MONTH_NUMBERS.map((num, i) => <option key={num} value={num}>{MONTH_LABELS[i]}</option>)}
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="dashboard-filter" htmlFor="admin-start-date">
            <span className="dashboard-filter__label">Start date</span>
            <input
              id="admin-start-date"
              type="date"
              className="form-control"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
            />
          </label>

          <label className="dashboard-filter" htmlFor="admin-end-date">
            <span className="dashboard-filter__label">End date</span>
            <input
              id="admin-end-date"
              type="date"
              className="form-control"
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="dashboard-filter-apply"
            onClick={applyRange}
            disabled={!canApplyRange}
          >
            Apply
          </button>
        </>
      )}

      {!isDefaultFilters && (
        <button type="button" className="dashboard-filter-reset" onClick={resetFilters}>Reset</button>
      )}

      {mode === 'year' && adminMonths.length > 0 && !periodHasData && (
        <p className="dashboard-filter-note" role="status">No data for this period.</p>
      )}

      {mode === 'range' && rangeError && (
        <p className="dashboard-filter-note" role="alert">{rangeError}</p>
      )}

      {mode === 'range' && !rangeApplied && !rangeError && (
        <p className="dashboard-filter-note" role="status">Choose a start and end date, then Apply.</p>
      )}
    </div>
  );
}
