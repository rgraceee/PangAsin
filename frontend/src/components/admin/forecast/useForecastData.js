// WHAT: Loads every dataset the Forecasting page needs and builds the
//       history + forecast timeline.
// WHY: one place owns the API calls, so the page can never mix scopes, and
//       the "latest forecast run" rule lives in a single function.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getMunicipalityOutlook, getAdminMunicipalities,
  getAdminTrends, getAdminDescriptive, getForecastRuns,
} from '../../../services/dataService';
import { buildHistoryRows, buildTimeline } from './forecastSelectors';

const WINDOW_MONTHS = { 6: 6, 12: 12, 24: 24, all: 120 };

export default function useForecastData({ recordedWindow, forecastHorizon, selectedMuni }) {
  const [municipalities, setMunicipalities] = useState([]);
  const [outlook, setOutlook] = useState([]);
  const [trends, setTrends] = useState({ municipalities: [], totals: null });
  const [descriptive, setDescriptive] = useState(null);
  const [runs, setRuns] = useState([]);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState(null);
  /* Bumped by reload() to re-run every fetch without touching the filters. */
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  /* WHAT: One token per request stream. WHY: the database is remote and a
     response can arrive after the admin already changed the filter. Only the
     newest request may write to state, but a slow answer for the CURRENT
     request must still be applied. */
  const token = useRef({ trends: 0, descriptive: 0, runs: 0 });

  // Scope-independent reference data.
  useEffect(() => {
    let alive = true;
    getAdminMunicipalities()
      .then((res) => { if (alive) setMunicipalities(res.municipalities || []); })
      .catch(() => { if (alive) setMunicipalities([]); });
    getMunicipalityOutlook()
      .then((res) => { if (alive) setOutlook(res.municipalities || []); })
      .catch(() => { if (alive) setOutlook([]); });
    return () => { alive = false; };
  }, [reloadKey]);

  // Year-over-year blocks use the same municipality production source as forecasts.
  useEffect(() => {
    const my = ++token.current.trends;
    getAdminTrends({ source: 'municipality_production' })
      .then((res) => { if (my === token.current.trends) setTrends(res || { municipalities: [], totals: null }); })
      .catch(() => { if (my === token.current.trends) setTrends({ municipalities: [], totals: null }); });
  }, [reloadKey]);

  // Production history for the current municipality and time window.
  useEffect(() => {
    const my = ++token.current.descriptive;
    const params = {
      months: WINDOW_MONTHS[recordedWindow] || 24,
      source: 'municipality_production',
    };
    if (selectedMuni !== 'all') params.municipality_id = Number(selectedMuni);
    getAdminDescriptive(params)
      .then((res) => { if (my === token.current.descriptive) setDescriptive(res); })
      .catch(() => { if (my === token.current.descriptive) setDescriptive(null); });
  }, [recordedWindow, selectedMuni, reloadKey]);

  // Forecast runs for the current scope - only the newest run is needed.
  useEffect(() => {
    const my = ++token.current.runs;
    setError(null);
    const params = selectedMuni === 'all'
      ? { scope: 'all', latest: 1 }
      : { municipality_id: Number(selectedMuni), latest: 1 };
    getForecastRuns(params)
      .then((res) => { if (my === token.current.runs) setRuns(res.runs || []); })
      .catch((err) => { if (my === token.current.runs) setError(err.message || 'Failed to load forecast runs.'); });
  }, [selectedMuni, reloadKey]);

  useEffect(() => {
    if (descriptive !== null) setBooting(false);
  }, [descriptive]);

  /* The latest run for the scope: the endpoint already orders by created_at
     descending, and this sorts again so the rule is explicit. */
  const selectedRun = useMemo(() => {
    if (!runs || runs.length === 0) return null;
    const sorted = [...runs].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return sorted[0] || null;
  }, [runs]);

  const forecastPoints = useMemo(() => {
    if (!selectedRun || !selectedRun.points) return [];
    const points = selectedRun.points
      .filter((p) => p.is_forecast)
      .sort((a, b) => String(a.period_label).localeCompare(String(b.period_label)));
    return points.slice(0, Number(forecastHorizon) || points.length);
  }, [selectedRun, forecastHorizon]);

  const forecastTotal = useMemo(() => {
    if (forecastPoints.length === 0) return null;
    return forecastPoints.reduce((sum, p) => sum + (Number(p.predicted_value) || 0), 0);
  }, [forecastPoints]);

  const historyRows = useMemo(
    () => buildHistoryRows(descriptive?.monthly_series, recordedWindow),
    [descriptive, recordedWindow],
  );

  const timeline = useMemo(
    () => buildTimeline(historyRows, forecastPoints),
    [historyRows, forecastPoints],
  );

  const recordedTotal = useMemo(() => {
    const values = historyRows.map((r) => r.historical).filter((v) => v !== null && v !== undefined);
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0);
  }, [historyRows]);

  return {
    municipalities, outlook, trends, descriptive, runs, selectedRun,
    forecastPoints, forecastTotal, historyRows, timeline, recordedTotal,
    booting, error, reload,
  };
}
