#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://giong-vn-v6.vercel.app/cham-cong';
mkdirSync('screenshots', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const failed = [];
    const badStatus = [];
    page.on('requestfailed', (req) => {
      failed.push({ url: req.url(), method: req.method(), errorText: req.failure()?.errorText });
    });
    page.on('response', (res) => {
      if (res.status() >= 400) {
        badStatus.push({ url: res.url(), status: res.status(), statusText: res.statusText() });
      }
    });
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    const title = await page.title().catch(() => '');
    await page.screenshot({ path: 'screenshots/deployed-network.png', fullPage: false });
    console.log(JSON.stringify({ url, status: resp?.status() ?? 0, title, failed, badStatus, screenshot: 'screenshots/deployed-network.png' }, null, 2));
    await page.close();
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
