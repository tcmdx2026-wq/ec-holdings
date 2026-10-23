import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      errors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  // Go to cham-cong directly
  console.log('=== Navigate to /cham-cong ===');
  await page.goto('https://giong-vn-v6.vercel.app/cham-cong', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Final URL:', page.url());
  
  // Wait for hydration
  await page.waitForTimeout(15000);
  console.log('URL after wait:', page.url());

  // Check page content
  const bodyText = await page.textContent('body');
  console.log('\n--- Page indicators ---');
  console.log('Has "Chấm công":', bodyText.includes('Chấm công'));
  console.log('Has "Chưa có":', bodyText.includes('Chưa có'));
  console.log('Has "Đăng nhập":', bodyText.includes('Đăng nhập'));
  console.log('Has "Google":', bodyText.includes('Google'));
  console.log('Has "Không tìm thấy":', bodyText.includes('Not Found') || bodyText.includes('không tìm thấy'));
  
  // Check for table
  const rows = await page.$$('tr');
  console.log('Table rows:', rows.length);
  
  // Check for attendance-specific text
  console.log('Has dates (DD/MM/YYYY):', /\d{1,2}\/\d{1,2}\/\d{4}/.test(bodyText));
  console.log('Has "Vào ca":', bodyText.includes('Vào ca') || bodyText.includes('vào ca'));
  console.log('Has "Tan ca":', bodyText.includes('Tan ca') || bodyText.includes('tan ca'));
  
  // Take screenshot
  await page.screenshot({ path: 'screenshots/debug-cham-cong.png', fullPage: true });
  
  // Console messages
  console.log('\n--- Console ---');
  errors.forEach(e => console.log(e));
  
  await browser.close();
})();
