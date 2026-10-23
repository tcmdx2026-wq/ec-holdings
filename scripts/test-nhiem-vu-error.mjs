import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  let afterLoginUrl = '';
  console.log('1. Login...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  const emailInput = await page.locator('input[type="email"]').count();
  console.log('Form login hiển thị:', emailInput > 0 ? '✓' : '✗');

  if (emailInput > 0) {
    await page.fill('input[type="email"]', 'cuongpk.giong04@gmail.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(6000);

    afterLoginUrl = page.url();
    console.log('Sau login, URL:', afterLoginUrl);
  }

  console.log('2. Mở /nhiem-vu...');
  if (!afterLoginUrl.includes('/login')) {
    await page.goto(`${BASE}/nhiem-vu`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
  }

  const url = page.url();
  console.log('URL hiện tại:', url);

  const bodyText = await page.locator('body').innerText();
  console.log('Nội dung body (trên 500 ký tự đầu):', bodyText.slice(0, 500));

  // screenshot lỗi
  await page.screenshot({ path: 'screenshots/nhiem-vu-error.png', fullPage: true });

  if (errors.length > 0) {
    console.log('Console errors:', errors.slice(0, 10));
    console.log('Số lượng lỗi:', errors.length);
  } else {
    console.log('Không có console errors.');
  }

  await browser.close();
})();
