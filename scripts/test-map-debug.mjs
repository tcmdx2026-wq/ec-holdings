#!/usr/bin/env node
/** Debug map init on /bao-cao/bang-check-in — capture ALL console output. */
const BASE = 'https://giong-vn-v6.vercel.app';

(async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`));
  page.on('pageerror', err => logs.push(`[pageerror] ${err.message.slice(0, 300)}`));
  page.on('requestfailed', req => logs.push(`[requestfailed] ${req.url().slice(0, 150)} -> ${req.failure()?.errorText || 'failed'}`));

  // 1. Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  if ((await page.locator('input[type="email"]').count()) > 0) {
    await page.fill('input[type="email"]', 'cuongpk.giong04@gmail.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
  }

  // 2. Open report page
  logs.length = 0; // chỉ lấy log của trang báo cáo
  await page.goto(`${BASE}/bao-cao/bang-check-in`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(10000);

  // 3. DOM checks
  const checks = await page.evaluate(() => {
    const leafletContainer = document.querySelectorAll('.leaflet-container').length;
    // container div có ref (height 450px) có tồn tại?
    const mapDivs = [...document.querySelectorAll('div')].filter(d => d.style?.height === '450px').length;
    return { leafletContainer, mapDivs };
  });
  console.log('DOM checks:', JSON.stringify(checks));

  console.log('\n--- Console (trang báo cáo) ---');
  logs.forEach(l => console.log(l));

  await browser.close();
})();
