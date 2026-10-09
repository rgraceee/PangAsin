import React, { useId } from 'react';
import { Modal } from 'react-bootstrap';
import { X } from 'lucide-react';
import ReportStepper from './ReportStepper';

// WHAT: Shared shell ng tatlong encoder report forms (Production/Producer/Environment).
// WHY: Isang white modal + flat stepper + sticky footer para pantay ang hitsura at
//      hindi na kailangang kopyahin ang header/stepper/footer sa bawat form.
export default function ReportModal({
  show = true,
  title,
  municipality,
  steps = [],
  currentStep = 0,
  onClose,
  footer,
  dirty = false,
  busy = false,
  narrow = false,
  children,
}) {
  const headingId = useId();

  const requestClose = () => {
    if (busy) return;
    // WHAT: Mag-confirm muna kung may unsaved input bago isara.
    // WHY: Hindi aksidenteng mawawala ang tinype ng encoder (Escape o X).
    if (dirty && typeof window !== 'undefined'
      && !window.confirm('You have unsaved changes. Close this form anyway?')) {
      return;
    }
    onClose();
  };

  const subtitle = steps.length
    ? `${municipality || 'Your municipality'} · Step ${currentStep + 1} of ${steps.length}`
    : municipality;

  return (
    <Modal
      show={show}
      onHide={requestClose}
      centered
      backdrop="static"
      backdropClassName="ui-report-backdrop"
      dialogClassName={`ui-report-dialog${narrow ? ' ui-report-dialog--narrow' : ''}`}
      contentClassName="ui-report-content"
      className="ui-report-modal"
      aria-labelledby={headingId}
    >
      <div className="ui-report-head">
        <div className="ui-report-head__text">
          <h2 id={headingId} className="ui-report-head__title">{title}</h2>
          {subtitle ? <div className="ui-report-head__subtitle">{subtitle}</div> : null}
        </div>
        <button type="button" className="ui-report-close" onClick={requestClose} aria-label="Close form">
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      {steps.length ? (
        <div className="ui-report-stepper">
          <ReportStepper steps={steps} current={currentStep} />
        </div>
      ) : null}
      <div className="ui-report-body">{children}</div>
      <div className="ui-report-foot">{footer}</div>
    </Modal>
  );
}
