// WHAT: The two master-list cards on the Encoder Dashboard — Gender
//       Distribution and Age Distribution.
// WHY: The Encoder page had no salt-farmer profile. These cards reuse the Admin
//      Salt Farmers components and selectors, so the design and the counting
//      rules are literally the same; only the scope changes (one municipality,
//      optionally one barangay). The master list has no period dimension, so the
//      Year/Month/Date Range filter does not apply — the caption says so.
import React, { useMemo } from 'react';
import { UserRound, Users } from 'lucide-react';
import MuniCard, { MuniChip } from '../admin/municipality/MuniCard';
import MuniAgeChart from '../admin/municipality/MuniAgeChart';
import MuniDonut from '../admin/municipality/MuniDonut';
import { buildProfile } from '../admin/municipality/municipalitySelectors';
import { fmtInt, fmtPct } from '../admin/municipality/municipalityData';
import { GenderTooltip } from '../admin/municipality/municipalityTooltips';
import { SkeletonChart } from '../Skeleton';

export default function EncoderProfileCharts({
  statistics,
  barangayName,
  loading = false,
  error = null,
}) {
  /* WHAT: One municipality-shaped row so the Admin selector can build the same
     profile it builds for the Admin Salt Farmers card.
     WHY: age bands, sex totals and percentages stay identical to Admin. */
  const profile = useMemo(() => buildProfile([{
    producers: statistics?.total || 0,
    age_bands: statistics?.age_bands || {},
    sex: {
      male: statistics?.male || 0,
      female: statistics?.female || 0,
      other: statistics?.other || 0,
    },
  }]), [statistics]);

  const { total, age, sex } = profile;
  const scopeLabel = barangayName || 'All barangays';
  const ageCovered = age.reduce((sum, row) => sum + row.value, 0);
  const missingAge = Math.max(total - ageCovered, 0);

  const chips = loading ? (
    <MuniChip label="Loading…" meta />
  ) : (
    <>
      <MuniChip label={`${fmtInt(total)} salt farmers`} meta />
      <MuniChip label={scopeLabel} meta />
    </>
  );

  const unavailable = error ? (
    <div className="muni-empty">
      <span className="muni-empty-chip">Unavailable</span>
      {error}
    </div>
  ) : null;

  return (
    <div className="encoder-charts d-grid gap-3">
      <MuniCard
        icon={UserRound}
        title="Gender Distribution"
        sub={`Each slice is a gender group\u2019s share of registered farmers in ${scopeLabel}.`}
        chips={chips}
      >
        {loading ? (
          <SkeletonChart height={250} />
        ) : unavailable || (
          total === 0 ? (
            <div className="muni-empty">
              <span className="muni-empty-chip">No data</span>
              No salt farmers are registered for this scope yet.
            </div>
          ) : (
            <div className="muni-method muni-method--wide">
              <MuniDonut
                rows={sex}
                total={total}
                unit=""
                label="Salt farmers"
                tooltip={<GenderTooltip />}
                chartKey="encoder-gender-distribution"
                ariaLabel={`Gender split of ${fmtInt(total)} registered salt farmers in ${scopeLabel}`}
              />
              <ul className="muni-legend" role="list">
                {sex.map((row) => (
                  <li key={row.key} className="muni-legend-item">
                    <span className="muni-legend-swatch" style={{ background: row.color }} />
                    <span className="muni-legend-name">{row.name}</span>
                    <span className="muni-legend-value">{fmtInt(row.value)}</span>
                    <span className="muni-legend-pct">{fmtPct(row.pct)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}

        <p className="muni-caption">
          Master list snapshot — not period-filtered. Counts distinct registered salt farmers in
          {' '}{scopeLabel}, so it differs from the dashboard KPI, which counts farmer-months from
          production reports.
        </p>
      </MuniCard>

      <MuniCard
        icon={Users}
        title="Age Distribution"
        sub={`Each bar counts how many registered farmers fall in that age band in ${scopeLabel}.`}
        chips={chips}
      >
        {loading ? (
          <SkeletonChart height={260} />
        ) : unavailable || (
          total === 0 ? (
            <div className="muni-empty">
              <span className="muni-empty-chip">No data</span>
              No salt farmers are registered for this scope yet.
            </div>
          ) : (
            <MuniAgeChart age={age} />
          )
        )}

        <p className="muni-caption">
          Master list snapshot — not period-filtered. Age bands cover farmers with a recorded age
          {missingAge > 0
            ? `; ${fmtInt(missingAge)} of ${fmtInt(total)} have no age on file and appear only in the total.`
            : '; every farmer on the master list has an age.'}
        </p>
      </MuniCard>
    </div>
  );
}
