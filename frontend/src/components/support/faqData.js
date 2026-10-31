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
        q: 'How do I review submitted records?',
        a: 'Open Validation Queue from the sidebar and filter by municipality or status. Open a report to check its entries, then select Approve to include it in production totals, or Reject to return it for correction — a comment explaining what to fix is required when rejecting. The encoder can then correct and resubmit.',
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
        q: 'How do I manage municipalities and encoder accounts?',
        a: 'Open Municipality Management from the sidebar to add a municipality, or update its barangays, boundary, status, or linked encoder account. Open User Management from the sidebar to add an encoder user (choose the Encoder role and assign a municipality), reset a password, or view accounts.',
      },
    ],
  },
  {
    category: 'Forecasting',
    items: [
      {
        q: 'How do I use forecasts and Target Evaluation?',
        a: 'Open Forecasting from the sidebar to select a municipality and view its production trajectory and outlook — adjust the historical period or horizon to update the projection. Open Target Evaluation from the sidebar to compare recorded production against the target; read the notes under each chart when explaining results to stakeholders.',
      },
    ],
  },
  {
    category: 'Data Quality',
    items: [
      {
        q: 'How do I check data quality?',
        a: 'Open Data Quality from the sidebar to find gaps in records before publishing figures. Check the active filters first if totals look stale, since each dashboard keeps its own period.',
      },
    ],
  },
  {
    category: 'Salt Farmer Master List',
    items: [
      {
        q: 'How do I manage the salt farmer master list?',
        a: 'Open Salt Farmer Master List from the sidebar, select Add salt farmer, and enter the name, age, sex, barangay, and address. Save the record — it appears in the list immediately. Use search and filters to find a farmer before adding a duplicate.',
      },
    ],
  },
  {
    category: 'Dashboard and map',
    items: [
      {
        q: 'How do I read the dashboard and map?',
        a: 'The dashboard cards summarize production volume, record count, salt beds, registered farmers, and male/female counts. On the map, greener municipalities indicate higher production — click a municipality to see its production, change, salt beds, dominant method, and male/female count.',
      },
    ],
  },
  {
    category: 'Accounts',
    items: [
      {
        q: 'How do I change my password?',
        a: 'Go to Settings > Security from the sidebar, enter your current password and a new password (at least 6 characters), then select Update password. If your account was created with a temporary password, you must change it before opening any other page.',
      },
    ],
  },
];

export const encoderFaq = [
  {
    category: 'Records',
    items: [
      {
        q: 'How do I add records?',
        a: 'Production records: open Production Records from the sidebar, choose New report, pick the barangay and production month, enter each salt bed’s volume and method, then submit — it goes to the validation queue. Salt farmer master list: open Salt Farmer Master List from the sidebar, select Add salt farmer, and enter the name, age, sex, barangay, and address. Environment records: open Environment Records from the sidebar, choose New report, enter readings and observations, then submit.',
      },
    ],
  },
  {
    category: 'Records',
    items: [
      {
        q: 'What happens after I submit, and how do I fix a returned record?',
        a: 'After you submit, your report goes to the validation queue and is marked pending. An administrator reviews it — if approved, it’s included in production totals and dashboards; if returned, a reviewer comment explains what to fix. Correct the entries and submit again.',
      },
    ],
  },
  {
    category: 'Accounts',
    items: [
      {
        q: 'How do I change my password?',
        a: 'Go to Settings > Security from the sidebar, enter your current password and a new password (at least 6 characters), then select Update password. If your account was created with a temporary password, you must change it before opening any other page.',
      },
    ],
  },
  {
    category: 'Records',
    items: [
      {
        q: 'How do I find or filter my past records?',
        a: 'Open Production Records from the sidebar and use the filters for municipality, production month, and status to narrow down past records.',
      },
      {
        q: 'Can I edit or delete a record after submitting?',
        a: 'You can edit and resubmit a record that was returned for correction. Once approved, a record can no longer be edited or deleted.',
      },
      {
        q: 'What do the record statuses mean?',
        a: 'Pending means your report is awaiting review. Approved means it passed validation and is included in production totals and dashboards. Returned means it was sent back for correction with a reviewer comment explaining what to fix.',
      },
    ],
  },
  {
    category: 'Accounts',
    items: [
      {
        q: 'How do I report a problem?',
        a: 'Email the ASIN Center via the contact card with your name, municipality, the period in question, and a short description of the problem. Screenshots help us respond faster.',
      },
    ],
  },
];
