import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const CONTACT_EMAIL = 'pang.asin26@gmail.com';

export default function PrivacyPolicy() {
  // WHAT: Public page — back link always goes to the public dashboard (/),
  //       never to /admin or /encoder, regardless of login status.
  // WHY: Privacy Policy must stay public for both logged-out and logged-in users.
  return (
    <div className="support-page">
      <div className="support-topbar">
        <Link to={homePath} className="ui-btn-outline ui-btn--sm">
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          Back to dashboard
        </Link>
      </div>

      <article className="support-card">
        <span className="support-eyebrow">
          <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
          Data privacy
        </span>
        <h1 className="support-title">Privacy Policy</h1>
        <p className="support-updated">Last updated: 30 October 2026</p>

        <p className="support-lead">
          PangAsin is the salt production monitoring system of the ASIN Center,
          Pangasinan State University. This policy explains what personal data the
          system collects, why it is collected, who can see it, and the choices you
          have. It is based on the Data Privacy Act of 2012 (Republic Act No. 10173),
          its Implementing Rules and Regulations, and the issuances of the National
          Privacy Commission (NPC).
        </p>

        <div className="support-body">
          <h2>1. What data we collect</h2>
          <ul>
            <li>
              <strong>Account data</strong> for administrators and encoders: name,
              email address, role, account status, and the municipality assigned to
              an encoder.
            </li>
            <li>
              <strong>Salt farmer records</strong>: name, age, sex, barangay, and
              address as recorded by the encoder.
            </li>
            <li>
              <strong>Production and environment reports</strong>: salt bed details,
              production volume, production method, and related field notes submitted
              by encoders.
            </li>
            <li>
              <strong>Activity logs</strong>: sign-in events, account changes, data
              approvals and rejections, deletions, and other auditable actions.
            </li>
          </ul>
          <p>
            The system does not collect payment details, government-issued ID numbers,
            or health records.
          </p>

          <h2>2. Why we collect it</h2>
          <ul>
            <li>To register and maintain the salt farmer master list.</li>
            <li>To record, validate, and aggregate salt production reports.</li>
            <li>To generate reports, forecasts, and decision-support views.</li>
            <li>To manage accounts and keep the system secure.</li>
            <li>To comply with audit and reporting requirements of the ASIN Center.</li>
          </ul>
          <p>
            We process this data to perform our public mandate and legitimate
            functions, and with the consent of individuals where the law requires it.
          </p>

          <h2>3. Who can see it</h2>
          <ul>
            <li>
              <strong>The public</strong> sees aggregated, municipality-level
              production figures and charts. Names and individual records are not
              shown.
            </li>
            <li>
              <strong>Encoders</strong> see the records of the municipality assigned
              to them.
            </li>
            <li>
              <strong>Administrators</strong> see the records across municipalities so
              they can validate submissions and prepare reports.
            </li>
          </ul>
          <p>
            Access is limited by role. We do not sell personal data and do not share
            it with third parties except when required by law or by a competent
            authority.
          </p>

          <h2>4. How we protect it</h2>
          <ul>
            <li>Passwords are stored as one-way hashes, never as plain text.</li>
            <li>Sign-in is required before any non-public page can be opened.</li>
            <li>Role-based access limits each account to its assigned functions.</li>
            <li>Key actions are written to an audit log for review.</li>
            <li>Traffic is served over HTTPS when the system is deployed.</li>
          </ul>
          <p>
            No system is perfectly secure. If we learn of a breach that affects
            personal data, we will notify the NPC and affected individuals as required
            by law.
          </p>

          <h2>5. How long we keep it</h2>
          <p>
            Records are kept for as long as they are needed for the salt industry
            monitoring, reporting, and audit purposes of the ASIN Center. When data is
            no longer needed, it is deleted or anonymized. Audit logs are retained
            longer because they are needed to investigate incidents and account for
            changes.
          </p>

          <h2>6. Your rights</h2>
          <p>Under the Data Privacy Act, you have the right to:</p>
          <ul>
            <li>be informed about how your data is collected and used;</li>
            <li>access the personal data we hold about you;</li>
            <li>ask us to correct inaccurate or incomplete data;</li>
            <li>ask us to block or erase data that is no longer necessary or is being used unlawfully;</li>
            <li>object to processing in the cases allowed by law; and</li>
            <li>file a complaint with the National Privacy Commission.</li>
          </ul>
          <p>
            To exercise these rights, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. You may also reach
            the NPC through <a href="https://privacy.gov.ph" target="_blank" rel="noreferrer">privacy.gov.ph</a>.
          </p>

          <h2>7. Your responsibilities</h2>
          <ul>
            <li>Provide accurate and complete information in the records you submit.</li>
            <li>Use the system only for authorized salt industry monitoring work.</li>
            <li>Never share your account or password with another person.</li>
            <li>Report suspected unauthorized access or data loss to the ASIN Center immediately.</li>
          </ul>

          <h2>8. Contact</h2>
          <p>
            For privacy questions or requests, contact the PangAsin team at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. You may also visit
            the ASIN Center, Pangasinan State University, Binmaley, Pangasinan.
          </p>

          <p className="support-note">
            This policy may be updated when the system changes. The latest version is
            always available on this page, with the date of the last update shown at
            the top.
          </p>
        </div>
      </article>
    </div>
  );
}
