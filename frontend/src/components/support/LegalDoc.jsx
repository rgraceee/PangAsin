import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const CONTACT_EMAIL = 'pang.asin26@gmail.com';

// WHAT: Legal document page shown inside the admin/encoder shell.
// WHY: Settings > Legal links to Privacy Policy and Terms & Conditions.
//      Both render in the shell with the sidebar visible.
export default function LegalDoc({ docType, user }) {
  const role = user?.role === 'admin' ? 'admin' : 'encoder';
  const isPrivacy = docType === 'privacy';

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-header-left">
          <Link to={`${role === 'admin' ? '/admin' : '/encoder'}/settings/legal`} className="settings-back">
            <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
            Legal
          </Link>
          <span className="settings-breadcrumb" aria-hidden="true">
            Legal {'>'} {isPrivacy ? 'Privacy Policy' : 'Terms & Conditions'}
          </span>
          <h1 className="settings-page-title">
            {isPrivacy ? 'Privacy Policy' : 'Terms &amp; Conditions'}
          </h1>
        </div>
      </div>

      <main className="settings-section-panel">
        <Card className="settings-card">
          <Card.Body className="settings-card-body">
            <span className="support-eyebrow">
              <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
              {isPrivacy ? 'Data privacy' : 'Terms of use'}
            </span>
            <h2 className="settings-section-title">
              {isPrivacy ? 'Privacy Policy' : 'Terms &amp; Conditions'}
            </h2>
            <p className="settings-page-sub">
              Last updated: 30 October 2026
            </p>

            <div className="settings-legal-content">
              {isPrivacy ? (
                <>
                  <h3>1. What data we collect</h3>
                  <p>
                    PangAsin collects account data (name, email, role, municipality)
                    for administrators and encoders; salt farmer records (name, age,
                    sex, barangay, address); production and environment reports
                    (salt bed details, volume, method, field notes); and activity
                    logs (sign-in events, approvals, rejections, deletions).
                  </p>
                  <h3>2. Why we collect it</h3>
                  <p>
                    To register and maintain the salt farmer master list; record,
                    validate, and aggregate production reports; generate reports and
                    forecasts; manage accounts; and comply with audit requirements.
                  </p>
                  <h3>3. Who can see it</h3>
                  <p>
                    The public sees aggregated municipality-level figures. Encoders
                    see their assigned municipality&apos;s records. Administrators see all
                    municipalities. We do not sell personal data.
                  </p>
                  <h3>4. How we protect it</h3>
                  <p>
                    Passwords are hashed. Sign-in is required for non-public pages.
                    Role-based access limits each account. Key actions are audited.
                    Traffic is served over HTTPS in deployment.
                  </p>
                  <h3>5. Your rights</h3>
                  <p>
                    Under the Data Privacy Act of 2012, you may ask how your data is
                    used, access it, correct it, block or erase it, object to
                    processing, or file a complaint with the National Privacy
                    Commission. Contact:{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                  </p>
                </>
              ) : (
                <>
                  <h3>1. Acceptance</h3>
                  <p>
                    By accessing or using PangAsin, you accept these terms. If you do
                    not agree, do not use the system.
                  </p>
                  <h3>2. Purpose</h3>
                  <p>
                    PangAsin is a salt production monitoring and forecasting system
                    for Pangasinan&apos;s salt-producing municipalities, supporting
                    planning and data-driven decisions.
                  </p>
                  <h3>3. Accounts</h3>
                  <p>
                    Accounts are created by the ASIN Center administrator. Encoders
                    are assigned to one municipality. First login requires a password
                    change before any other page opens.
                  </p>
                  <h3>4. Acceptable use</h3>
                  <p>
                    Use the system only for authorized salt industry monitoring.
                    Provide accurate data. Do not share accounts. Report unauthorized
                    access immediately.
                  </p>
                  <h3>5. Data accuracy and encoder duties</h3>
                  <p>
                    Encoders must submit accurate production records and environment
                    observations. Rejected reports must be corrected and resubmitted.
                  </p>
                  <h3>6. Forecasts are estimates</h3>
                  <p>
                    Forecasts are estimates based on past records, not guarantees of
                    future output.
                  </p>
                  <h3>7. Intellectual property</h3>
                  <p>
                    PangAsin and its content are owned by the ASIN Center,
                    Pangasinan State University - Urdaneta City Campus.
                  </p>
                  <h3>8. Availability and changes</h3>
                  <p>
                    The system may be changed or suspended at any time. These terms
                    may be updated; the latest version is always available here.
                  </p>
                  <h3>9. Liability</h3>
                  <p>
                    The ASIN Center is not liable for decisions made using PangAsin
                    data. Users rely on the system at their own risk.
                  </p>
                  <h3>10. Governing law</h3>
                  <p>
                    These terms are governed by the laws of the Philippines.
                  </p>
                  <h3>11. Contact</h3>
                  <p>
                    For questions, contact:{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                  </p>
                </>
              )}
            </div>
            <p className="settings-page-sub" style={{ marginTop: 24 }}>
              For questions, email:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </Card.Body>
        </Card>
      </main>
    </div>
  );
}
