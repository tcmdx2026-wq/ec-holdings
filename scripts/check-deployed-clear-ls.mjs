#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://giong-vn-v6.vercel.app/cham-cong';
mkdirSync('screenshots', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // Remove localStorage key and reload
    await page.evaluate(() => localStorage.removeItem('giong-vn-v5'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    await page.screenshot({ path: 'screenshots/deployed-desktop-clearlocal.png' });
    console.log(JSON.stringify({ url, ok: true, bodyTextLen: bodyText.length, screenshot: 'screenshots/deployed-desktop-clearlocal.png' }, null, 2));
    await page.close();
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
