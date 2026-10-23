import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app';
const BANHANG = 'https://giong-banhang.vercel.app';
const EMAIL = 'cuongpk.giong04@gmail.com';
const PASS = 'Admin123!';

const results = [];
const ok = (step, pass, detail = '') => {
  results.push({ step, pass });
  console.log(`${pass ? '✅' : '❌'} ${step}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

let t0 = 0, signInMs = 0, signInStatus = 0;
page.on('request', (req) => { if (req.url().includes('sign-in/email')) t0 = Date.now(); });
page.on('response', (res) => {
  if (res.url().includes('sign-in/email')) { signInStatus = res.status(); signInMs = Date.now() - t0; }
});

// 1. Login với nhịp đúng
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000); // chờ hydrate
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASS);
await page.waitForTimeout(300);
await page.locator('button[type="submit"]').first().click();
let left = false;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
  const sidebar = (await page.locator('a[href="/cham-cong"]').count()) > 0;
  const noPassField = (await page.locator('input[type="password"]').count()) === 0;
  if (sidebar && noPassField && !/login/.test(page.url())) { left = true; break; }
}
ok('1. Đăng nhập', left && signInStatus === 200, `POST sign-in ${signInStatus} sau ${signInMs}ms`);

// 2-6. Full-load từng module
const checks = [
  ['/', /Chào (sáng|trưa|chiều|tối)|Điều hành chuỗi/, 'khối chào'],
  ['/cham-cong', null, 'bảng chấm công'],
  ['/nhiem-vu', /Việc cần làm/, 'board nhiệm vụ'],
  ['/de-nghi', null, 'bảng đề nghị'],
  ['/check-in', null, 'bảng check-in'],
];
for (const [path, regex, label] of checks) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  const kicked = /login/.test(page.url()) || (await page.locator('input[type="password"]').count()) > 0;
  const text = (await page.textContent('body')) || '';
  const rows = await page.locator('table tbody tr').count();
  const contentOk = regex ? regex.test(text) : true;
  const dataOk = ['bảng chấm công', 'bảng đề nghị', 'bảng check-in'].includes(label) ? rows > 0 : true;
  ok(`2. Full-load ${path === '/' ? 'Dashboard' : path}`, !kicked && contentOk && dataOk, `${rows} dòng bảng · text ${text.length} ký tự`);
  await page.screenshot({ path: `./screenshots/prod-suite${path.replace(/\//g, '-') || '-home'}.png`, fullPage: false });
}

// 7. SSO + app con
const ssoBtn = page.locator('a:has-text("Bán hàng")').first();
const [ssoPage] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 25000 }).catch(() => null),
  ssoBtn.click(),
]);
let ssoOk = false, ssoDetail = 'không mở tab';
if (ssoPage) {
  await ssoPage.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
  await ssoPage.waitForTimeout(8000);
  const me = await ctx.request.get(`${BANHANG}/api/auth/me`).catch(() => null);
  let meJson = null;
  try { meJson = await me?.json(); } catch {}
  const hasUser = !!(meJson?.user?.name);
  const kpi = /Doanh thu|Tồn kho/i.test((await ssoPage.textContent('body').catch(() => '')) || '');
  ssoOk = hasUser && kpi;
  ssoDetail = `me: ${meJson?.user?.name ?? 'null'} · KPI: ${kpi ? 'OK' : 'thiếu'}`;
  await ssoPage.screenshot({ path: './screenshots/prod-suite-banhang.png', fullPage: false });
}
ok('7. SSO + app con Bán hàng', ssoOk, ssoDetail);

await browser.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n===== TỔNG: ${passed}/${results.length} PASS =====`);
process.exit(passed === results.length ? 0 : 1);
