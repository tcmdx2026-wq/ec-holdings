import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('1. Mở app...');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  
  // Check favicon
  const faviconUrl = await page.getAttribute('link[rel="icon"]', 'href');
  console.log('Favicon href:', faviconUrl);
  
  // Check apple-touch-icon
  const appleIcon = await page.getAttribute('link[rel="apple-touch-icon"]', 'href');
  console.log('Apple-touch-icon href:', appleIcon);
  
  // Check nếu có lỗi nào trong console
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  // Chờ một chút để lấy console errors
  await page.waitForTimeout(2000);
  
  if (errors.length > 0) {
    console.log('Console errors:', errors);
  } else {
    console.log('Không có console errors.');
  }
  
  // Check trang chủ có load được
  const title = await page.title();
  console.log('Page title:', title);
  
  // Kiểm tra có hình ảnh sidebar logo không (dùng selector img)
  const logoImg = await page.locator('img[src*="giong-vina-logo"]').first();
  const logoExist = await logoImg.count();
  console.log('Logo PNG trong sidebar exists:', logoExist > 0);
  
  await browser.close();
  console.log('Done.');
})();
