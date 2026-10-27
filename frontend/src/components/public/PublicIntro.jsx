// WHAT: Maikling introduksiyon tungkol sa ASIN at ang salt industry sa
//       Pangasinan — pang-unang bagay na nakikita sa public page.
// WHY: Ang bisitante ay nangangailangan ng konteksto bago ang mga numero:
//      sino ang ASIN Center, ano ang sinusukat, at saan galing ang datos.
import React, { useMemo } from 'react';
import { CalendarClock, Factory, MapPin, Scale } from 'lucide-react';

/* WHAT: Format ng petsa para sa "Data as of" (halimbawa: "October 21, 2026").
   WHY: parehong hugis ng dating na "June 30, 2026" na ginagamit dati. */
export default function PublicIntro({ municipalities = [], production = {} }) {
  // WHAT: Buod ng katotohanan mula sa live payload.
  // WHY: walang bagong request — kinukuha sa /api/public/dashboard na naka-load
  //      na ng GuestDashboard, kaya laging tugma sa mga chart sa ibaba.
  const facts = useMemo(() => {
    const beds = municipalities.reduce((sum, m) => sum + (Number(m.saltBeds) || 0), 0);
    // Each municipality carries its total in metric tons for this source dataset.
    const totalProduction = municipalities.reduce(
      (sum, m) => sum + (Number(m.productionMT) || 0),
      0,
    );
    return {
      producing: municipalities.length,
      beds,
      totalProduction,
    };
  }, [municipalities]);

  const latestPeriod = (production.records || []).reduce((latest, row) => {
    const period = Number(row.year) * 12 + Number(row.month);
    return Number.isFinite(period) && (!latest || period > latest.period)
      ? { period, year: Number(row.year), month: Number(row.month) }
      : latest;
  }, null);
  const asOf = latestPeriod
    ? new Date(latestPeriod.year, latestPeriod.month - 1, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'No production data';

  return (
    <section className="public-intro" aria-labelledby="public-intro-title">
      <div className="public-intro-copy">
        <div className="public-intro-eyebrow">Salt in Pangasinan</div>
        <h2 className="public-intro-title" id="public-intro-title">
          Municipality-level salt production data for Pangasinan.
        </h2>
        <p className="public-intro-body">
          The coastal municipalities of Pangasinan produce salt through solar evaporation and cooked
          salt works, feeding household, food-processing, industrial and agricultural demand across the
          country. Municipality production figures use estimates from Adjusted_Estimates.xlsx.
          Approved barangay submissions remain separate operational records.
          Salt-bed figures include derived values; San Fabian is a cooked-salt bed-equivalent, not a
          physical bed count.
        </p>
      </div>

      <ul className="public-intro-facts">
        {/* Row 1, left: Province's Total Production */}
        <li className="public-fact">
          <span className="public-fact-icon public-fact-icon--green">
            <Scale size={16} strokeWidth={1.75} />
          </span>
          <span className="public-fact-label">Production data (latest 12 months)</span>
          <span className="public-fact-value">
            {facts.totalProduction.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span className="public-fact-value__unit">{' MT'}</span>
          </span>
        </li>
        {/* Row 1, right: salt-bed data */}
        <li className="public-fact">
          <span className="public-fact-icon public-fact-icon--green">
            <Factory size={16} strokeWidth={1.75} />
          </span>
          <span className="public-fact-label">Salt-bed data (2025)</span>
          <span className="public-fact-value">{facts.beds.toLocaleString()}</span>
        </li>
        {/* Row 2, left: Salt-Producing Municipalities */}
        <li className="public-fact">
          <span className="public-fact-icon public-fact-icon--ocean">
            <MapPin size={16} strokeWidth={1.75} />
          </span>
          <span className="public-fact-label">Salt-producing municipalities</span>
          <span className="public-fact-value">{facts.producing}</span>
        </li>
        {/* Row 2, right: Data as of */}
        <li className="public-fact">
          <span className="public-fact-icon public-fact-icon--navy">
            <CalendarClock size={16} strokeWidth={1.75} />
          </span>
          <span className="public-fact-label">Data as of</span>
          <span className="public-fact-value public-fact-value--text">{asOf}</span>
        </li>
      </ul>
    </section>
  );
}
