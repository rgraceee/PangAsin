// WHAT: The Target Evaluation page - "will we reach this target, and if not,
//       where do we fall short?"
// WHY: one clear answer first (the summary strip), then the charts, then who
//      has to carry it.
import { Alert, Card } from 'react-bootstrap';
import { Lightbulb } from 'lucide-react';
import PageHeader from '../PageHeader';
import { SkeletonBlock, SkeletonChart } from '../../Skeleton';
import TargetForm from './TargetForm';
import TargetSummary from './TargetSummary';
import TargetPaceChart from './TargetPaceChart';
import TargetMonthlyChart from './TargetMonthlyChart';
import TargetMunicipalityChart from './TargetMunicipalityChart';
import useTargetEvaluation from './useTargetEvaluation';

export default function TargetEvaluation() {
  const t = useTargetEvaluation();
  const evaluationYear = t.results?.evaluation_year || new Date().getFullYear();

  return (
    <div className="admin-single-page te-page">
      <PageHeader
        id="admin-target-header"
        variant="clean"
        className="ui-pageheader--admin ui-pageheader--no-map"
        title="Target Evaluation"
        subtitle={`Will ${t.scopeName} reach its annual target, and where does it fall short? Evaluation year ${evaluationYear}.`}
      >
        <TargetForm
          selectedMuni={t.selectedMuni}
          onSelectedMuni={t.setSelectedMuni}
          municipalities={t.municipalities}
          annualTarget={t.annualTarget}
          onAnnualTarget={t.setAnnualTarget}
          forecastHorizon={t.forecastHorizon}
          onForecastHorizon={t.setForecastHorizon}
          splitMethod={t.splitMethod}
          onSplitMethod={t.setSplitMethod}
          onSubmit={t.runEvaluation}
          loading={t.loading}
        />
      </PageHeader>

      {t.error && <Alert variant="danger" className="mb-3">{t.error}</Alert>}

      {t.loading && (
        <Card className="te-card mb-3">
          <Card.Body>
            <SkeletonBlock className="mb-2" width="45%" height={12} />
            <SkeletonChart height={320} />
          </Card.Body>
        </Card>
      )}

      {t.results && !t.loading && !t.noForecast && t.summary && (
        <>
          <TargetSummary
            summary={t.summary}
            evaluationYear={t.results.evaluation_year}
            partial={t.partial}
            sanity={t.sanity}
          />

          <TargetPaceChart
            rows={t.paced}
            annualTarget={t.results.annual_target}
            reachedMonth={t.summary.reachedMonth}
            yearEndGap={t.summary.gap}
          />

          <div className="te-gap" />

          <TargetMonthlyChart rows={t.paced} paceNote={t.paceNote} />

          {t.selectedMuni === 'all' && (
            <>
              <div className="te-gap" />
              <TargetMunicipalityChart rows={t.muniRows} />
            </>
          )}
        </>
      )}

      {t.noForecast && !t.loading && (
        <Card className="te-card">
          <Card.Body className="te-empty">
            <span className="te-empty-chip">No forecast</span>
            <h5 className="te-empty-title">No forecast for {t.scopeName}</h5>
            <p className="te-empty-text">
              There is no forecast run for this scope, so the target cannot be compared yet. Run a forecast for it on
              the Forecasting page, then come back here.
            </p>
          </Card.Body>
        </Card>
      )}

      {!t.results && !t.loading && !t.error && (
        <Card className="te-card">
          <Card.Body className="te-empty">
            <span className="te-empty-icon"><Lightbulb size={26} strokeWidth={1.5} /></span>
            <h5 className="te-empty-title">Set a target to see if it is reachable</h5>
            <p className="te-empty-text">
              Choose a municipality, type the annual production target in metric tons and pick a forecast horizon.
              You will get the projected year-end, the gap to target, the month-by-month pace and - for the whole
              province - which municipalities have to carry it. Nothing is saved; you can re-run it as often as you like.
            </p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
