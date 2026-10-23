#!/usr/bin/env node
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://giong-vn-v6.vercel.app/cham-cong';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push({ message: String(err.message), stack: err.stack });
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000);
    console.log(JSON.stringify({ url, consoleErrors, pageErrors }, null, 2));
    await page.close();
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
