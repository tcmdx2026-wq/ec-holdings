import { chromium } from 'playwright';

// GĐ 333 — verify prod: app tổng 5.2.0 / app con 8.1.0
const targets = [
  ['App tổng', 'https://giong-vn-v6.vercel.app', '5.2.0'],
  ['App con ', 'https://giong-banhang.vercel.app', '8.1.0'],
];

const browser = await chromium.launch({ headless: true });
let fail = 0;
for (const [name, url, expect] of targets) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000); // chờ JS render version
    const txt = await page.locator('body').textContent();
    const m = txt.match(/VERSION (\d+\.\d+\.\d+)/);
    const got = m ? m[1] : '(không thấy)';
    const ok = m && m[1] === expect;
    if (!ok) fail++;
    console.log(`${name}: VERSION ${got} — mong ${expect} — ${ok ? '✅ OK' : '❌ CHƯA (Vercel còn build hoặc ghim deploy cũ)'}`);
  } catch (e) {
    fail++;
    console.log(`${name}: LỖI ${e.message.slice(0, 100)} ❌`);
  }
  await page.close();
}
await browser.close();
process.exit(fail ? 1 : 0);
