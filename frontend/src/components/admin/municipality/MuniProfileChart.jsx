// WHAT: "Salt Farmers" profile - registered by municipality, age, gender behind pills.
import { useState } from 'react';
import { UserRound } from 'lucide-react';
import MuniCard, { MuniChip } from './MuniCard';
import MuniAgeChart from './MuniAgeChart';
import MuniDonut from './MuniDonut';
import MuniRegisteredChart from './MuniRegisteredChart';
import { fmtInt, fmtPct } from './municipalityData';
import { GenderTooltip } from './municipalityTooltips';

const TABS = [
  { key: 'registered', label: 'Registered Salt Farmers' },
  { key: 'age', label: 'Age distribution' },
  { key: 'gender', label: 'Gender distribution' },
];

export default function MuniProfileChart({ profile, registeredRows, registeredTotal }) {
  const [tab, setTab] = useState('registered');
  const [tabChanged, setTabChanged] = useState(false);
  const { total, age, sex } = profile || { total: 0, age: [], sex: [] };

  /* WHAT: The intro animation belongs to the first card paint only.
     WHY: each tab mounts a fresh chart, so without this flag every tab switch
          would replay the 800ms intro and read as a page reload. */
  const animate = !tabChanged;
  const activeTab = TABS.find((t) => t.key === tab) || TABS[0];

  const chooseTab = (key) => {
    if (key !== tab) setTabChanged(true);
    setTab(key);
  };

  return (
    <MuniCard
      icon={UserRound}
      title="Salt Farmers"
      sub="Registered salt farmers by municipality, age, and gender"
      chips={(
        <>
          <MuniChip label={`${fmtInt(total)} salt farmers`} meta />
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
            onClick={() => chooseTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="muni-tab-panel" role="tabpanel" aria-label={activeTab.label}>
        {tab === 'registered' ? (
          <MuniRegisteredChart
            rows={registeredRows || []}
            total={registeredTotal || 0}
            bare
            animate={animate}
          />
        ) : total === 0 ? (
          <div className="muni-empty">
            <span className="muni-empty-chip">No data</span>
            No salt farmer records for the selected municipalities.
          </div>
        ) : tab === 'age' ? (
          <MuniAgeChart age={age} animate={animate} />
        ) : (
          <div className="muni-method muni-method--wide">
            <MuniDonut
              rows={sex}
              total={total}
              unit=""
              label="Salt farmers"
              tooltip={<GenderTooltip />}
              chartKey="gender-distribution"
              animate={animate}
              ariaLabel={`Gender split of ${fmtInt(total)} registered salt farmers`}
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
        )}
      </div>

      {tab === 'registered' && (
        <p className="muni-caption">
          The master list holds the registered salt farmers. Production reports log the same people again each month, so they are not counted here.
        </p>
      )}
    </MuniCard>
  );
}
