// WHAT: Maikling introduksiyon tungkol sa ASIN at ang salt industry sa
//       Pangasinan — pang-unang bagay na nakikita sa public page.
// WHY: Ang bisitante ay nangangailangan ng konteksto bago ang mga numero:
//      sino ang ASIN Center, ano ang sinusukat, at saan galing ang datos.
import React, { useMemo, useState } from 'react';
import { CalendarClock, Factory, MapPin, Scale } from 'lucide-react';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* WHAT: "2026-09-30" -> "30 Sep 2026" (the public date format).
   WHY: Parse the date parts directly so the label never shifts by a day
        because of the browser's timezone. */
function formatRecordDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return 'No data yet';
  const [, year, month, day] = match;
  const monthName = MONTHS_SHORT[Number(month) - 1];
  return monthName ? `${Number(day)} ${monthName} ${year}` : 'No data yet';
}

/* WHAT: Date/timestamp -> "28 Oct 2026, 12:38 PM" in Asia/Manila.
   WHY: The page must show Philippine local time without depending on the
        visitor's device timezone. */
function formatUpdatedAt(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = get('dayPeriod');
  if (!day || !month || !year || !hour || !minute || !dayPeriod) return null;
  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

export default function PublicIntro({ municipalities = [], production = {} }) {
  // WHAT: Oras ng pagbisita sa page (Asia/Manila ang display).
  // WHY: ang "Last updated" ay ang kasalukuyang oras sa browser — hindi
  //      tumatakbo (walang ticking clock); isang beses lang sa page load.
  const [visitedAt] = useState(() => new Date());

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

  const asOfLabel = formatRecordDate(production.latestRecordDate);
  const updatedLabel = formatUpdatedAt(visitedAt);

  return (
    <section className="public-intro" aria-labelledby="public-intro-title">
      <div className="public-intro-copy">
        <div className="public-intro-eyebrow">Salt in Pangasinan</div>
        <h2 className="public-intro-title" id="public-intro-title">
          Why Salt Matters for Pangasinan
        </h2>
        <p className="public-intro-body">
          Salt is essential to food production, industry, aquaculture, and agriculture. In the
          Philippines, salt-making is both an economic activity and a cultural tradition, especially in
          coastal provinces like Pangasinan. Although Pangasinan is among the country&rsquo;s leading
          producers, local supply still falls short of national demand. Salt is made by evaporating
          seawater, either through solar evaporation or by cooking brine, and the methods used vary from
          one coastal community to another.
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
            <span className="public-fact-value__unit">{' Metric Tons (MT)'}</span>
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
          <span className="public-fact-value public-fact-value--text">{asOfLabel}</span>
          {asOfLabel !== 'No data yet' && (
            <span className="public-fact-updated">
              {updatedLabel ? `Last updated ${updatedLabel}` : 'No data yet'}
            </span>
          )}
        </li>
      </ul>
    </section>
  );
}
