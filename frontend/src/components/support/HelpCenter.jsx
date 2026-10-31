import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, LogIn } from 'lucide-react';
import FaqList from './FaqList';
import { publicFaq } from './faqData';

const CONTACT_EMAIL = 'pang.asin26@gmail.com';

// WHAT: Public Help Center page — no login required.
// WHY: /help must load for everyone (logged out, admin, encoder) without
//      redirecting to login or /change-password.
export default function HelpCenter() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/', { replace: true });
  };

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

      {/* ---------- FAQ accordions grouped by category (shared component) ---------- */}
      <FaqList faqs={publicFaq} />

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
