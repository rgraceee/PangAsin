// WHAT: Report a problem form for the public Help Center.
// WHY: /help/report lets anyone report a data error, login issue, or bug
//      without logging in. Submitting opens a mailto to the ASIN Center.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, AlertTriangle } from 'lucide-react';

const CONTACT_EMAIL = 'pang.asin26@gmail.com';

const REPORT_TYPES = [
  { value: 'data-error', label: 'Data error' },
  { value: 'login-account', label: 'Login or account' },
  { value: 'bug-display', label: 'Bug or display issue' },
  { value: 'other', label: 'Other' },
];

export default function ReportForm() {
  const [form, setForm] = useState({
    type: '',
    municipality: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!form.type) newErrors.type = 'Please select a report type.';
    if (!form.description || form.description.trim().length < 10) {
      newErrors.description = 'Please describe the problem (at least 10 characters).';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const subject = encodeURIComponent(`[PangAsin] ${form.type}`);
    const body = encodeURIComponent(
      `Type: ${form.type}\n` +
      `Page/Municipality: ${form.municipality || '(not specified)'}\n` +
      `Description: ${form.description}\n`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  const copyMessage = () => {
    const text =
      `Type: ${form.type}\n` +
      `Page/Municipality: ${form.municipality || '(not specified)'}\n` +
      `Description: ${form.description}`;
    navigator.clipboard.writeText(text);
  };

  const messageBody =
    `Type: ${form.type}\n` +
    `Page/Municipality: ${form.municipality || '(not specified)'}\n` +
    `Description: ${form.description}`;

  return (
    <div className="report-form-page">
      <div className="report-header">
        <Link to="/help" className="report-back">
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          Back to Help Center
        </Link>
      </div>
      {submitted ? (
        <div className="report-card">
          <span className="report-eyebrow">Report submitted</span>
          <h1 className="report-title">Thank you</h1>
          <p className="report-sub">
            Your report has been prepared for sending. Your email app should open
            with the message pre-filled. If it doesn&apos;t, copy the message below and
            paste it into your email.
          </p>
          <div className="report-message-box">
            <p className="report-message-label">Message:</p>
            <textarea
              readOnly
              className="report-message-text"
              defaultValue={messageBody}
            />
          </div>
          <div className="report-actions">
            <button
              type="button"
              className="report-copy-btn"
              onClick={copyMessage}
            >
              <Mail size={14} strokeWidth={2} aria-hidden="true" />
              Copy message
            </button>
          </div>
        </div>
      ) : (
        <div className="report-card">
          <span className="report-eyebrow">Report a problem</span>
          <h1 className="report-title">Report a Problem</h1>
          <p className="report-sub">
            Tell us about a data error, login issue, or bug. We will get back to you
            as soon as possible.
          </p>
          <form onSubmit={handleSubmit} className="report-form">
            <div className="report-field">
              <label className="report-field-label">Report type <span className="required">*</span></label>
              <select
                name="type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="report-select"
              >
                <option value="">Select a type</option>
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {errors.type && <span className="report-field-error">{errors.type}</span>}
            </div>
            <div className="report-field">
              <label className="report-field-label">Page / municipality (optional)</label>
              <input
                name="municipality"
                value={form.municipality}
                onChange={(e) => setForm({ ...form, municipality: e.target.value })}
                className="report-input"
                placeholder="e.g. Production Records, Alaminos City"
              />
            </div>
            <div className="report-field">
              <label className="report-field-label">Description <span className="required">*</span></label>
              <textarea
                name="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="report-textarea"
                minLength={10}
                placeholder="Describe the problem in detail. Include steps to reproduce, screenshots if available, and your municipality."
              />
              {errors.description && <span className="report-field-error">{errors.description}</span>}
            </div>
            <div className="report-readonly">
              <label className="report-field-label">Your details (read-only)</label>
              <div className="report-readonly-row">
                <span className="report-readonly-label">Name:</span>
                <span className="report-readonly-value">Not signed in</span>
              </div>
              <div className="report-readonly-row">
                <span className="report-readonly-label">Email:</span>
                <span className="report-readonly-value">Not signed in</span>
              </div>
              <div className="report-readonly-row">
                <span className="report-readonly-label">Role:</span>
                <span className="report-readonly-value">Public</span>
              </div>
            </div>
            <button
              type="submit"
              className="report-submit-btn"
              disabled={!form.type || !form.description || form.description.trim().length < 10}
            >
              <Mail size={14} strokeWidth={2} aria-hidden="true" />
              Send report by email
            </button>
              <p className="report-hint">
              <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />
              This opens your default email app with the report pre-filled. If your
              browser doesn&apos;t support mailto, use &quot;Copy message&quot; and paste into your
              email.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
