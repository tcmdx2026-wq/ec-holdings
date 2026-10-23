#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://giong-vn-v6.vercel.app/cham-cong';
mkdirSync('screenshots', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const results = {};
    for (const vp of [
      { name: 'desktop', width: 1280, height: 800, path: 'screenshots/deployed-desktop.png' },
      { name: 'mobile', width: 390, height: 844, path: 'screenshots/deployed-mobile.png' },
    ]) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => pageErrors.push(String(err?.message || err)));
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const status = resp?.status() ?? 0;
      await page.waitForTimeout(1000);
      const title = await page.title().catch(() => '');
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const hasCanvas = (await page.locator('canvas').count()) > 0;
      await page.screenshot({ path: vp.path, fullPage: false });
      await page.close();
      results[vp.name] = { status, title, bodyTextLen: bodyText.length, hasCanvas, consoleErrors, pageErrors, screenshot: vp.path };
    }
    console.log(JSON.stringify({ url, ok: true, results }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
