import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warn' && msg.text().includes('store')) errors.push(`[warn] ${msg.text()}`);
  });

  // 1. Navigate to cham-cong
  console.log('=== 1. Navigate to /cham-cong ===');
  await page.goto('http://127.0.0.1:3000/cham-cong', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('URL:', page.url());

  // 2. Wait for hydration + Neon sync
  console.log('Waiting 20s for Neon hydration + seed...');
  await page.waitForTimeout(20000);

  // 3. Check results
  const bodyText = await page.textContent('body');
  console.log('\n--- Results ---');
  console.log('Has "Chấm công":', bodyText.includes('Chấm công'));
  console.log('Has "Chưa có":', bodyText.includes('Chưa có'));
  
  const rows = await page.$$('tr');
  console.log('Table rows:', rows.length);

  // Check for date patterns
  const dates = bodyText.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
  console.log('Dates found:', dates.length);
  if (dates.length > 0) console.log('Sample dates:', dates.slice(0, 3));

  // Check for employee names in table
  console.log('Has "Phạm Kiên Cường":', bodyText.includes('Phạm Kiên Cường'));

  // Screenshot
  await page.screenshot({ path: 'screenshots/local-cham-cong.png', fullPage: true });
  console.log('\nScreenshot saved to screenshots/local-cham-cong.png');

  // Console
  console.log('\n--- Console ---');
  if (errors.length === 0) console.log('No errors');
  else errors.forEach(e => console.log('⚠️', e));

  // 4. Navigate to nhiem-vu
  console.log('\n=== 2. Navigate to /nhiem-vu ===');
  await page.goto('http://127.0.0.1:3000/nhiem-vu', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const bodyText2 = await page.textContent('body');
  const taskCards = await page.$$('[class*="card"], [class*="Card"], [role="article"]');
  console.log('Has "Nhiệm vụ":', bodyText2.includes('Nhiệm vụ'));
  console.log('Cards/sections found:', taskCards.length);
  console.log('Has task content:', bodyText2.includes('Việc cần làm') || bodyText2.includes('Đang thực hiện'));
  
  await page.screenshot({ path: 'screenshots/local-nhiem-vu.png', fullPage: true });
  console.log('Screenshot saved to screenshots/local-nhiem-vu.png');

  await browser.close();
})();
