import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });  // Login trước
  console.log('1. Login...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  
  // Kiểm tra form login có hiện không
  const emailInput = await page.locator('input[type="email"]').count();
  console.log('Form login hiển thị:', emailInput > 0 ? '✓' : '✗');
  
  if (emailInput > 0) {
    await page.fill('input[type="email"]', 'cuongpk.giong04@gmail.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    
    // Kiểm tra đã redirect về đâu
    const afterLoginUrl = page.url();
    console.log('Sau login, URL:', afterLoginUrl);
    
    if (afterLoginUrl.includes('/login')) {
      console.log('⚠️ Chưa login thành công — credentials có thể sai');
    }
  } 
  
  // Mở /bao-cao/bang-nhiem-vu
  console.log('2. Mở /bao-cao/bang-nhiem-vu...');
  if (!afterLoginUrl.includes('/login')) {
    await page.goto(`${BASE}/bao-cao/bang-nhiem-vu`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
  }
  
  const url = page.url();
  console.log('URL hiện tại:', url);
  
  const title = await page.title();
  console.log('Tiêu đề trang:', title);
  
  // Kiểm tra có Pie chart + Bar chart + danh sách không
  const pieChart = await page.locator('text=Cấu trúc nhiệm vụ').count();
  console.log('Có phần "Cấu trúc nhiệm vụ":', pieChart > 0 ? '✓' : '✗');
  
  const barChart = await page.locator('text=Nhiệm vụ theo người phụ trách').count();
  console.log('Có phần "Nhiệm vụ theo người phụ trách":', barChart > 0 ? '✓' : '✗');
  
  const dsNhiemVu = await page.locator('text=Danh sách nhiệm vụ').count();
  console.log('Có phần "Danh sách nhiệm vụ":', dsNhiemVu > 0 ? '✓' : '✗');
  
  const filterInput = await page.locator('input[placeholder*="lọc"]').first();
  console.log('Có input lọc:', (await filterInput.count()) > 0 ? '✓' : '✗');
  
  const statusSelect = await page.locator('select').last();
  console.log('Có select trạng thái:', (await statusSelect.count()) > 0 ? '✓' : '✗');
  
  // Kiểm tra console errors
  if (errors.length > 0) {
    console.log('Console errors:', errors.slice(0, 5));
  } else {
    console.log('Không có console errors.');
  }
  
  if (errors.length > 0) {
    console.log('Console errors:', errors.slice(0, 5));
  } else {
    console.log('Không có console errors.');
  }
  
  await browser.close();
})();
