// WHAT: Isa lamang na array ng mga tanong at sagot para sa Help Center.
// WHY: ginagamit ng Settings page at ng public Help Center para pare-pareho ang
//      sagot sa lahat ng lugar.
export const HELP_CENTER_FAQS = [
  {
    category: 'About PangAsin',
    q: 'What is PangAsin?',
    a: 'PangAsin is a salt production monitoring and forecasting dashboard for the salt-producing municipalities of Pangasinan. It supports planning and data-driven decisions for the local salt industry.',
  },
  {
    category: 'About PangAsin',
    q: 'Who can use it?',
    a: 'Anyone can view the public dashboard without signing in. ASIN Center administrators and municipal encoders sign in to manage records, reports, and dashboards.',
  },
  {
    category: 'About PangAsin',
    q: 'Does it show personal information?',
    a: 'No. The public dashboard shows only summarized, municipality-level production figures. No personal data is exposed.',
  },
  {
    category: 'Understanding the dashboard',
    q: 'What do the cards mean?',
    a: 'Each card summarizes one measure — for example, national salt demand, supply coverage, import dependence, or total municipality production. Hover or tap the (i) icon on a card for a short description.',
  },
  {
    category: 'Understanding the dashboard',
    q: 'What unit is used?',
    a: 'Production is measured in metric tons (MT). The public dashboard rounds values for readability.',
  },
  {
    category: 'Understanding the dashboard',
    q: 'How do I read the map?',
    a: 'Greener means higher production. Click a municipality on the map to see its production, change, salt beds, dominant method, and male/female producer count.',
  },
  {
    category: 'Understanding the dashboard',
    q: 'What is a forecast?',
    a: 'A forecast is an estimate based on past production records. It is not a guarantee of future output.',
  },
  {
    category: 'Understanding the dashboard',
    q: 'Why "—" or no data?',
    a: 'A dash means no records are available yet for that municipality or field.',
  },
  {
    category: 'Accounts',
    q: 'Do I need an account to view?',
    a: 'No. The public dashboard is open to everyone. An account is only needed to sign in as an administrator or encoder.',
  },
  {
    category: 'Accounts',
    q: 'How do I get one?',
    a: 'Accounts are created by the ASIN Center administrator. Contact them if you need access as an encoder or administrator.',
  },
  {
    category: 'Accounts',
    q: 'Forgot password?',
    a: 'On the sign-in page, select "Forgot password" and enter your email. You will receive a reset link. If none arrives, contact your administrator or the ASIN Center.',
  },
  {
    category: 'Feedback',
    q: 'How do I report a data error or problem?',
    a: 'Email the ASIN Center via the contact card with your name, municipality, the period in question, and a short description of the problem. Screenshots help us respond faster.',
  },
];
