import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('1. Mở app...');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  
  // Find VERSION text
  const versionText = await page.locator('text=/VERSION \\d+\\.\\d+\\.\\d+/').first();
  const version = await versionText.textContent();
  console.log('Version hiển thị:', version || '(không tìm thấy)');
  
  // Check navbar VERSION
  const sidebarVersion = await page.locator('aside div:last-child').first();
  const sidebarText = await sidebarVersion.textContent();
  console.log('Sidebar footer text:', sidebarText);
  
  await browser.close();
})();
