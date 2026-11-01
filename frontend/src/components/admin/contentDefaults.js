// WHAT: Bundled default content for editable keys, mirrored from
//       app/services/content_service.py so the frontend can reset to default
//       without a server round-trip.
// WHY: Reset-to-default must restore the bundled wording exactly; the API
//       returns current (possibly edited) content, not the default.
import { adminFaq, encoderFaq, publicFaq } from '../support/faqData';

const CONTENT_DEFAULTS = {
  privacy: {
    title: 'Privacy Policy',
    last_updated: '30 October 2026',
    sections: [
      {
        title: '1. What data we collect',
        paragraphs: [
          'PangAsin is the salt production monitoring system of the ASIN Center, Pangasinan State University. This policy explains what personal data the system collects, why it is collected, who can see it, and the choices you have. It is based on the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and the issuances of the National Privacy Commission (NPC).',
        ],
        bullets: [
          'Account data for administrators and encoders: name, email address, role, account status, and the municipality assigned to an encoder.',
          'Salt farmer records: name, age, sex, barangay, and address as recorded by the encoder.',
          'Production and environment reports: salt bed details, production volume, production method, and related field notes submitted by encoders.',
          'Activity logs: sign-in events, account changes, data approvals and rejections, deletions, and other auditable actions.',
        ],
      },
      {
        title: '2. Why we collect it',
        paragraphs: [
          'We process this data to perform our public mandate and legitimate functions, and with the consent of individuals where the law requires it.',
        ],
        bullets: [
          'To register and maintain the salt farmer master list.',
          'To record, validate, and aggregate salt production reports.',
          'To generate reports, forecasts, and decision-support views.',
          'To manage accounts and keep the system secure.',
          'To comply with audit and reporting requirements of the ASIN Center.',
        ],
      },
      {
        title: '3. Who can see it',
        paragraphs: [
          'Access is limited by role. We do not sell personal data and do not share it with third parties except when required by law or by a competent authority.',
        ],
        bullets: [
          'The public sees aggregated, municipality-level production figures and charts. Names and individual records are not shown.',
          'Encoders see the records of the municipality assigned to them.',
          'Administrators see the records across municipalities so they can validate submissions and prepare reports.',
        ],
      },
      {
        title: '4. How we protect it',
        paragraphs: [
          'No system is perfectly secure. If we learn of a breach that affects personal data, we will notify the NPC and affected individuals as required by law.',
        ],
        bullets: [
          'Passwords are stored as one-way hashes, never as plain text.',
          'Sign-in is required before any non-public page can be opened.',
          'Role-based access limits each account to its assigned functions.',
          'Key actions are written to an audit log for review.',
          'Traffic is served over HTTPS when the system is deployed.',
        ],
      },
      {
        title: '5. How long we keep it',
        paragraphs: [
          'Records are kept for as long as they are needed for the salt industry monitoring, reporting, and audit purposes of the ASIN Center. When data is no longer needed, it is deleted or anonymized. Audit logs are retained longer because they are needed to investigate incidents and account for changes.',
        ],
        bullets: [],
      },
      {
        title: '6. Your rights',
        paragraphs: [
          'Under the Data Privacy Act, you have the right to:',
          'To exercise these rights, contact us at pang.asin26@gmail.com. You may also reach the NPC through privacy.gov.ph.',
        ],
        bullets: [
          'be informed about how your data is collected and used;',
          'access the personal data we hold about you;',
          'ask us to correct inaccurate or incomplete data;',
          'ask us to block or erase data that is no longer necessary or is being used unlawfully;',
          'object to processing in the cases allowed by law; and',
          'file a complaint with the National Privacy Commission.',
        ],
      },
      {
        title: '7. Your responsibilities',
        paragraphs: [],
        bullets: [
          'Provide accurate and complete information in the records you submit.',
          'Use the system only for authorized salt industry monitoring work.',
          'Never share your account or password with another person.',
          'Report suspected unauthorized access or data loss to the ASIN Center immediately.',
        ],
      },
      {
        title: '8. Contact',
        paragraphs: [
          'For privacy questions or requests, contact the PangAsin team at pang.asin26@gmail.com. You may also visit the ASIN Center, Pangasinan State University, Binmaley, Pangasinan.',
        ],
        bullets: [],
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    last_updated: '30 October 2026',
    sections: [
      {
        title: '1. Acceptance of terms',
        paragraphs: [
          'By accessing or using PangAsin, you agree to these terms and conditions. If you do not agree, you may not use the system.',
        ],
        bullets: [],
      },
      {
        title: '2. Use of the system',
        paragraphs: [
          'The system is for authorized salt industry monitoring work by the ASIN Center, administrators, and municipal encoders.',
        ],
        bullets: [
          'Provide accurate and complete information in the records you submit.',
          'Never share your account or password with another person.',
          'Report suspected unauthorized access or data loss to the ASIN Center immediately.',
        ],
      },
      {
        title: '3. Data and content',
        paragraphs: [
          'The public dashboard shows only summarized, municipality-level production figures. Names and individual records are not shown.',
        ],
        bullets: [],
      },
      {
        title: '4. Limitation of liability',
        paragraphs: [
          'Forecasts are estimates based on past production records and are not a guarantee of future output. The ASIN Center is not liable for decisions made using the system.',
        ],
        bullets: [],
      },
      {
        title: '5. Contact',
        paragraphs: [
          'For questions, contact the PangAsin team at pang.asin26@gmail.com.',
        ],
        bullets: [],
      },
    ],
  },
  about: {
    name: 'PangAsin',
    version: '0.0.0',
    partners: 'DOST NICER ASIN Center · BFAR Regional Field Office 1',
    credit: 'PangAsin, BS Information Technology, Pangasinan State University - Urdaneta City Campus',
    note: 'Salt production monitoring system for the province of Pangasinan.',
  },
  faq_admin: adminFaq,
  faq_encoder: encoderFaq,
  faq_public: publicFaq,
};

export const CONTENT_KEYS = ['privacy', 'terms', 'about', 'faq_admin', 'faq_encoder', 'faq_public'];
export default CONTENT_DEFAULTS;
