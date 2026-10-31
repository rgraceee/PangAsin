// WHAT: Shared FAQ list with client-side search and accordions grouped by
//       category, rendered in a two-column layout (FAQ on left, help cards
//       on right). Used by both the public Help Center (/help) and Settings >
//       Help & Support so answers stay consistent.
// WHY: One component to maintain; answers defined once in faqData.js.
import React, { useState } from 'react';
import { BookOpen, AlertTriangle, Mail } from 'lucide-react';

export default function FaqList({ faqs, contactEmail, manualUrl = '/help/manual', reportUrl = '/help/report', showSearch = true, showHero = true }) {
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  const filtered = faqs.map((category) => ({
    category: category.category,
    items: category.items.filter(
      (item) =>
        item.q.toLowerCase().includes(query.toLowerCase()) ||
        item.a.toLowerCase().includes(query.toLowerCase()),
    ),
  })).filter((category) => category.items.length > 0);

  const hasResults = query.length > 0 && filtered.length > 0;
  const categories = [...new Set(faqs.map((c) => c.category))];

  return (
    <div className="faq-list-wrap">
      {/* ---------- Hero ---------- */}
      {showHero && (
        <div className="faq-hero">
          <h2 className="faq-hero-title">Help Center</h2>
          <p className="faq-hero-sub">
            Answers about the PangAsin salt production dashboard.
          </p>
        </div>
      )}

      {/* ---------- Search ---------- */}
      {showSearch && (
        <div className="faq-search-wrap">
          <input
            className="faq-search"
            type="text"
            placeholder="Search questions and answers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search FAQ"
          />
        </div>
      )}

      {query.length > 0 && !hasResults && (
        <div className="faq-no-results">
          <p>No results for “{query}”.</p>
          <p className="faq-no-results-hint">
            Still need help? Use the contact card below to email the ASIN Center.
          </p>
        </div>
      )}

      {/* ---------- Two-column layout ---------- */}
      <div className="faq-two-column">
        {/* Left: FAQ accordions */}
        <div className="faq-left-column">
          <h3 className="faq-list-heading">Frequently Asked Questions</h3>
          <div className="faq-wrap">
            {categories.map((category) => {
              const items = faqs.filter((f) => f.category === category);
              const visibleItems = query.length === 0 ? items : filtered.find((c) => c.category === category)?.items || [];
              if (visibleItems.length === 0) return null;
              return (
                <div key={category} className="faq-category">
                  <h4 className="faq-category-title">{category}</h4>
                  <div className="faq-list">
                    {visibleItems.map((faq, index) => {
                      const isOpen = openFaq === `${category}-${index}`;
                      return (
                        <div key={`${category}-${index}`} className="faq-item">
                          <button
                            type="button"
                            className={`faq-question${isOpen ? ' active' : ''}`}
                            aria-expanded={isOpen}
                            aria-controls={`faq-${category}-${index}`}
                            onClick={() => setOpenFaq(isOpen ? null : `${category}-${index}`)}
                          >
                            {faq.q}
                            <span className="faq-toggle" aria-hidden="true">
                              {isOpen ? '▸' : '▾'}
                            </span>
                          </button>
                          <div id={`faq-${category}-${index}`} className="faq-answer" hidden={!isOpen}>
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
        </div>

        {/* Right: Help cards */}
        <div className="faq-right-column">
          <h3 className="faq-right-heading">Need more help?</h3>
          <div className="faq-help-cards">
            <a href={manualUrl} className="faq-help-card">
            <span className="faq-card-icon" aria-hidden="true">
              <BookOpen size={20} strokeWidth={2} />
            </span>
              <div>
                <div className="faq-card-title">User Manual</div>
                <div className="faq-card-desc">Read the full user manual for the PangAsin dashboard.</div>
              </div>
            </a>
            <a href={reportUrl} className="faq-help-card">
            <span className="faq-card-icon" aria-hidden="true">
              <AlertTriangle size={20} strokeWidth={2} />
            </span>
              <div>
                <div className="faq-card-title">Report a problem</div>
                <div className="faq-card-desc">Tell us about a data error, login issue, or bug.</div>
              </div>
            </a>
            <a href={`mailto:${contactEmail}`} className="faq-help-card">
              <span className="faq-card-icon" aria-hidden="true">
                <Mail size={20} strokeWidth={2} />
              </span>
              <div>
                <div className="faq-card-title">Contact ASIN Center</div>
                <div className="faq-card-desc">{contactEmail}</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
