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
    category: 'Validation Queue',
    items: [
      {
        q: 'How do I review and approve an encoder\'s record?',
        a: 'Open Validation Queue from the sidebar, filter by municipality or status, open a report to check its entries, then select Approve. Approved reports are included in production totals and dashboards.',
      },
      {
        q: 'How do I return a record for correction?',
        a: 'Open Validation Queue, find the report, select Reject, and enter a comment explaining what to fix. The encoder can then correct and resubmit the report.',
      },
    ],
  },
  {
    category: 'Generating reports',
    items: [
      {
        q: 'How do I generate and download a report?',
        a: 'Open Generate Reports from the sidebar, choose the content sections, set the scope (province or municipality) and time period, select PDF or Word, then select Generate. Preview the report before downloading.',
      },
    ],
  },
  {
    category: 'Municipality management',
    items: [
      {
        q: 'How do I add or edit a municipality?',
        a: 'Open Municipality Management from the sidebar. To add, select Add municipality and fill in the name and details. To edit, open an existing municipality and update its barangays, boundary, status, or linked encoder account.',
      },
    ],
  },
  {
    category: 'User management',
    items: [
      {
        q: 'How do I create an encoder account?',
        a: 'Open User Management from the sidebar, select Add user, choose the Encoder role, assign the municipality, and save. The encoder must change their password on first login before opening any other page.',
      },
      {
        q: 'How do I reset an encoder account?',
        a: 'Open User Management, open the encoder account, and set a new password. The encoder will be prompted to change it again on next login if required.',
      },
    ],
  },
  {
    category: 'Forecasting',
    items: [
      {
        q: 'How do I view forecasts for one municipality?',
        a: 'Open Forecasting from the sidebar, select the municipality from the filter, and view its production trajectory and outlook. Adjust the historical period or horizon to update the projection.',
      },
    ],
  },
  {
    category: 'Target Evaluation',
    items: [
      {
        q: 'How do I use Target Evaluation?',
        a: 'Open Target Evaluation from the sidebar to compare recorded production with the target. Read the notes under each chart when explaining results to stakeholders.',
      },
    ],
  },
  {
    category: 'Data Quality',
    items: [
      {
        q: 'How do I check data quality problems?',
        a: 'Open Data Quality from the sidebar to find gaps in records before publishing figures. Check the active filters first if totals look stale, since each dashboard keeps its own period.',
      },
    ],
  },
  {
    category: 'Accounts',
    items: [
      {
        q: 'How do I change my password?',
        a: 'Go to Settings > Security from the sidebar, enter your current password and a new password (at least 6 characters), then select Update password.',
      },
    ],
  },
];

export const encoderFaq = [
  {
    category: 'Records',
    items: [
      {
        q: 'How do I submit a production record?',
        a: 'Open Production Records from the sidebar, choose New report, pick the barangay and production month, enter each salt bed’s volume and method, then select Continue to review and Submit. The report goes to the validation queue and is marked pending.',
      },
      {
        q: 'How do I edit or fix a returned record?',
        a: 'Open Production Records, find the rejected report, read the reviewer comment, correct the entries, and submit it again.',
      },
      {
        q: 'How do I check if my record was approved?',
        a: 'Open Production Records and look for reports marked Approved. Approved reports are included in production totals and dashboards.',
      },
    ],
  },
  {
    category: 'Master List',
    items: [
      {
        q: 'How do I add or update a salt farmer in the master list?',
        a: 'Open Salt Farmer Master List from the sidebar, select Add salt farmer, and enter the name, age, sex, barangay, and address. Save the record; it appears in the list immediately. Use search and filters to find a farmer before adding a duplicate.',
      },
    ],
  },
  {
    category: 'Environment',
    items: [
      {
        q: 'How do I add environment records?',
        a: 'Open Environment Records from the sidebar, choose New report, enter the required readings and observations for the period, review the summary, then select Submit Environment Report.',
      },
    ],
  },
  {
    category: 'Accounts',
    items: [
      {
        q: 'What do I do on first login?',
        a: 'If your account was created with a temporary password, you must change it before opening any other page. Go to Settings > Security to set a new password (at least 6 characters).',
      },
      {
        q: 'I forgot my password.',
        a: 'On the sign-in page, select "Forgot password" and enter your email. You will receive a reset link. If none arrives, contact your administrator or the ASIN Center.',
      },
      {
        q: 'How do I change my password?',
        a: 'Go to Settings > Security from the sidebar, enter your current password and a new password (at least 6 characters), then select Update password.',
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
    category: 'Feedback',
    items: [
      {
        q: 'How do I report a problem?',
        a: 'Email the ASIN Center via the contact card with your name, municipality, the period in question, and a short description of the problem. Screenshots help us respond faster.',
      },
    ],
  },
];
