// WHAT: "Producer Profile" - the age and gender split of the master list,
//       behind a segmented tab.
// WHY: the old tabs were bootstrap buttons and the two tabs counted different
//      columns (68 age bands vs 10,577 male/female sums). Both now come from
//      the master list, and the sample size is stated in the header.
import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { UserRound } from 'lucide-react';
import MuniCard, { MuniChip } from './MuniCard';
import MuniAgeChart from './MuniAgeChart';
import { fmtInt, fmtPct } from './muniData';
import { GenderTooltip } from './muniTooltips';

const TABS = [
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
];

export default function MuniProfileChart({ profile }) {
  const [tab, setTab] = useState('age');
  const { total, age, sex } = profile;
  const leader = tab === 'age'
    ? age.reduce((b, a) => (a.value > b.value ? a : b), age[0])
    : sex.reduce((b, s) => (s.value > b.value ? s : b), sex[0]);

  return (
    <MuniCard
      icon={UserRound}
      title="Salt Farmer Profile"
      sub="Age and gender of the registered salt farmers"
      chips={(
        <>
          <MuniChip label={`${fmtInt(total)} salt farmers`} meta />
          <MuniChip label="Master list" meta />
        </>
      )}
      caption={leader
        ? `The ${tab === 'age' ? `${leader.name} age band` : leader.name.toLowerCase()} group is the largest, with ${fmtInt(leader.value)} salt farmers (${fmtPct(leader.pct)}).`
        : 'No salt farmer records for the selected municipalities.'}
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
            {t.label} distribution
          </button>
        ))}
      </div>

      {total === 0 ? (
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
                <Pie
                  data={sex}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  stroke="none"
                >
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
    </MuniCard>
  );
}
