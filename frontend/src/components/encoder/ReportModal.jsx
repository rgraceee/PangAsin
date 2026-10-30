import React, { useId } from 'react';
import { Modal } from 'react-bootstrap';
import { X } from 'lucide-react';
import { confirmAction } from '../../services/feedback';
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

  const requestClose = async () => {
    if (busy) return;
    // WHAT: Mag-confirm muna kung may unsaved input bago isara.
    // WHY: Hindi aksidenteng mawawala ang tinype ng encoder (Escape o X).
    if (dirty) {
      const discard = await confirmAction({
        title: 'Discard your unsaved changes?',
        text: 'Closing this form will lose everything you have typed so far.',
        confirmText: 'Discard changes',
        cancelText: 'Keep editing',
        danger: true,
        icon: 'warning',
      });
      if (!discard) return;
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
