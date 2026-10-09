import React from 'react';
import { AlertCircle, Lock } from 'lucide-react';

// WHAT: Shared field wrapper (label + required dot + hint/error + unit/lock suffix).
// WHY: Pareho ang label, spacing, at unit treatment sa lahat ng forms; hindi na
//      kailangang isulat ang "(MT)"/"(m²)" sa label.
export default function ReportField({
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
