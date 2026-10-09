import React from 'react';
import { Pencil } from 'lucide-react';

// WHAT: Review-step summary bilang two-column definition list, naka-grupo per section.
// WHY: Malinaw ang label/value at may "Edit" link na bumabalik sa step.
export default function ReportSummary({ sections }) {
  return (
    <div className="ui-summary">
      {sections.map((section, index) => (
        <div className="ui-summary__section" key={section.title || index}>
          <div className="ui-summary__head">
            {section.title ? <h3 className="ui-summary__title">{section.title}</h3> : null}
            {section.onEdit ? (
              <button type="button" className="ui-summary__edit" onClick={section.onEdit}>
                <Pencil size={13} aria-hidden="true" />Edit
              </button>
            ) : null}
          </div>
          <dl className="ui-summary__list">
            {(section.rows || []).map(([label, value], rowIndex) => (
              <div className="ui-summary__row" key={label || rowIndex}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
