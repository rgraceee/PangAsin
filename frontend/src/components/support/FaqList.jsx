// WHAT: Shared FAQ list with accordions, rendered grouped by category
//       (public /help) or flat (Settings > Help & Support), in a two-column
//       layout (FAQ on left, help cards on right).
// WHY: One component to maintain; answers defined once in faqData.js.
//      Settings shows one flat list of questions (no category headings,
//      no search bar, no hero) because the section header already says
//      "Help & Support".
import React, { useState } from 'react';
import { BookOpen, AlertTriangle, Mail } from 'lucide-react';

export default function FaqList({ faqs, contactEmail, manualUrl = '/help/manual', reportUrl = '/help/report', showSearch = true, showHero = true, grouped = true }) {
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  // Flatten all items for search
  const allItems = faqs.flatMap((c) => c.items.map((item) => ({ ...item, category: c.category })));
  const filtered = query.length > 0
    ? allItems.filter((item) =>
        item.q.toLowerCase().includes(query.toLowerCase()) ||
        item.a.toLowerCase().includes(query.toLowerCase()),
      )
    : allItems;

  const hasResults = query.length > 0 && filtered.length > 0;
  const categories = [...new Set(faqs.map((c) => c.category))];

  const faqListContent = grouped ? (
    <>
      {categories.map((category) => {
        const items = faqs.filter((f) => f.category === category);
        const visibleItems = query.length === 0 ? items : filtered.filter((f) => f.category === category);
        if (visibleItems.length === 0) return null;
        return (
          <div key={category} className="faq-category">
            <h4 className="faq-category-title">{category}</h4>
            <div className="faq-list">
              {visibleItems.map((faq, index) => (
                <div key={`${category}-${index}`} className="faq-item">
                  <button
                    type="button"
                    className={`faq-question${openFaq === `${category}-${index}` ? ' active' : ''}`}
                    aria-expanded={openFaq === `${category}-${index}`}
                    aria-controls={`faq-${category}-${index}`}
                    onClick={() => setOpenFaq(openFaq === `${category}-${index}` ? null : `${category}-${index}`)}
                  >
                    {faq.q}
                    <span className="faq-toggle" aria-hidden="true">{openFaq === `${category}-${index}` ? '▸' : '▾'}</span>
                  </button>
                  <div id={`faq-${category}-${index}`} className="faq-answer" hidden={openFaq !== `${category}-${index}`}>
                    {faq.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  ) : (
    <>
      {filtered.map((faq, index) => (
        <div key={index} className="faq-item">
          <button
            type="button"
            className={`faq-question${openFaq === index ? ' active' : ''}`}
            aria-expanded={openFaq === index}
            aria-controls={`faq-${index}`}
            onClick={() => setOpenFaq(openFaq === index ? null : index)}
          >
            {faq.q}
            <span className="faq-toggle" aria-hidden="true">{openFaq === index ? '▸' : '▾'}</span>
          </button>
          <div id={`faq-${index}`} className="faq-answer" hidden={openFaq !== index}>
            {faq.a}
          </div>
        </div>
      ))}
    </>
  );

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
          {grouped ? null : <h3 className="faq-list-heading">Frequently Asked Questions</h3>}
          {faqListContent}
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
