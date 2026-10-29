import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Loader2, MapPin } from 'lucide-react';
import { getAdminMonths } from '../../services/dataService';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';

/* WHAT: Municipality options come from the active database directory.
   WHY: Adding or deactivating a municipality must update this filter without a
        code change, and the map highlight must match the same list. */

/* WHAT: Buong pangalan ng buwan para sa Month dropdown (January..December).
   WHY: mas malinaw kaysa Jan/Feb at kasya pa rin sa filter. */
const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }));
const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => String(i + 1));

const MUNICIPALITY_PARAM = 'municipality';
const LEGACY_MUNICIPALITY_PARAM = 'muni';
const MUNICIPALITY_STORAGE_KEY = 'pangasin.admin.municipality';

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/* WHAT: Slug rules matching app/services/municipality_service.py.
   WHY: The API already returns the slug, but the fallback keeps older cached
        directory payloads working until the next refresh. */
export function municipalitySlug(name) {
  let value = String(name || '').trim().toLowerCase();
  if (value.startsWith('city of ')) value = value.slice('city of '.length);
  if (value.endsWith(' city')) value = value.slice(0, -' city'.length);
  return value.replace(/[^a-z0-9]+/g, '');
}

function readStoredMunicipality() {
  try {
    return window.localStorage.getItem(MUNICIPALITY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function storeMunicipality(slug) {
  try {
    if (slug) window.localStorage.setItem(MUNICIPALITY_STORAGE_KEY, slug);
    else window.localStorage.removeItem(MUNICIPALITY_STORAGE_KEY);
  } catch {
    /* WHAT: Private mode / blocked storage must never break the filter. */
  }
}

/* WHAT: Isang source of truth para sa URL-driven na muni/period filters.
   WHY: pareho ang reading, validation, at default ng filter bar at ng section
        na gumagamit ng values nito (Admin Dashboard at Municipality Analytics). */
export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [adminMonths, setAdminMonths] = useState([]);
  const {
    municipalities,
    activeNames: muniOptions,
    loading: directoryLoading,
  } = useMunicipalityDirectory();

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

  const urlSlug = (searchParams.get(MUNICIPALITY_PARAM) || '').trim().toLowerCase();
  const legacyMuniName = searchParams.get(LEGACY_MUNICIPALITY_PARAM) || '';
  const urlMonthRaw = searchParams.get('month') || '';
  const urlYearRaw = searchParams.get('year') || '';
  const urlStartRaw = searchParams.get('start') || '';
  const urlEndRaw = searchParams.get('end') || '';

  /* WHAT: Isang listahan ng {id, name, slug} para sa chip dropdown at URL.
     WHY: The slug is the stable value in the query string; the name is still
          what Municipality Analytics uses for its client-side scope labels. */
  const municipalityOptions = useMemo(() => municipalities
    .map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug || municipalitySlug(m.name),
    }))
    .filter((m) => m.name && m.slug)
    .sort((a, b) => a.name.localeCompare(b.name)), [municipalities]);

  const municipalityBySlug = useMemo(
    () => new Map(municipalityOptions.map((m) => [m.slug, m])),
    [municipalityOptions],
  );

  /* WHAT: The URL wins. The stored slug is only used to restore a selection
     after a refresh when the URL has no municipality param yet.
     WHY: A shared link must open the municipality it names, not the last one
          this browser happened to pick. */
  const [storedSlug, setStoredSlug] = useState(() => readStoredMunicipality());
  /* WHAT: Ang stored slug ay fallback lang bago mag-restore sa URL.
     WHY: kapag pinili na ang "All municipalities", walang dating slug na dapat
          bumalik kahit nasa localStorage pa ito. */
  const [restoreDone, setRestoreDone] = useState(false);
  const selectedMunicipalitySlug = useMemo(() => {
    if (urlSlug) return urlSlug;
    if (legacyMuniName) {
      const match = municipalityOptions.find((m) => m.name === legacyMuniName);
      return match ? match.slug : '';
    }
    if (
      !restoreDone
      && !directoryLoading
      && storedSlug
      && municipalityBySlug.has(storedSlug)
    ) {
      return storedSlug;
    }
    return '';
  }, [
    urlSlug, legacyMuniName, municipalityOptions, directoryLoading,
    storedSlug, municipalityBySlug, restoreDone,
  ]);

  const selectedMunicipality = municipalityBySlug.get(selectedMunicipalitySlug) || null;
  const selectedMuni = selectedMunicipality?.name || '';

  /* WHAT: Isang beses lang i-restore ang stored na bayan sa URL.
     WHY: pagkatapos ng Reset, "All municipalities" na ang dapat manatili kahit
          may dating naka-save pang slug sa localStorage. */
  useEffect(() => {
    if (directoryLoading) return;
    const next = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (!urlSlug && !legacyMuniName) {
      if (!restoreDone && storedSlug && municipalityBySlug.has(storedSlug)) {
        next.set(MUNICIPALITY_PARAM, storedSlug);
        changed = true;
      }
    } else if (legacyMuniName && !urlSlug) {
      const match = municipalityOptions.find((m) => m.name === legacyMuniName);
      if (match) {
        next.set(MUNICIPALITY_PARAM, match.slug);
        next.delete(LEGACY_MUNICIPALITY_PARAM);
        changed = true;
      }
    } else if (urlSlug && !municipalityBySlug.has(urlSlug)) {
      /* WHAT: Unknown/inactive slug -> province-wide instead of an API error.
         WHY: the backend still validates the slug; the UI just self-heals. */
      next.delete(MUNICIPALITY_PARAM);
      changed = true;
    }

    if (changed) setSearchParams(next, { replace: true });
    if (!restoreDone) setRestoreDone(true);
  }, [
    directoryLoading, urlSlug, legacyMuniName, storedSlug, municipalityOptions,
    municipalityBySlug, searchParams, setSearchParams, restoreDone,
  ]);

  /* WHAT: Kapag may valid na slug sa URL, gawin itong huling pinili sa browser.
     WHY: refresh at next visit ay pareho ang municipality na bubukas. */
  useEffect(() => {
    if (directoryLoading) return;
    if (urlSlug && municipalityBySlug.has(urlSlug)) {
      storeMunicipality(urlSlug);
      setStoredSlug(urlSlug);
    }
  }, [directoryLoading, urlSlug, municipalityBySlug]);

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
  const isDefaultFilters = !selectedMunicipalitySlug && mode === 'year'
    && (urlMonthRaw === '' || urlMonthRaw === 'all') && urlYearRaw === '';

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const selectMunicipality = (slug) => {
    const next = new URLSearchParams(searchParams.toString());
    if (slug) next.set(MUNICIPALITY_PARAM, slug);
    else next.delete(MUNICIPALITY_PARAM);
    next.delete(LEGACY_MUNICIPALITY_PARAM);
    setSearchParams(next);
    storeMunicipality(slug);
    /* WHAT: Keep the fallback in sync with the explicit choice.
       WHY: clearing the saved slug must clear the chip too; a stale mount-time
            value would otherwise restore the old municipality after "All". */
    setStoredSlug(slug);
  };

  const resetFilters = () => {
    storeMunicipality('');
    setStoredSlug('');
    setSearchParams({});
  };

  return {
    searchParams,
    setSearchParams,
    adminMonths,
    muniOptions,
    municipalityOptions,
    municipalityLoading: directoryLoading,
    selectedMunicipalitySlug,
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
    selectMunicipality,
    resetFilters,
  };
}

/* WHAT: Municipality / period filter bar (Year/Month o Start/End date range).
   WHY: dating nasa dashboard header; ngayon nasa itaas ng Municipality Analytics.
        Pareho pa rin ang IDs at URL params kaya walang binago sa backend. */
export default function DashboardFilters({
  className = '', loading = false, canSelectMunicipality = true,
}) {
  const {
    searchParams,
    setSearchParams,
    selectedMunicipalitySlug,
    selectedMuni,
    selMonth,
    selYear,
    yearOptions,
    adminMonths,
    municipalityOptions,
    municipalityLoading,
    periodHasData,
    isDefaultFilters,
    mode,
    rangeStart,
    rangeEnd,
    updateParam,
    selectMunicipality,
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
  const refreshing = loading || municipalityLoading;
  const municipalityLabel = selectedMuni || 'Pangasinan';

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
      <div className="dashboard-filter dashboard-filter--municipality">
        <label className="dashboard-filter__label" htmlFor="admin-muni">Municipality</label>
        <span
          className={`dashboard-muni-chip${refreshing ? ' is-loading' : ''}`}
          aria-busy={refreshing ? 'true' : undefined}
        >
          <MapPin size={14} strokeWidth={2} aria-hidden="true" />
          <span className="dashboard-muni-chip__label">{municipalityLabel}</span>
          {refreshing ? (
            <Loader2 size={14} className="muni-spin dashboard-muni-chip__spinner" aria-hidden="true" />
          ) : (
            <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className="dashboard-muni-chip__chevron" />
          )}
          {canSelectMunicipality ? (
            <select
              id="admin-muni"
              className="dashboard-muni-chip__select"
              aria-label="Municipality"
              value={selectedMunicipalitySlug}
              onChange={(e) => selectMunicipality(e.target.value)}
            >
              <option value="">All municipalities</option>
              {municipalityOptions.map((m) => (
                <option key={m.slug} value={m.slug}>{m.name}</option>
              ))}
            </select>
          ) : (
            <span className="visually-hidden">Municipality is fixed for encoder accounts.</span>
          )}
        </span>
      </div>

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
