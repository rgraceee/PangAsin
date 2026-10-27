// WHAT: All the state and derived numbers for the Target Evaluation page.
// WHY: keeps the page component to layout only, and makes it obvious that
//      every number comes from the API response - nothing is calculated twice.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminMunicipalities, evaluateTarget } from '../../../services/dataService';
import { useToast } from '../../Toast';
import { buildYearTimeline, fmtMT } from './targetData';
import { addRequiredPace, buildSummary } from './targetSummaryData';
import { buildMunicipalityRows } from './targetMuniData';

export default function useTargetEvaluation() {
  const { toastSuccess, toastError } = useToast();
  const [municipalities, setMunicipalities] = useState([]);
  const [selectedMuni, setSelectedMuni] = useState('all');
  const [annualTarget, setAnnualTarget] = useState('');
  const [forecastHorizon, setForecastHorizon] = useState(12);
  const [splitMethod, setSplitMethod] = useState('seasonal');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminMunicipalities()
      .then((res) => setMunicipalities(res.municipalities || []))
      .catch(() => {});
  }, []);

  const runEvaluation = useCallback(() => {
    const target = Number(annualTarget);
    if (!target || target <= 0) return;
    setLoading(true);
    setError(null);
    evaluateTarget({
      municipality_id: selectedMuni !== 'all' ? Number(selectedMuni) : null,
      annual_target: target,
      forecast_horizon: forecastHorizon,
      split_method: splitMethod,
      target_basis: 'annual',
    })
      .then((res) => {
        setResults(res.evaluation);
        toastSuccess('Target compared with the forecast.', 'Evaluation complete');
      })
      .catch((err) => {
        const message = err.message || 'Could not run the evaluation.';
        setError(message);
        toastError(message);
      })
      .finally(() => setLoading(false));
  }, [annualTarget, selectedMuni, forecastHorizon, splitMethod, toastSuccess, toastError]);

  const timeline = useMemo(() => {
    if (!results) return [];
    return buildYearTimeline({
      evaluationYear: results.evaluation_year,
      ytdApproved: results.ytd_approved,
      forecastLabels: results.forecast_labels,
      monthlyForecasts: results.monthly_forecasts,
      forecastLower: results.forecast_lower,
      forecastUpper: results.forecast_upper,
      annualTarget: results.annual_target,
      seasonalWeights: results.seasonal_weights,
      splitMethod,
    });
  }, [results, splitMethod]);

  const paced = useMemo(
    () => (results ? addRequiredPace(timeline, results.annual_target) : []),
    [timeline, results],
  );

  const summary = useMemo(() => {
    if (!results) return null;
    return buildSummary({
      rows: paced,
      annualTarget: results.annual_target,
      target: results.annual_target,
      ytdTotal: results.ytd_approved_total,
    });
  }, [paced, results]);

  const muniRows = useMemo(
    () => buildMunicipalityRows(results?.municipality_breakdown || []),
    [results],
  );

  const partial = results && results.forecast_months_in_year < results.months_remaining_in_year
    ? { covered: results.forecast_months_in_year, remaining: results.months_remaining_in_year }
    : null;

  const noForecast = Boolean(results) && results.forecast_months_in_year === 0;

  const sanity = useMemo(() => {
    if (!summary || !summary.annualTarget || !summary.projected) return null;
    const ratio = summary.annualTarget / summary.projected;
    if (ratio > 2) return `Target is ${ratio.toFixed(1)}x the projected year-end`;
    if (ratio < 0.5) return `Target is only ${Math.round(ratio * 100)}% of the projected year-end`;
    return null;
  }, [summary]);

  const paceNote = useMemo(() => {
    const first = paced.find((r) => r.isForecast && r.requiredPace !== null && r.requiredPace !== undefined);
    if (!first) return null;
    const ratio = first.target > 0 ? first.requiredPace / first.target : 0;
    const base = `${fmtMT(first.requiredPace)} Metric Tons (MT) a month from ${first.label} onward`;
    return ratio > 3
      ? `${base} to still reach the annual target - ${ratio.toFixed(0)}x the monthly target, so the target is out of reach at this pace (markers shown at a capped scale).`
      : `${base} to still reach the annual target.`;
  }, [paced]);

  const scopeName = selectedMuni === 'all'
    ? 'All Municipalities'
    : (municipalities.find((m) => String(m.id) === String(selectedMuni))?.name || 'All Municipalities');

  return {
    municipalities, selectedMuni, setSelectedMuni,
    annualTarget, setAnnualTarget,
    forecastHorizon, setForecastHorizon,
    splitMethod, setSplitMethod,
    loading, results, error, runEvaluation,
    paced, summary, muniRows, partial, noForecast, sanity, paceNote, scopeName,
  };
}
