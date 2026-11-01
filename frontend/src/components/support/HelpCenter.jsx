import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, LogIn, Search } from 'lucide-react';
import { getPublicContent } from '../../services/dataService';

const CONTACT_EMAIL = 'pang.asin26@gmail.com';

// WHAT: Public Help Center page — fetches FAQ from /api/content/faq_public,
//       falling back to bundled defaults. No login required.
// WHY: /help must load for everyone (logged out, admin, encoder) without
//      redirecting to login or /change-password.
export default function HelpCenter() {
  const navigate = useNavigate();

  const [faqs, setFaqs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getPublicContent('faq_public')
      .then((data) => {
        setFaqs(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Could not load Help Center content.');
        setLoading(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBack = () => {
    navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <div className="help-center-page">
        <div className="help-topbar">
          <button
            type="button"
            className="help-back"
            onClick={handleBack}
            aria-label="Back"
          >
            <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
            Back
          </button>
          <Link to="/login" className="help-signin">
            <LogIn size={15} strokeWidth={2} aria-hidden="true" />
            Sign in
          </Link>
        </div>
        <div className="help-header-card" style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted">Loading Help Center…</p>
        </div>
      </div>
    );
  }

  const categories = faqs || [];

  return (
    <div className="help-center-page">
      {/* ---------- Top bar ---------- */}
      <div className="help-topbar">
        <button
          type="button"
          className="help-back"
          onClick={handleBack}
          aria-label="Back"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          Back
        </button>
        <Link to="/login" className="help-signin">
          <LogIn size={15} strokeWidth={2} aria-hidden="true" />
          Sign in
        </Link>
      </div>

      {/* ---------- Header card ---------- */}
      <div className="help-header-card">
        <span className="help-eyebrow">
          <Search size={14} strokeWidth={2} aria-hidden="true" />
          Help Center
        </span>
        <h1 className="help-title">Help Center</h1>
        <p className="help-sub">
          Answers about the PangAsin salt production dashboard.
        </p>
      </div>

      {/* ---------- FAQ accordions grouped by category ---------- */}
      <div className="faq-list-wrap">
        <div className="faq-wrap">
          {categories.map((category, ci) => (
            <div key={ci} className="faq-category">
              <h4 className="faq-category-title">{category.category || 'Uncategorized'}</h4>
              <div className="faq-list">
                {(category.items || []).map((item, ii) => (
                  <div key={ii} className="faq-item">
                    <button
                      type="button"
                      className="faq-question"
                      onClick={() => {}}
                    >
                      {item.q}
                    </button>
                    <div className="faq-answer">
                      <span className="faq-answer-text">{item.a}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Contact card ---------- */}
      <div className="help-contact-card">
        <div className="help-contact-left">
          <span className="help-contact-icon" aria-hidden="true">
            <Mail size={18} strokeWidth={2} />
          </span>
          <div>
            <div className="help-contact-title">Still need help?</div>
            <div className="help-contact-desc">
              Contact the ASIN Center with your name, municipality, and a short
              description of the problem.
            </div>
          </div>
        </div>
        <a href={`mailto:${CONTACT_EMAIL}`} className="help-contact-mailto">
          {CONTACT_EMAIL}
        </a>
      </div>
    </div>
  );
}
