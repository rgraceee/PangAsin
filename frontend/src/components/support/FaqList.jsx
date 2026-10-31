import React, { useState } from 'react';

// WHAT: Shared FAQ list with client-side search and accordions grouped by
//       category. Used by both the public Help Center (/help) and Settings >
//       Help & Support so answers stay consistent.
// WHY: One component to maintain; answers defined once in faqData.js.
export default function FaqList({ faqs }) {
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
      {/* ---------- Search ---------- */}
      <div className="faq-search-wrap">
        <input
          className="faq-search"
          type="text"
          placeholder="Search questions & answers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search FAQ"
        />
      </div>

      {query.length > 0 && !hasResults && (
        <div className="faq-no-results">
          <p>No results for “{query}”.</p>
          <p className="faq-no-results-hint">
            Still need help? Use the contact card below to email the ASIN Center.
          </p>
        </div>
      )}

      {/* ---------- FAQ accordions grouped by category ---------- */}
      <div className="faq-wrap">
        {categories.map((category) => {
          const items = faqs.filter((f) => f.category === category);
          const visibleItems = query.length === 0 ? items : filtered.find((c) => c.category === category)?.items || [];
          if (visibleItems.length === 0) return null;
          return (
            <div key={category} className="faq-category">
              <h3 className="faq-category-title">{category}</h3>
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
  );
}
