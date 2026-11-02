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
          'By accessing or using PangAsin, you agree to these terms and conditions. If you do not agree, you may not use the system. Continued use of the system after any changes to these terms constitutes acceptance of the revised terms.',
        ],
        bullets: [],
      },
      {
        title: '2. Purpose of PangAsin',
        paragraphs: [
          'PangAsin is a salt production monitoring, analytics, forecasting, and decision-support system developed by the DOST NICER ASIN Center in partnership with Pangasinan State University. It supports salt industry planning and data-driven decisions for the salt-producing municipalities of Pangasinan.',
        ],
        bullets: [],
      },
      {
        title: '3. Authorized access',
        paragraphs: [
          'Encoder accounts are intended for authorized municipal data entry and related permitted activities within the municipality assigned to the encoder. Administrator accounts are intended for validation, reporting, and system oversight across municipalities. SuperAdmin accounts are reserved for system governance functions.',
        ],
        bullets: [],
      },
      {
        title: '4. Data entry responsibilities',
        paragraphs: [
          'Encoders are responsible for submitting accurate and truthful information to the best of their knowledge, selecting the correct municipality and applicable reporting period, and avoiding duplicate, fabricated, or intentionally misleading records. Errors must be corrected through the application\u2019s permitted workflows, and supporting information must be provided when required by the validation process.',
        ],
        bullets: [
          'Submit accurate and truthful information in all records.',
          'Select the correct municipality and reporting period.',
          'Avoid duplicate, fabricated, or intentionally misleading records.',
          'Correct errors through the application\u2019s permitted workflows.',
          'Provide supporting information when required by the validation process.',
        ],
      },
      {
        title: '5. Data validation and approval',
        paragraphs: [
          'Submitted records may remain pending until reviewed or approved by authorized personnel. Submitted data must not automatically be treated as validated or officially approved. Approved records are included in production totals, dashboards, forecasts, and reports.',
        ],
        bullets: [],
      },
      {
        title: '6. Acceptable use',
        paragraphs: [
          'Users must not access the system without authorization, misuse accounts, manipulate records, or attempt to interfere with system operations. Any attempt to bypass role-based access controls or audit logging is prohibited.',
        ],
        bullets: [
          'Do not access the system without authorization.',
          'Do not share or misuse accounts or credentials.',
          'Do not manipulate or falsify records.',
          'Do not interfere with system operations or security controls.',
        ],
      },
      {
        title: '7. Account security',
        paragraphs: [
          'Users must protect their credentials and are responsible for all activity under their account. Suspected unauthorized account activity must be reported to the ASIN Center immediately. Passwords are stored as one-way hashes and are never displayed in plain text.',
        ],
        bullets: [
          'Protect your username and password.',
          'Do not share your account with another person.',
          'Report suspected unauthorized access immediately.',
          'Use strong, unique passwords for your account.',
        ],
      },
      {
        title: '8. Data ownership and use',
        paragraphs: [
          'Submitted information may be used for authorized monitoring, research, analytics, forecasting, reports, and decision support, subject to applicable agreements and laws. The system does not claim ownership of government, municipal, institutional, or third-party data without an established legal basis. Public dashboards show only summarized, municipality-level figures; names and individual records are not shown.',
        ],
        bullets: [],
      },
      {
        title: '9. System limitations',
        paragraphs: [
          'Forecasts and analytical outputs are decision-support estimates based on past production records. They are not a guarantee of future output and should be interpreted with regard to their limitations and the quality of underlying data.',
        ],
        bullets: [],
      },
      {
        title: '10. Confidentiality and privacy',
        paragraphs: [
          'Users must handle personal, confidential, and restricted information appropriately and follow the applicable Privacy Policy. Personal data collected by the system is protected under the Data Privacy Act of 2012 (Republic Act No. 10173).',
        ],
        bullets: [],
      },
      {
        title: '11. Availability and maintenance',
        paragraphs: [
          'Access to the system may occasionally be interrupted for maintenance, updates, or technical issues. The ASIN Center will make reasonable efforts to minimize downtime and provide advance notice where possible.',
        ],
        bullets: [],
      },
      {
        title: '12. Violations and access restrictions',
        paragraphs: [
          'Unauthorized or improper use of the system may result in appropriate account restrictions, suspension, or administrative action under applicable policies and laws. All actions are recorded in an audit log for review.',
        ],
        bullets: [],
      },
      {
        title: '13. Updates to the terms',
        paragraphs: [
          'These terms may be revised when necessary. The latest published version will be made available through the application, and continued use after any revision constitutes acceptance of the revised terms.',
        ],
        bullets: [],
      },
      {
        title: '14. Contact and responsible office',
        paragraphs: [
          'For questions about these terms, contact the ASIN Center, Pangasinan State University, Binmaley, Pangasinan. For privacy questions or requests, email pang.asin26@gmail.com.',
        ],
        bullets: [],
      },
      {
        title: '15. Effective date',
        paragraphs: [
          'These terms are effective as of 30 October 2026. This version supersedes all prior versions.',
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
