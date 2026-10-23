import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app';
const EMAIL = 'cuongpk.giong04@gmail.com';
const PASS = 'Admin123!';

const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  geolocation: { latitude: 21.028, longitude: 105.854 },
  permissions: ['geolocation', 'camera'],
});
const page = await ctx.newPage();

const sfPosts = [];
page.on('response', async (res) => {
  const url = res.url();
  if (url.includes('_serverFn') && res.request().method() === 'POST') {
    let body = '';
    try { body = (await res.text()).slice(0, 600); } catch {}
    sfPosts.push({ url: url.slice(-24), status: res.status(), body });
    console.log(`[SF POST] ...${url.slice(-24)} → ${res.status()} ${body ? '· body: ' + body.slice(0, 300) : ''}`);
  }
});
page.on('console', (msg) => {
  const t = msg.text();
  if (t.includes('[cham-cong]') || t.includes('sync') || t.toLowerCase().includes('error')) {
    console.log(`[console] ${t.slice(0, 300)}`);
  }
});

// 1. Login
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
console.log(`1. Đăng nhập: ${logged ? '✅' : '❌'}`);
if (!logged) { await browser.close(); process.exit(1); }

// 2. Mở /cham-cong
await page.goto(`${BASE}/cham-cong`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(9000);

// Đọc pending queue trước test
const qBefore = await page.evaluate(() => localStorage.getItem('giong-vn-pending-sync') || '[]');
console.log(`2. Pending queue trước: ${qBefore.slice(0, 200)}`);

// 3. Bấm "Vào ca" — nếu toast warning thì thử "Tan ca"
const btnIn = page.locator('button:has-text("Vào ca")').first();
await btnIn.click();
await page.waitForTimeout(1500);

const bodyText = (await page.textContent('body')) || '';
const blockedIn = bodyText.includes('đã vào ca');
if (blockedIn) {
  console.log('3. Vào ca bị chặn (hôm nay đã vào ca) → thử Tan ca');
  await page.locator('button:has-text("Tan ca")').first().click();
  await page.waitForTimeout(1500);
}

// Kiểm tra dialog đã mở chưa
const dialogVisible = await page.locator('[role="dialog"]').count() > 0;
console.log(`4. Dialog chấm công mở: ${dialogVisible ? '✅' : '❌'}`);
if (!dialogVisible) {
  const t = (await page.textContent('body')) || '';
  console.log(`   Dialog không mở. Toast/body: ${t.slice(0, 200)}`);
  await page.screenshot({ path: './screenshots/sync-debug-nodialog.png' });
  await browser.close();
  process.exit(1);
}

// 5. Chụp ảnh (camera fake)
await page.waitForTimeout(2500); // chờ camera stream
const shotBtn = page.locator('button[title*="Chụp ảnh"]').first();
if ((await shotBtn.count()) > 0) {
  await shotBtn.click();
  console.log('5. Đã bấm chụp ảnh');
} else {
  console.log('5. ❌ Không tìm thấy nút chụp ảnh');
  await page.screenshot({ path: './screenshots/sync-debug-noshot.png' });
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(3000);

const hasPreview = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('[role="dialog"] img'));
  return imgs.some((i) => (i.src || '').startsWith('data:image'));
});
console.log(`   Preview ảnh hiện: ${hasPreview ? '✅' : '❌'}`);

// 6. Xác nhận
const confirmBtn = page.locator('button:has-text("Xác nhận")').first();
if ((await confirmBtn.count()) === 0) {
  console.log('6. ❌ Không thấy nút Xác nhận');
  await browser.close();
  process.exit(1);
}
await confirmBtn.click();
console.log('6. Đã bấm Xác nhận — chờ response server function...');
await page.waitForTimeout(15000);

// 7. Kết quả
const qAfter = await page.evaluate(() => localStorage.getItem('giong-vn-pending-sync') || '[]');
const qLen = JSON.parse(qAfter).length;
console.log(`7. Pending queue sau: ${qLen} record`);
console.log(`   Tổng POST server function bắt được: ${sfPosts.length}`);
for (const p of sfPosts) {
  console.log(`   → ${p.status} ${p.url} ${p.body ? '· ' + p.body.slice(0, 250) : ''}`);
}
await page.screenshot({ path: './screenshots/sync-debug-after.png' });
await browser.close();
