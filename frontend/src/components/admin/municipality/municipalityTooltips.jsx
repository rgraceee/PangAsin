// WHAT: The hover tooltips for the Municipality Analytics charts.
// WHY: one white-card tooltip style for every panel in the section.

import { fmtInt, fmtMT, fmtPct } from './municipalityData';

function formatMom(mom) {
  if (mom === null || mom === undefined) return 'N/A';
  const n = Number(mom);
  if (!Number.isFinite(n)) return 'N/A';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}

/* WHAT: Hover card for the monthly trend line.
   WHY: the month, its MT value and the change against the previous month in
        view are read in one place. The first point, and any point after a zero
        month, has no meaningful percentage and says N/A instead of NaN. */
export function TrendTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload || {};
  return (
    <div className="muni-tooltip">
      <div className="muni-tooltip-label">{d.label || d.month || '—'}</div>
      <div className="muni-tooltip-row">
        <span>Production</span><b>{fmtMT(d.value, 1)} MT</b>
      </div>
      <div className="muni-tooltip-row muni-tooltip-row--secondary">
        <span>vs previous month</span><b>{formatMom(d.mom)}</b>
      </div>
      <div className="muni-tooltip-source">Municipality production dataset.</div>
    </div>
  );
}

export function ProductionTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload || {};
  return (
    <div className="muni-tooltip">
      <div className="muni-tooltip-label">{d.name || '—'}</div>
      <div className="muni-tooltip-row">
        <span>Production</span><b>{fmtMT(d.volumeMT, 1)} MT</b>
      </div>
      <div className="muni-tooltip-row">
        <span>Share of total</span><b>{fmtPct(d.share)}</b>
      </div>
      <div className="muni-tooltip-source">Municipality production dataset.</div>
    </div>
  );
}

export function BarTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="muni-tooltip">
      <div className="muni-tooltip-label">{d.name}</div>
      <div className="muni-tooltip-row">
        <span>Salt Farmers</span><b>{fmtInt(d.count)}</b>
      </div>
      <div className="muni-tooltip-row">
        <span>Share of scope</span><b>{fmtPct(d.share)}</b>
      </div>
      <div className="muni-tooltip-source">Master list of registered salt farmers.</div>
    </div>
  );
}

export function MethodTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="muni-tooltip">
      <div className="muni-tooltip-label">{d.name}</div>
      <div className="muni-tooltip-row">
        <span>Production</span><b>{fmtMT(d.value, 1)} MT</b>
      </div>
      <div className="muni-tooltip-row">
        <span>Share of total</span><b>{fmtPct(d.pct)}</b>
      </div>
      <div className="muni-tooltip-source">Approved production records, all time.</div>
    </div>
  );
}

export function AgeTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="muni-tooltip">
      <div className="muni-tooltip-label">Age {d.name}</div>
      <div className="muni-tooltip-row">
        <span>Salt Farmers</span><b>{fmtInt(d.value)}</b>
      </div>
      <div className="muni-tooltip-row">
        <span>Share</span><b>{fmtPct(d.pct)}</b>
      </div>
      <div className="muni-tooltip-source">Master list of registered salt farmers.</div>
    </div>
  );
}

export function GenderTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="muni-tooltip">
      <div className="muni-tooltip-label">{d.name}</div>
      <div className="muni-tooltip-row">
        <span>Salt Farmers</span><b>{fmtInt(d.value)}</b>
      </div>
      <div className="muni-tooltip-row">
        <span>Share</span><b>{fmtPct(d.pct)}</b>
      </div>
      <div className="muni-tooltip-source">Master list of registered salt farmers.</div>
    </div>
  );
}
