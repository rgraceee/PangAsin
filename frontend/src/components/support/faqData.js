// WHAT: Role-specific FAQ arrays for Settings and the public Help Center.
// WHY: Public /help shows only public answers; Settings > Help & Support shows
//      the FAQ for the user's role (admin or encoder). One shared FaqList
//      component renders both.
// WHY: No admin/encoder content leaks to public pages; no public-only answers
//      clutter role-specific help.

export const publicFaq = [
  {
    category: 'About PangAsin',
    items: [
      {
        q: 'What is PangAsin?',
        a: 'PangAsin is a salt production monitoring and forecasting dashboard for the salt-producing municipalities of Pangasinan. It supports planning and data-driven decisions for the local salt industry.',
      },
      {
        q: 'Who can use it?',
        a: 'Anyone can view the public dashboard without signing in. ASIN Center administrators and municipal encoders sign in to manage records, reports, and dashboards.',
      },
      {
        q: 'Does it show personal information?',
        a: 'No. The public dashboard shows only summarized, municipality-level production figures. No personal data is exposed.',
      },
    ],
  },
  {
    category: 'Understanding the dashboard',
    items: [
      {
        q: 'What do the cards mean?',
        a: 'Each card summarizes one measure — national salt demand, supply coverage, import dependence, or total municipality production. Hover or tap the (i) icon on a card for a short description.',
      },
      {
        q: 'What unit is used?',
        a: 'Production is measured in metric tons (MT). The public dashboard rounds values for readability.',
      },
      {
        q: 'How do I read the map?',
        a: 'Greener means higher production. Click a municipality on the map to see its production, change, salt beds, dominant method, and male/female producer count.',
      },
      {
        q: 'What is a forecast?',
        a: 'A forecast is an estimate based on past production records. It is not a guarantee of future output.',
      },
      {
        q: 'Why "—" or no data?',
        a: 'A dash means no records are available yet for that municipality or field.',
      },
    ],
  },
  {
    category: 'Accounts',
    items: [
      {
        q: 'Do I need an account to view?',
        a: 'No. The public dashboard is open to everyone. An account is only needed to sign in as an administrator or encoder.',
      },
      {
        q: 'How do I get one?',
        a: 'Accounts are created by the ASIN Center administrator. Contact them if you need access as an encoder or administrator.',
      },
      {
        q: 'Forgot password?',
        a: 'On the sign-in page, select "Forgot password" and enter your email. You will receive a reset link. If none arrives, contact your administrator or the ASIN Center.',
      },
    ],
  },
  {
    category: 'Feedback',
    items: [
      {
        q: 'How do I report a data error or problem?',
        a: 'Email the ASIN Center via the contact card with your name, municipality, the period in question, and a short description of the problem. Screenshots help us respond faster.',
      },
    ],
  },
];

export const adminFaq = [
  {
    category: 'About PangAsin',
    items: [
      {
        q: 'What can administrators do?',
        a: 'Administrators view the Executive Dashboard, manage municipalities and user accounts, review the validation queue, check data quality, generate reports, and view forecasts and targets.',
      },
    ],
  },
  {
    category: 'Accounts',
    items: [
      {
        q: 'How are encoder accounts created?',
        a: 'The administrator creates encoder accounts via User Management and assigns each encoder to one municipality. The first login requires a password change before any other page opens.',
      },
      {
        q: 'Forgot password?',
        a: 'On the sign-in page, select "Forgot password" and enter your email. You will receive a reset link. If none arrives, contact your administrator or the ASIN Center.',
      },
    ],
  },
  {
    category: 'Validation Queue',
    items: [
      {
        q: 'What is the validation queue?',
        a: 'Submitted production reports go here for review. Administrators filter by type, status, municipality, or submitter, then open a report to check its entries.',
      },
      {
        q: 'Approve or return a report?',
        a: 'Select "Approve" or "Reject" on a submitted report. A comment is required when rejecting. Approved reports are included in production totals and dashboards.',
      },
    ],
  },
  {
    category: 'Data Quality',
    items: [
      {
        q: 'What is data quality?',
        a: 'Open Data Quality to find gaps in records before publishing figures. Every dashboard keeps its own period, so check the active filters first if totals look stale.',
      },
    ],
  },
  {
    category: 'Forecast + Target Evaluation',
    items: [
      {
        q: 'What is forecasting?',
        a: 'Open Forecasting to see the production trajectory and municipality outlook. Change the historical period or horizon to update the projection.',
      },
      {
        q: 'What is target evaluation?',
        a: 'Open Target Evaluation to compare recorded production with the target. Use the notes under each chart when explaining results to stakeholders.',
      },
    ],
  },
  {
    category: 'Generating reports',
    items: [
      {
        q: 'How do I generate a report?',
        a: 'Open Generate Reports, choose the content sections, set the scope (province or municipality) and time period, select PDF or Word, then Generate. Preview before downloading.',
      },
    ],
  },
];

export const encoderFaq = [
  {
    category: 'About',
    items: [
      {
        q: 'What can encoders do?',
        a: 'Encoders submit production records, manage salt farmers in the master list, and file environment records — all scoped to their assigned municipality.',
      },
    ],
  },
  {
    category: 'Records',
    items: [
      {
        q: 'How do I submit a production record?',
        a: 'Open Production Records, choose New report, pick the barangay and production month, enter each salt bed’s volume and method, then select Continue to review and Submit. The report goes to the validation queue and is marked pending.',
      },
      {
        q: 'What happens after I submit?',
        a: 'The report enters the validation queue where an administrator reviews it. Approved reports are included in production totals and dashboards; rejected reports need a comment and can be corrected and resubmitted.',
      },
      {
        q: 'Can I edit a submitted record?',
        a: 'If a report is rejected, open Production Records, find the rejected report, read the reviewer comment, correct the entries, and submit it again.',
      },
    ],
  },
  {
    category: 'Master List',
    items: [
      {
        q: 'Salt Farmer Master List?',
        a: 'Open Salt Farmer Master List, select Add salt farmer, and enter the name, age, sex, barangay, and address. Save the record; it appears in the list immediately. Use search and filters to find a farmer before adding a duplicate.',
      },
    ],
  },
  {
    category: 'Environment',
    items: [
      {
        q: 'Environment Records?',
        a: 'Open Environment Records, choose New report, enter the required readings and observations for the period, review the summary, then select Submit Environment Report.',
      },
    ],
  },
  {
    category: 'Municipality',
    items: [
      {
        q: 'Why only my municipality is visible?',
        a: 'The administrator assigns each encoder to one municipality. Encoder data stays scoped to that municipality; you cannot see or submit records for other areas.',
      },
    ],
  },
  {
    category: 'Accounts',
    items: [
      {
        q: 'First login?',
        a: 'If your account was created with a temporary password, you must change it before opening any other page. Go to Settings > Security to set a new password (at least 6 characters).',
      },
      {
        q: 'Forgot password?',
        a: 'On the sign-in page, select "Forgot password" and enter your email. You will receive a reset link. If none arrives, contact your administrator or the ASIN Center.',
      },
    ],
  },
  {
    category: 'Feedback',
    items: [
      {
        q: 'Report a problem?',
        a: 'Email the ASIN Center via the contact card with your name, municipality, the period in question, and a short description of the problem. Screenshots help us respond faster.',
      },
    ],
  },
];
