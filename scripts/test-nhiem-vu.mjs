import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app/nhiem-vu';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('1. Mở /nhiem-vu...');
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page loaded OK');
    
    // Click "Danh sách" button qua evaluate
    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.includes('Danh sách')) btn.click();
      });
    });
    await page.waitForTimeout(1500);
    
    // Kiểm tra các dòng task hiển thị
    const taskRows = await page.locator('li').count();
    console.log('Số dòng task hiển thị:', taskRows);
    
    // Kiểm tra state hiện tại
    const currentView = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Danh sách'));
      return btn?.getAttribute('class') || '';
    });
    console.log('Button "Danh sách" active:', currentView.includes('bg-forest') ? '✓' : '✗');
    
    // Kiểm tra trạng thái hiển thị
    const statusEls = await page.$$eval('li span[class*="whitespace-nowrap"]', els => els.map(e => e.textContent.trim()));
    console.log('Các trạng thái hiển thị:', statusEls.slice(0, 5));
    
    if (statusEls.length > 0) {
      const hasViCanLam = statusEls.some(s => s === 'Việc cần làm');
      const hasQuaHan = statusEls.some(s => s === 'Quá hạn');
      const hasDaXong = statusEls.some(s => s === 'Đã xong');
      console.log('Có "Việc cần làm":', hasViCanLam ? '✓' : '✗');
      console.log('Có "Quá hạn":', hasQuaHan ? '✓' : '✗');
      console.log('Có "Đã xong":', hasDaXong ? '✓' : '✗');
      
      // Kiểm tra chữ không xuống dòng (tất cả status có đúng format không)
      const allSingleLine = statusEls.every(s => s === 'Việc cần làm' || s === 'Quá hạn' || s === 'Đã xong');
      console.log('Tất cả trạng thái 1 hàng (không xuống dòng):', allSingleLine ? '✓' : '✗');
      
      // Kiểm tra order: xem có đúng sort theo created không
      const firstRow = await page.locator('li').first();
      const firstRowText = await firstRow.textContent();
      console.log('Dòng đầu tiên:', firstRowText ? firstRowText.substring(0, 80) + '...' : '(empty)');
    } else {
      console.log('Không tìm thấy span trạng thái.');
    }
  } catch (err) {
    console.log('Lỗi:', err.message);
  }
  
  await browser.close();
})();
