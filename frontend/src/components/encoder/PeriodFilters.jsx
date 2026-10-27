import React, { useEffect, useMemo, useState } from 'react';

/* WHAT: Shared period-filter state at markup para sa mga encoder page.
   WHY: pareho ang Dashboard at Production Records — Year/Month o Date Range
        plus All / 6 Months / 12 Months presets. Isang lugar lang ang logic. */

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isoDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function monthRange(year, month) {
  return {
    start: isoDate(year, month, 1),
    end: isoDate(year, month, daysInMonth(year, month)),
  };
}

export function presetRange(months) {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
  return {
    start: isoDate(start.getFullYear(), start.getMonth() + 1, 1),
    end: isoDate(end.getFullYear(), end.getMonth() + 1, end.getDate()),
  };
}

export function usePeriodFilters(months = []) {
  const now = new Date();
  const initialYear = now.getFullYear();
  const [filterMode, setFilterMode] = useState('range');
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(pad2(now.getMonth() + 1));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState('all');
  const [range, setRange] = useState({ start: null, end: null });

  const availableYears = useMemo(() => {
    const years = new Set([initialYear]);
    (months || []).forEach((m) => {
      const y = m.split('-')[0];
      if (y) years.add(Number(y));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [months, initialYear]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0] || initialYear);
    }
  }, [availableYears, selectedYear, initialYear]);

  const rangeError = filterMode === 'range' && startDate && endDate && startDate > endDate
    ? 'Start date must be on or before end date.'
    : null;

  useEffect(() => {
    if (activePreset === 'all') {
      setRange({ start: null, end: null });
      return;
    }
    if (filterMode === 'range') {
      if (startDate && endDate && startDate > endDate) return;
      setRange({ start: startDate || null, end: endDate || null });
      return;
    }
    if (selectedMonth === 'all') {
      setRange({ start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` });
      return;
    }
    setRange(monthRange(selectedYear, Number(selectedMonth)));
  }, [activePreset, filterMode, startDate, endDate, selectedMonth, selectedYear]);

  const handleYearChange = (value) => {
    const year = Number(value);
    setActivePreset('');
    setSelectedYear(year);
    const monthsForYear = (months || [])
      .filter((month) => month.startsWith(`${year}-`))
      .sort();
    if (
      selectedMonth !== 'all'
      && monthsForYear.length
      && !monthsForYear.includes(`${year}-${selectedMonth}`)
    ) {
      setSelectedMonth(monthsForYear[monthsForYear.length - 1].slice(5, 7));
    }
  };

  const applyPreset = (key) => {
    setActivePreset(key);
    setFilterMode('range');
    if (key === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const next = presetRange(key === '6m' ? 6 : 12);
    setStartDate(next.start);
    setEndDate(next.end);
  };

  /* WHAT: Balik sa "All" period. WHY: kasama sa Clear filters ng records pages. */
  const resetPeriod = () => {
    setActivePreset('all');
    setFilterMode('range');
    setStartDate('');
    setEndDate('');
  };

  return {
    filterMode,
    setFilterMode,
    selectedYear,
    selectedMonth,
    setSelectedMonth,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    activePreset,
    setActivePreset,
    range,
    rangeError,
    availableYears,
    handleYearChange,
    applyPreset,
    resetPeriod,
  };
}

export default function PeriodFilters({ filters, idPrefix = 'encoder', showPresets = true }) {
  const {
    filterMode,
    setFilterMode,
    selectedYear,
    selectedMonth,
    setSelectedMonth,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    activePreset,
    setActivePreset,
    availableYears,
    handleYearChange,
    applyPreset,
  } = filters;

  return (
    <>
      {/* WHAT: Period filters. WHY: Year mode or an exact date range, plus
          quick presets that keep both modes in sync. */}
      <label className="admin-page-hero-control" htmlFor={`${idPrefix}-filter-mode`}>
        <span className="admin-page-hero-field">Filter by</span>
        <select
          id={`${idPrefix}-filter-mode`}
          className="admin-page-hero-select"
          value={filterMode}
          onChange={(e) => {
            setActivePreset('');
            setFilterMode(e.target.value);
          }}
        >
          <option value="year">Year</option>
          <option value="range">Date Range</option>
        </select>
      </label>

      {filterMode === 'year' ? (
        <>
          <label className="admin-page-hero-control" htmlFor={`${idPrefix}-year`}>
            <span className="admin-page-hero-field">Year</span>
            <select
              id={`${idPrefix}-year`}
              className="admin-page-hero-select"
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="admin-page-hero-control" htmlFor={`${idPrefix}-month`}>
            <span className="admin-page-hero-field">Month</span>
            <select
              id={`${idPrefix}-month`}
              className="admin-page-hero-select"
              value={selectedMonth}
              onChange={(e) => {
                setActivePreset('');
                setSelectedMonth(e.target.value);
              }}
            >
              <option value="all">All Months</option>
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={pad2(index + 1)}>
                  {new Date(2000, index, 1).toLocaleDateString(undefined, { month: 'long' })}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="admin-page-hero-control" htmlFor={`${idPrefix}-start-date`}>
            <span className="admin-page-hero-field">Start Date</span>
            <input
              id={`${idPrefix}-start-date`}
              type="date"
              className="admin-page-hero-input"
              value={startDate}
              onChange={(e) => {
                setActivePreset('');
                setStartDate(e.target.value);
              }}
            />
          </label>
          <label className="admin-page-hero-control" htmlFor={`${idPrefix}-end-date`}>
            <span className="admin-page-hero-field">End Date</span>
            <input
              id={`${idPrefix}-end-date`}
              type="date"
              className="admin-page-hero-input"
              value={endDate}
              onChange={(e) => {
                setActivePreset('');
                setEndDate(e.target.value);
              }}
            />
          </label>
        </>
      )}

      {/* WHAT: Quick range presets. WHY: optional — Environment Records keeps
          only the Year/Month at Date Range controls. */}
      {showPresets && (
        <div className="admin-page-hero-control">
          <span className="admin-page-hero-field">Quick range</span>
          <div className="d-flex gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: '6m', label: '6 Months' },
              { key: '12m', label: '12 Months' },
            ].map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={activePreset === preset.key ? 'ui-btn-primary' : 'ui-btn-outline'}
                aria-pressed={activePreset === preset.key}
                onClick={() => applyPreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
