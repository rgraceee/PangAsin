import React from 'react';

// WHAT: Plain section (14px primary title + 1px divider) na grupo ng fields.
// WHY: Alisin ang inner card na may blue top stripe; flat sections lang.
export default function ReportSection({ title, children, className = '' }) {
  return (
    <section className={`ui-section${className ? ` ${className}` : ''}`}>
      {title ? <h3 className="ui-section__title">{title}</h3> : null}
      <div className="ui-section__body">{children}</div>
    </section>
  );
}
