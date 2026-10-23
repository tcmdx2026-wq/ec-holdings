#!/usr/bin/env node
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://giong-vn-v6.vercel.app/cham-cong';
const intervalMs = 20000; // 20s
const maxAttempts = 15;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    for (let i = 1; i <= maxAttempts; i++) {
      const failed = [];
      page.removeAllListeners('requestfailed');
      page.on('requestfailed', (r) => failed.push({ url: r.url(), err: r.failure()?.errorText }));
      console.log(`Attempt ${i}/${maxAttempts}: checking ${url}`);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      } catch (e) {
        console.log('goto error', String(e?.message || e));
      }
      await page.waitForTimeout(1500);
      const grokFailures = failed.filter(f => f.url && f.url.includes('grok-app-builder/extensions.js'));
      if (grokFailures.length === 0) {
        console.log(JSON.stringify({ ok: true, attempt: i, message: 'grok extensions script not requested/blocked anymore' }, null, 2));
        await page.screenshot({ path: 'screenshots/deployed-after-redeploy.png' });
        await browser.close();
        process.exit(0);
      }
      console.log(`grok still blocked (attempt ${i}). Waiting ${intervalMs/1000}s...`);
      await page.waitForTimeout(intervalMs);
    }
    console.log(JSON.stringify({ ok: false, message: 'timeout waiting for grok removal' }, null, 2));
    await browser.close();
    process.exit(2);
  } catch (err) {
    console.error('error', String(err?.message || err));
    await browser.close();
    process.exit(1);
  }
})();
