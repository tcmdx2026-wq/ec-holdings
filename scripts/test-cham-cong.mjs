import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app/cham-cong';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Collect console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  console.log('1. Mở /cham-cong...');
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page loaded OK');
    
    // Check có lỗi "Something went wrong" không
    const errorText = await page.locator('text=Something went wrong').count();
    if (errorText > 0) {
      console.log('⚠️ VẪN CỒN LỖI: "Something went wrong"');
      const detail = await page.locator('text=isAdmin is not defined').count();
      if (detail > 0) console.log('  Lỗi: isAdmin is not defined');
    } else {
      console.log('✓ Không có lỗi "Something went wrong"');
    }
    
    // Check sidebar logo
    const logoImg = await page.locator('img[src*="giong-vina-logo"]').first();
    const logoExist = await logoImg.count();
    console.log('Logo PNG trong sidebar:', logoExist > 0 ? '✓' : '✗');
  } catch (err) {
    console.log('Lỗi truy cập:', err.message);
  }
  
  if (errors.length > 0) {
    console.log('Console errors:', errors.slice(0, 5));
  } else {
    console.log('Không có console errors.');
  }
  
  await browser.close();
})();
