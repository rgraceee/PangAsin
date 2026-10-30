import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Download, Mail } from 'lucide-react';

const CONTACT_EMAIL = 'pang.asin26@gmail.com';

function PrintButton() {
  return (
    <div className="support-actions">
      <button type="button" className="ui-btn-primary ui-btn--sm" onClick={() => window.print()}>
        <Download size={15} strokeWidth={2} aria-hidden="true" />
        Download as PDF
      </button>
    </div>
  );
}

function EncoderSteps() {
  return (
    <>
      <h3>Sign in and open your dashboard</h3>
      <ol className="support-steps">
        <li>Open the PangAsin sign-in page and enter the email and password given by your administrator.</li>
        <li>After signing in, the Dashboard shows your municipality and its current production summary.</li>
        <li>Use the sidebar to open Production Records, Salt Farmer Master List, or Environment Records.</li>
        <li>If you were asked to change your password, set a new one before continuing.</li>
      </ol>

      <h3>File a production report</h3>
      <ol className="support-steps">
        <li>Open <strong>Production Records</strong> and choose <strong>New report</strong>.</li>
        <li>Pick the barangay and the production month covered by the report.</li>
        <li>Enter each salt bed’s production volume in metric tons and choose the production method.</li>
        <li>Select <strong>Continue</strong> to review your entries. The review step is your final check.</li>
        <li>Select <strong>Submit</strong>. The report goes to the validation queue and is marked pending.</li>
      </ol>

      <h3>Add salt farmers</h3>
      <ol className="support-steps">
        <li>Open <strong>Salt Farmer Master List</strong>.</li>
        <li>Select <strong>Add salt farmer</strong> and enter the name, age, sex, barangay, and address.</li>
        <li>Save the record. It appears in the list immediately.</li>
        <li>Use the search and filters to find a farmer before adding a duplicate.</li>
      </ol>

      <h3>File an environment report</h3>
      <ol className="support-steps">
        <li>Open <strong>Environment Records</strong> and choose <strong>New report</strong>.</li>
        <li>Enter the required readings and observations for the period.</li>
        <li>Review the summary, then select <strong>Submit Environment Report</strong>.</li>
      </ol>

      <h3>Fix a returned report</h3>
      <ol className="support-steps">
        <li>Open <strong>Production Records</strong> and find the report marked <strong>Rejected</strong>.</li>
        <li>Read the reviewer comment shown on the record.</li>
        <li>Correct the entries and submit the report again.</li>
      </ol>

      <div className="support-note">
        <strong>Troubleshooting.</strong> If a page will not load, refresh once and
        sign in again. If a report is rejected, read the reviewer comment before
        resubmitting. If your account is locked or you forgot your password, contact
        your administrator — encoders cannot reset their own password. If the data on
        screen looks wrong, do not edit around it; report it to the ASIN Center so the
        source can be checked.
      </div>
    </>
  );
}

function AdminSteps() {
  return (
    <>
      <h3>Review submissions</h3>
      <ol className="support-steps">
        <li>Open <strong>Validation Queue</strong> from the sidebar.</li>
        <li>Filter by type, status, municipality, or submitter to narrow the list.</li>
        <li>Open a report to check its entries and any supporting details.</li>
        <li>Select <strong>Approve</strong> or <strong>Reject</strong>. A comment is required when rejecting.</li>
        <li>To act on several reports, tick their checkboxes and use the batch bar.</li>
      </ol>

      <h3>Manage municipalities and accounts</h3>
      <ol className="support-steps">
        <li>Open <strong>Municipality Management</strong> to add a municipality or edit its barangays.</li>
        <li>Open <strong>User Management</strong> to create an encoder or administrator account.</li>
        <li>Assign an encoder to one municipality so their data stays scoped correctly.</li>
        <li>Deactivate accounts that should no longer sign in; deletion is permanent.</li>
      </ol>
      <figure className="support-figure">
        <img
          src="/manual/admin-municipalities.png"
          alt="Municipality Management page with the list of municipalities and their actions"
          loading="lazy"
        />
        <figcaption>
          Municipality Management: open a municipality to edit its barangays, boundary,
          status, or linked encoder account.
        </figcaption>
      </figure>

      <h3>Read the dashboards</h3>
      <ol className="support-steps">
        <li>On the Executive Dashboard, set the year, month, or date range and select <strong>Apply</strong>.</li>
        <li>Hover or tap a chart to see exact values.</li>
        <li>Use the municipality filter to compare one area against the province.</li>
        <li>Open <strong>Data Quality</strong> to find gaps before publishing figures.</li>
      </ol>
      <figure className="support-figure">
        <img
          src="/manual/admin-dashboard.png"
          alt="Executive Dashboard with the period filters, KPI cards, and production charts"
          loading="lazy"
        />
        <figcaption>
          The Executive Dashboard: set the period at the top, then read the KPI cards
          and charts below.
        </figcaption>
      </figure>

      <h3>Generate reports</h3>
      <ol className="support-steps">
        <li>Open <strong>Generate Reports</strong> and choose the content sections.</li>
        <li>Set the scope (province or municipality) and the time period.</li>
        <li>Select <strong>PDF</strong> or <strong>Word</strong>, then <strong>Generate</strong>.</li>
        <li>Preview the report, then download it. Saved reports can be reopened or deleted.</li>
      </ol>
      <figure className="support-figure">
        <img
          src="/manual/admin-reports.png"
          alt="Generate Reports page with content, scope, period, and format controls"
          loading="lazy"
        />
        <figcaption>
          Generate Reports: choose the sections, scope, period, and file format, then
          select Generate.
        </figcaption>
      </figure>

      <h3>Use forecasts and targets</h3>
      <ol className="support-steps">
        <li>Open <strong>Forecasting</strong> to see the production trajectory and municipality outlook.</li>
        <li>Change the historical period or horizon to update the projection.</li>
        <li>Open <strong>Target Evaluation</strong> to compare recorded production with the target.</li>
        <li>Use the notes under each chart when explaining results to stakeholders.</li>
      </ol>
      <figure className="support-figure">
        <img
          src="/manual/admin-forecast.png"
          alt="Forecasting page with the production trajectory, municipality outlook, and period controls"
          loading="lazy"
        />
        <figcaption>
          Forecasting: the trend, municipality outlook, and seasonality update with the
          selected historical period and horizon.
        </figcaption>
      </figure>

      <div className="support-note">
        <strong>Troubleshooting.</strong> If totals look stale, check the active
        filters first — every dashboard keeps its own period. If a report cannot be
        generated, confirm that the selected period has approved data. If a
        municipality or account cannot be deleted, it may still have dependent
        records; deactivate it instead. For anything else, check <strong>Audit Log</strong>{' '}
        to see who changed what and when.
      </div>
    </>
  );
}

export default function HelpManual({ user }) {
  const role = user?.role === 'admin' ? 'admin' : 'encoder';
  const homePath = role === 'admin' ? '/admin' : '/encoder';

  return (
    <div className="support-page">
      <div className="support-topbar">
        <Link to={homePath} className="ui-btn-outline ui-btn--sm">
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          Back to dashboard
        </Link>
        <PrintButton />
      </div>

      <article className="support-card">
        <span className="support-eyebrow">
          <BookOpen size={14} strokeWidth={2} aria-hidden="true" />
          User manual
        </span>
        <h1 className="support-title">PangAsin User Manual</h1>
        <p className="support-updated">
          For {role === 'admin' ? 'administrators' : 'encoders'} · Last updated: 30 October 2026
        </p>

        <p className="support-lead">
          This manual walks through the tasks you can do in PangAsin. Start with the
          section for your role. Each task lists the exact steps in the order they
          appear on screen.
        </p>

        <div className="support-body">
          {role === 'encoder' ? (
            <section className="support-manual-section">
              <h2>Encoder tasks</h2>
              <EncoderSteps />
            </section>
          ) : (
            <section className="support-manual-section">
              <h2>Administrator tasks</h2>
              <AdminSteps />
            </section>
          )}

          <p className="support-note">
            <Mail size={15} strokeWidth={2} aria-hidden="true" />{' '}
            <strong>Need help?</strong> Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and include your
            name, municipality, and a short description of the problem. Screenshots
            help us respond faster.
          </p>
        </div>
      </article>
    </div>
  );
}
