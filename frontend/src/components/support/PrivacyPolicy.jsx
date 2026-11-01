import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { getPublicContent } from '../../services/dataService';

const CONTACT_EMAIL = 'pang.asin26@gmail.com';

// WHAT: Public Privacy Policy page — fetches content from /api/content/privacy,
//       falling back to bundled defaults if the key is missing or the call fails.
//       Always public: back link goes to / (public dashboard), never to /admin.
// WHY: Editable content stored in the DB; public page always reads the latest
//      saved version, with sanitized rendering to prevent XSS.
export default function PrivacyPolicy() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getPublicContent('privacy')
      .then((data) => {
        setContent(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Could not load Privacy Policy.');
        setLoading(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="support-page">
        <div className="support-topbar">
          <Link to="/" className="ui-btn-outline ui-btn--sm">
            <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
            Back to dashboard
          </Link>
        </div>
        <div className="support-card" style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted">Loading Privacy Policy…</p>
        </div>
      </div>
    );
  }

  const title = content?.title || 'Privacy Policy';
  const lastUpdated = content?.last_updated || '30 October 2026';
  const sections = content?.sections || [];

  return (
    <div className="support-page">
      <div className="support-topbar">
        <Link to="/" className="ui-btn-outline ui-btn--sm">
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          Back to dashboard
        </Link>
      </div>

      <article className="support-card">
        <span className="support-eyebrow">
          <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
          Data privacy
        </span>
        <h1 className="support-title">{title}</h1>
        <p className="support-updated">Last updated: {lastUpdated}</p>

        <p className="support-lead">
          {(sections[0]?.paragraphs?.[0]) ||
            'PangAsin is the salt production monitoring system of the ASIN Center, Pangasinan State University.'}
        </p>

        <div className="support-body">
          {sections.map((section, si) => (
            <div key={si} className="policy-section">
              <h2 className="policy-section-title">{section.title || `Section ${si + 1}`}</h2>
              {(section.paragraphs || []).map((p, pi) => (
                <p key={pi} className="policy-paragraph">{p}</p>
              ))}
              {(section.bullets || []).length > 0 && (
                <ul className="policy-bullets">
                  {(section.bullets || []).map((b, bi) => (
                    <li key={bi} className="policy-bullet">{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <p className="support-note">
            This policy may be updated when the system changes. The latest version is
            always available on this page, with the date of the last update shown at
            the top.
          </p>
          <p className="support-note mt-3">
            For privacy questions or requests, contact the PangAsin team at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. You may also
            visit the ASIN Center, Pangasinan State University, Binmaley,
            Pangasinan.
          </p>
        </div>
      </article>
    </div>
  );
}
