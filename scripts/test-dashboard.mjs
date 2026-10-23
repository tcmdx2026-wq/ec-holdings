import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('1. Mở dashboard...');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  
  // Kiểm tra có bảng nhiệm vụ không
  const taskSection = await page.locator('text=Nhiệm vụ').first();
  const hasTaskSection = await taskSection.count();
  console.log('Có mục Nhiệm vụ trên dashboard:', hasTaskSection > 0 ? '✓' : '✗');
  
  // Kiểm tra số lượng task hiển thị
  const taskCards = await page.locator('[class*="task-card"], [class*="Task"]').count();
  console.log('Số task cards:', taskCards);
  
  // Kiểm tra console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.waitForTimeout(2000);
  
  if (errors.length > 0) {
    console.log('Console errors:', errors.slice(0, 3));
  } else {
    console.log('Không có console errors.');
  }
  
  await browser.close();
})();
