/*
 * Captures the user-manual screenshots at 1366x768 and saves them to
 * frontend/public/manual/. Run against the dev server with a real account:
 *
 *   $env:MANUAL_EMAIL="admin@pangasin.gov.ph"
 *   $env:MANUAL_PASSWORD="..."
 *   node scripts/capture-manual.cjs
 *
 * Optional: MANUAL_BASE (default http://localhost:5199).
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = process.env.MANUAL_BASE || 'http://localhost:5199';
const EMAIL = process.env.MANUAL_EMAIL;
const PASSWORD = process.env.MANUAL_PASSWORD;
const OUT = path.resolve(__dirname, '..', 'public', 'manual');

const SHOTS = [
  { file: 'admin-dashboard.png', path: '/admin' },
  { file: 'admin-municipalities.png', path: '/admin/municipalities' },
  { file: 'admin-reports.png', path: '/admin/reports' },
  { file: 'admin-forecast.png', path: '/admin/forecast' },
];

(async () => {
  if (!EMAIL || !PASSWORD) {
    console.error('Set MANUAL_EMAIL and MANUAL_PASSWORD first.');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#loginEmail', EMAIL);
  await page.fill('#loginPassword', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15000 });

  for (const shot of SHOTS) {
    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, shot.file), fullPage: false });
    console.log('saved', shot.file);
  }

  await browser.close();
})();
