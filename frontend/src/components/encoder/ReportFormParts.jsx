import React from 'react';
import { AlertCircle, Lock, Check, Pencil } from 'lucide-react';

// WHAT: Shared field wrapper (label + required dot + hint/error + unit/lock suffix).
// WHY: Pareho ang label, spacing, at unit treatment sa lahat ng forms; hindi na
//      kailangang isulat ang "(MT)"/"(m²)" sa label. Isa lamang ang field
//      implementation para sa lahat ng report forms.
export function ReportField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  errorId,
  unit,
  readOnly = false,
  className = '',
  children,
}) {
  return (
    <div className={`ui-field${className ? ` ${className}` : ''}`}>
      {label ? (
        <label className="ui-field__label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ui-field__req" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      <div className={`ui-field__control${unit ? ' has-unit' : ''}${readOnly ? ' is-readonly' : ''}`}>
        {children}
        {unit ? <span className="ui-field__unit" aria-hidden="true">{unit}</span> : null}
        {readOnly ? <span className="ui-field__lock" aria-hidden="true"><Lock size={13} /></span> : null}
      </div>
      {error ? (
        <div className="ui-field__error" id={errorId} role="alert">
          <AlertCircle size={13} aria-hidden="true" />{error}
        </div>
      ) : hint ? (
        <div className="ui-field__hint">{hint}</div>
      ) : null}
    </div>
  );
}

// WHAT: Plain section (14px primary title + 1px divider) na grupo ng fields.
// WHY: Alisin ang inner card na may blue top stripe; flat sections lang.
export function ReportSection({ title, children, className = '' }) {
  return (
    <section className={`ui-section${className ? ` ${className}` : ''}`}>
      {title ? <h3 className="ui-section__title">{title}</h3> : null}
      <div className="ui-section__body">{children}</div>
    </section>
  );
}

// WHAT: Slim flat stepper (24px numbered circles + 2px line) na shared ng tatlong forms.
// WHY: Isang markup lang para pantay ang hitsura; done/current/upcoming states lang.
export function ReportStepper({ steps, current }) {
  return (
    <ol className="ui-stepper">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming';
        return (
          <li
            key={step.key || step.label || index}
            className={`ui-stepper__item ui-stepper__item--${state}`}
            aria-current={index === current ? 'step' : undefined}
          >
            <span className="ui-stepper__dot" aria-hidden="true">
              {state === 'done' ? <Check size={14} strokeWidth={3} /> : index + 1}
            </span>
            <span className="ui-stepper__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// WHAT: Review-step summary bilang two-column definition list, naka-grupo per section.
// WHY: Malinaw ang label/value at may "Edit" link na bumabalik sa step.
export function ReportSummary({ sections }) {
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
