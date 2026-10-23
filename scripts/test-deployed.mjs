import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app';
const SCREENSHOT_DIR = './screenshots';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    // Log seed-related messages
    const text = msg.text();
    if (text.includes('store') || text.includes('Neon') || text.includes('seed') || text.includes('sync')) {
      console.log(`[console.${msg.type()}] ${text}`);
    }
  });
  page.on('pageerror', err => errors.push(err.message));

  console.log('=== 1. Navigate to chấm công ===');
  await page.goto(`${BASE}/cham-cong`, { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for hydration to complete (Neon sync is async)
  console.log('Waiting 10s for Neon hydration...');
  await page.waitForTimeout(10000);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/test-01-cham-cong.png`, fullPage: true });

  // Check for data
  const rows = await page.$$('table tbody tr');
  console.log(`Attendance rows: ${rows.length}`);

  // Check if there's a "seed" message in console
  const pageText = await page.textContent('body');

  // Check for specific content
  const hasAttendance = pageText.includes('điểm danh') || pageText.includes('Vào ca') || pageText.includes('Chấm công');
  console.log(`Has attendance UI: ${hasAttendance}`);

  // Check if the page shows "Chưa có" (no data)
  const hasNoData = pageText.includes('Chưa có');
  console.log(`Shows "no data": ${hasNoData}`);

  // Check for error messages
  const hasError = pageText.includes('Lỗi') || pageText.includes('error');
  console.log(`Shows error: ${hasError}`);

  // Try to get page content around the table area
  const tableContent = await page.$eval('table', el => el.textContent?.slice(0, 500)).catch(() => 'no table found');
  console.log(`Table content (first 500 chars): ${tableContent}`);

  console.log('\n=== Console errors ===');
  const criticalErrors = errors.filter(e => !e.includes('NotSameOrigin') && !e.includes('#418'));
  if (criticalErrors.length === 0) {
    console.log('No critical errors ✅');
  } else {
    criticalErrors.forEach(e => console.log('ERROR:', e));
  }

  await browser.close();
  console.log('\n=== Done ===');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
