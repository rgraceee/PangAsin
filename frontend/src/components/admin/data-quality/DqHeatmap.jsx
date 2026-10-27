// WHAT: "Reporting by month" - a CSS grid heatmap of every municipality against
//       every month in the chosen window.
// WHY: The old grid wrapped each municipality in a row element, so the rows
//      collapsed into a thin strip. A flat CSS grid keeps every cell the same
//      size, and the four cell states (reported / waiting / missing / in
//      progress) are told apart by fill AND by pattern, not by colour alone.
import React, { useMemo } from 'react';
import { monthShortLabel, formatMonth, cellTitle, statusWord } from './dqData';

function yearGroups(months) {
  const groups = [];
  let current = null;
  months.forEach((month, index) => {
    const year = month.slice(0, 4);
    if (year !== current) {
      if (current !== null) groups[groups.length - 1].end = index - 1;
      groups.push({ year, start: index, end: index });
      current = year;
    } else {
      groups[groups.length - 1].end = index;
    }
  });
  return groups;
}

export default function DqHeatmap({ data, selectedId, onSelect }) {
  const { months = [], municipalities = [] } = data;
  const groups = useMemo(() => yearGroups(months), [months]);
  const sumColumn = months.length + 2;
  const scoreColumn = months.length + 3;

  return (
    <div className="dq-heat-scroll" tabIndex={0} aria-label="Reporting by month, scroll sideways for more months">
      <div
        className="dq-heat-grid"
        style={{ '--dq-cols': months.length }}
        role="presentation"
      >
        <div className="dq-heat-corner" aria-hidden="true" />
        {groups.map((group) => (
          <div
            key={group.year}
            className="dq-heat-year"
            style={{ gridColumn: `${group.start + 2} / span ${group.end - group.start + 1}` }}
          >
            {group.year}
          </div>
        ))}
        <div
          className="dq-heat-sum-head"
          style={{ gridColumn: sumColumn, gridRow: '1 / span 2' }}
        >
          Reported %
        </div>
        <div
          className="dq-heat-sum-head"
          style={{ gridColumn: scoreColumn, gridRow: '1 / span 2' }}
        >
          Score
        </div>
        {months.map((month, index) => (
          <div
            key={month}
            className="dq-heat-month"
            style={{ gridColumn: `${index + 2}`, gridRow: 2 }}
            title={formatMonth(month)}
          >
            {monthShortLabel(month)}
          </div>
        ))}

        {municipalities.map((municipality) => (
          <React.Fragment key={municipality.id}>
            <button
              type="button"
              className={`dq-heat-name${selectedId === municipality.id ? ' is-selected' : ''}`}
              onClick={() => onSelect(municipality.id)}
              aria-pressed={selectedId === municipality.id}
              title={`${municipality.name} - ${statusWord(municipality.status)}. Select to see this municipality's field completeness.`}
            >
              <span className={`dq-dot dq-dot--${municipality.status}`} aria-hidden="true" />
              {municipality.name}
            </button>
            {months.map((month) => {
              const state = municipality.cells[month] || 'missing';
              const label = cellTitle(municipality.name, month, state);
              return (
                <div
                  key={month}
                  className={`dq-heat-cell dq-heat-cell--${state}`}
                  role="img"
                  aria-label={label}
                  title={label}
                />
              );
            })}
            <div className="dq-heat-sum" title={`${municipality.name}: ${municipality.reported_months} of ${municipality.expected_months} months reported`}>
              {municipality.reporting_pct}%
            </div>
            <div
              className={`dq-heat-score dq-heat-score--${municipality.status}`}
              title={`${municipality.name}: score ${municipality.score} - ${statusWord(municipality.status)}`}
            >
              {municipality.score}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
