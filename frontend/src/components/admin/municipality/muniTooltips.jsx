// WHAT: The hover tooltips for the Municipality Analytics charts.
// WHY: one white-card tooltip style for every panel in the section.

import { fmtInt, fmtPct } from './muniData';

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
        <span>Production</span><b>{fmtInt(d.value)} Metric Tons (MT)</b>
      </div>
      <div className="muni-tooltip-row">
        <span>Share</span><b>{fmtPct(d.pct)}</b>
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
