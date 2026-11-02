import React, { useCallback, useEffect, useState } from 'react';
import { Card } from 'react-bootstrap';
import { ShieldCheck } from 'lucide-react';
import { getPublicContent } from '../../services/dataService';
import { SkeletonText } from '../Skeleton';

const CONTACT_EMAIL = 'pang.asin26@gmail.com';

export default function LegalDoc({ docType }) {
  const [content, setContent] = useState({ privacy: null, terms: null });
  const [loading, setLoading] = useState({ privacy: true, terms: true });
  const [active, setActive] = useState(docType === 'terms' ? 'terms' : 'privacy');

  const load = useCallback((key) => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    getPublicContent(key)
      .then((data) => {
        setContent((prev) => ({ ...prev, [key]: data }));
        setLoading((prev) => ({ ...prev, [key]: false }));
      })
      .catch(() => {
        setLoading((prev) => ({ ...prev, [key]: false }));
      });
  }, []);

  useEffect(() => {
    load('privacy');
    load('terms');
  }, []);

  const c = content[active];
  const title = c?.title || (active === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions');
  const lastUpdated = c?.last_updated || '30 October 2026';
  const sections = c?.sections || [];

  const tabs = [
    { key: 'privacy', label: 'Privacy Policy' },
    { key: 'terms', label: 'Terms & Conditions' },
  ];

  if (loading.privacy && loading.terms) {
    return (
      <main className="settings-section-panel">
        <div className="settings-section-head">
          <span className="settings-section-chip" aria-hidden="true">
            <ShieldCheck size={16} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="settings-section-title">{title}</h2>
            <p className="settings-section-sub">Last updated: 30 October 2026</p>
          </div>
        </div>
        <Card className="settings-card">
          <Card.Body className="settings-card-body">
            <SkeletonText lines={6} lastWidth="75%" />
          </Card.Body>
        </Card>
      </main>
    );
  }

  return (
    <main className="settings-section-panel">
      <div className="settings-section-head">
        <span className="settings-section-chip" aria-hidden="true">
          <ShieldCheck size={16} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="settings-section-title">{title}</h2>
          <p className="settings-section-sub">
            Last updated: {lastUpdated}{c?.version ? ` · v${c.version}${c.effective_date ? ` (effective ${c.effective_date})` : ''}` : ''}
          </p>
        </div>
      </div>
      <div className="legal-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`legal-tab ${active === t.key ? 'legal-tab-active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Card className="settings-card">
        <Card.Body className="settings-card-body">
          <div className="legal-content">
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
          <p className="legal-contact">
            For questions, email:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </Card.Body>
      </Card>
    </main>
  );
}
