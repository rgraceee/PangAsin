import React from 'react';
import { Check } from 'lucide-react';

// WHAT: Slim flat stepper (24px numbered circles + 2px line) na shared ng tatlong forms.
// WHY: Isang markup lang para pantay ang hitsura; done/current/upcoming states lang.
export default function ReportStepper({ steps, current }) {
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
