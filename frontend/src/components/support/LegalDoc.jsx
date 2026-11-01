import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from 'react-bootstrap';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { getPublicContent } from '../../services/dataService';

const CONTACT_EMAIL = 'pang.asin26@gmail.com';

// WHAT: Legal document page shown inside the admin/encoder shell.
//       Fetches content from /api/content/<docType>, falling back to bundled
//       defaults. Sanitized rendering prevents XSS.
// WHY: Settings > Legal links to Privacy Policy and Terms & Conditions;
//      both render in the shell with the sidebar visible.
export default function LegalDoc({ docType, user }) {
  const role = user?.role === 'admin' ? 'admin' : 'encoder';
  const isPrivacy = docType === 'privacy';
  const label = isPrivacy ? 'Privacy Policy' : 'Terms & Conditions';

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getPublicContent(docType)
      .then((data) => { setContent(data); setLoading(false); })
      .catch((err) => { setError(err.message || `Could not load ${label}.`); setLoading(false); });
  }, [docType]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-header">
          <div className="settings-header-left">
            <Link to={`${role === 'admin' ? '/admin' : '/encoder'}/settings/legal`} className="settings-back">
              <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
              Legal
            </Link>
            <span className="settings-breadcrumb" aria-hidden="true">
              Legal {'>'} {label}
            </span>
            <h1 className="settings-page-title">{label}</h1>
          </div>
        </div>
        <div className="settings-page-sub" style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted">Loading {label}…</p>
        </div>
      </div>
    );
  }

  const title = content?.title || label;
  const lastUpdated = content?.last_updated || '30 October 2026';
  const sections = content?.sections || [];

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-header-left">
          <Link to={`${role === 'admin' ? '/admin' : '/encoder'}/settings/legal`} className="settings-back">
            <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
            Legal
          </Link>
          <span className="settings-breadcrumb" aria-hidden="true">
            Legal {'>'} {label}
          </span>
          <h1 className="settings-page-title">{title}</h1>
        </div>
      </div>

      <main className="settings-section-panel">
        <Card className="settings-card">
          <Card.Body className="settings-card-body">
            <span className="support-eyebrow">
              <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
              {isPrivacy ? 'Data privacy' : 'Terms of use'}
            </span>
            <h2 className="settings-section-title">{title}</h2>
            <p className="settings-page-sub">Last updated: {lastUpdated}</p>

            <div className="settings-legal-content">
              {sections.map((section, si) => (
                <div key={si} className="legal-section">
                  <h3 className="legal-section-title">{section.title || `Section ${si + 1}`}</h3>
                  {(section.paragraphs || []).map((p, pi) => (
                    <p key={pi} className="legal-paragraph">{p}</p>
                  ))}
                  {(section.bullets || []).length > 0 && (
                    <ul className="legal-bullets">
                      {(section.bullets || []).map((b, bi) => (
                        <li key={bi} className="legal-bullet">{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
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
