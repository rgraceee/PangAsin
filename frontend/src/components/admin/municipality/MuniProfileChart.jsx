// WHAT: "Salt Farmers" profile - registered by municipality, age, gender behind pills.
import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { UserRound } from 'lucide-react';
import MuniCard, { MuniChip } from './MuniCard';
import MuniAgeChart from './MuniAgeChart';
import MuniRegisteredChart from './MuniRegisteredChart';
import { fmtInt, fmtPct } from './muniData';
import { GenderTooltip } from './muniTooltips';

const TABS = [
  { key: 'registered', label: 'Registered Salt Farmers' },
  { key: 'age', label: 'Age distribution' },
  { key: 'gender', label: 'Gender distribution' },
];

export default function MuniProfileChart({ profile, registeredRows, registeredTotal, selectedMuni }) {
  const [tab, setTab] = useState('registered');
  const { total, age, sex } = profile || { total: 0, age: [], sex: [] };
  const leader = tab === 'age'
    ? (age || []).reduce((b, a) => (a.value > b.value ? a : b), (age || [])[0])
    : (sex || []).reduce((b, s) => (s.value > b.value ? s : b), (sex || [])[0]);

  return (
    <MuniCard
      icon={UserRound}
      title="Salt Farmers"
      sub="Registered salt farmers by municipality, age, and gender"
      chips={(
        <>
          <MuniChip label={`${fmtInt(total)} salt farmers`} meta />
          <MuniChip label="Master list" meta />
        </>
      )}
    >
      <div className="muni-tabs" role="tablist" aria-label="Salt farmer profile view">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`muni-tab${tab === t.key ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'registered' ? (
        <MuniRegisteredChart rows={registeredRows || []} total={registeredTotal || 0} selectedMuni={selectedMuni} bare />
      ) : total === 0 ? (
        <div className="muni-empty">
          <span className="muni-empty-chip">No data</span>
          No salt farmer records for the selected municipalities.
        </div>
      ) : tab === 'age' ? (
        <MuniAgeChart age={age} />
      ) : (
        <div className="muni-method">
          <div className="muni-method-donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sex} cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={2} dataKey="value" nameKey="name" stroke="none">
                  {sex.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<GenderTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
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
      )}
      {tab === 'registered' && (
        <p className="muni-caption" style={{ marginTop: 8 }}>
          The master list holds the registered salt farmers. Production reports log the same people again each month, so they are not counted here.
        </p>
      )}
    </MuniCard>
  );
}