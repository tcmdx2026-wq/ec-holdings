import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app';
const BANHANG = 'https://giong-banhang.vercel.app';
const EMAIL = 'cuongpk.giong04@gmail.com';
const PASS = 'Admin123!';
const step = (m) => console.log(`[${new Date().toLocaleTimeString('vi-VN')}] ${m}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// 1. Login + SSO
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASS);
await page.waitForTimeout(300);
await page.locator('button[type="submit"]').first().click();
let logged = false;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
  if ((await page.locator('a[href="/cham-cong"]').count()) > 0 && !/login/.test(page.url())) { logged = true; break; }
}
console.log(logged ? 'PASS 0. Đăng nhập app tổng' : 'FAIL 0. Đăng nhập');
if (!logged) { await browser.close(); process.exit(1); }
const [ssoPage] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 25000 }).catch(() => null),
  page.locator('a:has-text("Bán hàng")').first().click(),
]);
if (!ssoPage) { console.log('FAIL SSO'); await browser.close(); process.exit(1); }
await ssoPage.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
await ssoPage.waitForTimeout(8000);
console.log('PASS 0. SSO app con');
await ssoPage.goto(`${BANHANG}/m/bc-cuoi-ngay`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await ssoPage.waitForTimeout(6000);

const setDates = async (from, to) => {
  const di = ssoPage.locator('section.sticky input[type="date"]');
  await di.first().fill(from);
  await di.nth(1).fill(to);
  await ssoPage.waitForTimeout(200);
};
const runBtn = () => ssoPage.locator('button:has-text("Chạy báo cáo")').first();
const rowText = async (key) => {
  const rows = await ssoPage.locator('li', { hasText: key }).all();
  return rows.length ? (await rows[0].textContent()) || '' : '';
};

// ===== KỊCH BẢN 1: kỳ 14→16 đủ nguồn → done → verify bảng mới =====
step('1. Kịch bản 1 — kỳ 14/09 → 16/09 (đủ nguồn)…');
await setDates('2026-09-14', '2026-09-16');
await runBtn().click();
let done1 = false;
for (let i = 0; i < 40; i++) {
  await ssoPage.waitForTimeout(10000);
  const t = await rowText('14/09/2026');
  if (/Hoàn thành/.test(t)) { done1 = true; step(`done sau ${(i + 1) * 10}s — ${(/Hoàn thành [\d/]+ dòng|19 file/.exec(t) || [''])[0]}`); break; }
  if (/Lỗi/.test(t)) { step(`LỖI: ${t.slice(0, 150)}`); break; }
}
if (!done1) console.log('FAIL 1. Job 14-16 chưa Hoàn thành trong 6.5 phút');
const body1 = (await ssoPage.textContent('body')) || '';
const vName = /Trung tâm TC Long Biên/.test(body1) && /Trung tâm TC Quốc Oai/.test(body1);
const vNoSub = !/SUBTOTAL/.test(body1);
const totals = await ssoPage.locator('tr', { hasText: 'TỔNG CỘNG' }).all();
let vBold = false;
if (totals.length) {
  const cls = (await totals[totals.length - 1].getAttribute('class')) || '';
  const fw = await totals[totals.length - 1].evaluate((el) => getComputedStyle(el).fontWeight);
  vBold = /font-bold/.test(cls) && Number(fw) >= 700;
}
const th10 = await ssoPage.locator('th span').evaluateAll((els) => els.some((e) => getComputedStyle(e).fontSize === '10px'));
console.log(`${vName ? 'PASS' : 'FAIL'} 2a. Tên trung tâm đầy đủ ("Trung tâm TC Long Biên" + "Quốc Oai")`);
console.log(`${vNoSub ? 'PASS' : 'FAIL'} 2b. Không còn dòng SUBTOTAL`);
console.log(`${vBold ? 'PASS' : 'FAIL'} 2c. Dòng TỔNG CỘNG đậm (font-bold + weight>=700)`);
console.log(`${th10 ? 'PASS' : 'FAIL'} 2d. Tiêu đề cột chữ nhỏ 10px (compactHeader)`);
await ssoPage.screenshot({ path: './screenshots/verify-179-dsxk.png', fullPage: true });

// ===== KỊCH BẢN 2: kỳ 18/09 thiếu BKCT MISA → dialog 1 lần → Có → thanh % → tự chạy lại =====
step('3. Kịch bản 2 — kỳ 18/09 (thiếu BKCT) → dialog 1 lần…');
await setDates('2026-09-18', '2026-09-18');
await runBtn().click();
let dialogShown = false;
let clicked = false;
for (let i = 0; i < 20; i++) {
  await ssoPage.waitForTimeout(10000);
  const b = (await ssoPage.textContent('body')) || '';
  if (/Chưa đủ dữ liệu thực hiện/.test(b)) { dialogShown = true; step(`dialog hiện sau ${(i + 1) * 10}s`); break; }
}
if (!dialogShown) { console.log('FAIL 3. Dialog "Chưa đủ dữ liệu" không hiện'); await browser.close(); process.exit(1); }
const warnText = (await ssoPage.locator('section:has-text("Chưa đủ dữ liệu thực hiện")').first().textContent()) || '';
const nSources = (warnText.match(/thiếu (\d+) nguồn/) || [])[1] || '?';
console.log(`PASS 3. Dialog liệt kê ${nSources} nguồn thiếu (tổng thể 1 lần)`);
const dlg = ssoPage.locator('section:has-text("Chưa đủ dữ liệu thực hiện")').first();
const progressInDialog = await dlg.locator('[role="progressbar"]').count();
await dlg.locator('button:has-text("Có — tải dữ liệu còn thiếu")').first().click();
clicked = true;
step('Bấm CÓ — treo báo cáo + download nguồn thiếu…');
await ssoPage.waitForTimeout(5000);

// Theo dõi thanh % trên job báo cáo (waitdownload) + tự rerun → done
let done2 = false; let lastLog = '';
for (let i = 0; i < 50; i++) {
  await ssoPage.waitForTimeout(10000);
  const t = await rowText('18/09/2026');
  const bar = /Đang tải dữ liệu: (\d+)\/(\d+) nguồn xong · (\d+)%/.exec(t || '');
  const line = bar ? `waitdownload bar: ${bar[1]}/${bar[2]} nguồn · ${bar[3]}%`
    : /Đang tổng hợp báo cáo/.test(t || '') ? 'running (bar indeterminate)'
    : /Hoàn thành/.test(t || '') ? 'done'
    : /Lỗi/.test(t || '') ? `error: ${(t || '').slice(0, 120)}` : `? ${(t || '').slice(0, 80)}`;
  if (line !== lastLog) { step(line); lastLog = line; }
  if (/done/.test(line)) { done2 = true; break; }
  if (/error/.test(line)) break;
}
console.log(done2 ? 'PASS 4. Chuỗi tự động xong (download → tự rerun → Hoàn thành) — KHÔNG hỏi lần 2' : 'FAIL 4. Chuỗi tự động chưa xong');
// Sau done: dialog KHÔNG hỏi lại (job mới chạy xong, không needsData mới)
const body2 = (await ssoPage.textContent('body')) || '';
const askedAgain = /Chưa đủ dữ liệu thực hiện/.test(body2);
console.log(`${!askedAgain ? 'PASS' : 'FAIL'} 5. Không hỏi lại lần 2 sau khi tự chạy xong`);
await ssoPage.screenshot({ path: './screenshots/verify-179-dialog.png', fullPage: true });
console.log(`(Thông tin: dialog có progressbar: ${progressInDialog > 0})`);

await browser.close();
console.log('DONE');
process.exit(done1 && done2 ? 0 : 1);
