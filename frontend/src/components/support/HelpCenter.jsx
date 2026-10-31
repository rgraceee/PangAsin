import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Search, ArrowLeft, LogIn } from 'lucide-react';
import { HELP_CENTER_FAQS } from './faqData';

const CONTACT_EMAIL = 'pang.asin26@gmail.com';

// WHAT: Public Help Center page — no login required.
// WHY: /help must load for everyone (logged out, admin, encoder) without
//      redirecting to login or /change-password.
export default function HelpCenter() {
  const [query, setQuery] = useState('');

  const filtered = HELP_CENTER_FAQS.map((category) => ({
    category: category.category,
    items: category.items.filter(
      (item) =>
        item.q.toLowerCase().includes(query.toLowerCase()) ||
        item.a.toLowerCase().includes(query.toLowerCase()),
    ),
  })).filter((category) => category.items.length > 0);

  const hasResults = query.length > 0 && filtered.length > 0;

  const categories = [...new Set(HELP_CENTER_FAQS.map((c) => c.category))];

  return (
    <div className="help-center-page">
      {/* ---------- Top bar ---------- */}
      <div className="help-topbar">
        <Link to="/" className="help-back">
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          Back to dashboard
        </Link>
        <Link to="/login" className="help-signin">
          <SignIn size={15} strokeWidth={2} aria-hidden="true" />
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

      {/* ---------- Search ---------- */}
      <div className="help-search-wrap">
        <input
          className="help-search"
          type="text"
          placeholder="Search questions & answers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search Help Center"
        />
      </div>

      {query.length > 0 && !hasResults && (
        <div className="help-no-results">
          <p>No results for “{query}”.</p>
          <p className="help-no-results-hint">
            Still need help? Use the contact card below to email the ASIN Center.
          </p>
        </div>
      )}

      {/* ---------- FAQ accordions grouped by category ---------- */}
      <div className="help-faq-wrap">
        {categories.map((category) => {
          const items = HELP_CENTER_FAQS.filter((f) => f.category === category);
          const visibleItems = query.length === 0 ? items : filtered.find((c) => c.category === category)?.items || [];
          if (visibleItems.length === 0) return null;
          return (
            <div key={category} className="help-category">
              <h3 className="help-category-title">{category}</h3>
              <div className="help-faq-list">
                {visibleItems.map((faq, index) => {
                  const isOpen = false;
                  return (
                    <div key={`${category}-${index}`} className="help-faq-item">
                      <button
                        type="button"
                        className="help-faq-question"
                        aria-expanded={false}
                        aria-controls={`help-faq-${category}-${index}`}
                      >
                        {faq.q}
                        <span className="help-faq-toggle" aria-hidden="true">▾</span>
                      </button>
                      <div id={`help-faq-${category}-${index}`} className="help-faq-answer" hidden>
                        {faq.a}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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
