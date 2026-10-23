// WHAT: Maikling introduksiyon tungkol sa ASIN at ang salt industry sa
//       Pangasinan — pang-unang bagay na nakikita sa public page.
// WHY: Ang bisitante ay nangangailangan ng konteksto bago ang mga numero:
//      sino ang ASIN Center, ano ang sinusukat, at saan galing ang datos.
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Factory, MapPin, Scale } from 'lucide-react';

/* WHAT: Format ng petsa para sa "Data as of" (halimbawa: "October 21, 2026").
   WHY: parehong hugis ng dating na "June 30, 2026" na ginagamit dati. */
const formatAsOf = (date) =>
  `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getDate()}, ${date.getFullYear()}`;

export default function PublicIntro({ municipalities = [] }) {
  // WHAT: Buod ng katotohanan mula sa live payload.
  // WHY: walang bagong request — kinukuha sa /api/public/dashboard na naka-load
  //      na ng GuestDashboard, kaya laging tugma sa mga chart sa ibaba.
  const facts = useMemo(() => {
    const beds = municipalities.reduce((sum, m) => sum + (Number(m.saltBeds) || 0), 0);
    // WHAT: Province's Total Production — sum of approved production across all
    //      municipalities. Each municipality already carries productionMT (metric
    //      tons), so no unit conversion is needed; we just sum the values.
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

  /* WHAT: "Data as of" ay ang KASALUKUYANG petsa, at live na nag-u-update.
     WHY: dati ay hard-coded ang petsa ("June 30, 2026") kaya laging luma ang
          label. Ginawa namin itong mula sa oras ng browser at sinisiksik ang
          bawat minuto (at sa focus / visibility change) para mag-roll over sa
          bagong araw kahit na naiwanang bukas ang page. */
  const [asOf, setAsOf] = useState(() => formatAsOf(new Date()));
  useEffect(() => {
    const refresh = () => setAsOf(formatAsOf(new Date()));
    const timer = window.setInterval(refresh, 60 * 1000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return (
    <section className="public-intro" aria-labelledby="public-intro-title">
      <div className="public-intro-copy">
        <div className="public-intro-eyebrow">Salt in Pangasinan</div>
        <h2 className="public-intro-title" id="public-intro-title">
          Salt production, tracked from the salt bed to the national market.
        </h2>
        <p className="public-intro-body">
          The coastal municipalities of Pangasinan produce salt through solar evaporation and cooked
          salt works, feeding household, food-processing, industrial and agricultural demand across the
          country. The Accelerating Salt Research and Innovation (ASIN) Center at Pangasinan State
          University records, validates and publishes that production so planners, producers and the
          public work from the same numbers.
        </p>
      </div>

      <ul className="public-intro-facts">
        {/* Row 1, left: Province's Total Production */}
        <li className="public-fact">
          <span className="public-fact-icon public-fact-icon--green">
            <Scale size={16} strokeWidth={1.75} />
          </span>
          <span className="public-fact-label">Province's Total Production</span>
          <span className="public-fact-value">
            {facts.totalProduction.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span className="public-fact-value__unit">{' MT'}</span>
          </span>
        </li>
        {/* Row 1, right: Salt Beds in Operation */}
        <li className="public-fact">
          <span className="public-fact-icon public-fact-icon--green">
            <Factory size={16} strokeWidth={1.75} />
          </span>
          <span className="public-fact-label">Salt beds in operation</span>
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
