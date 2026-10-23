import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

// Listen for ALL console logs
page.on('console', msg => {
  console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
});

// Listen for page errors
page.on('pageerror', err => {
  console.log(`[PAGE ERROR] ${err.message}`);
});

// Login first
console.log('[TEST] Opening login page...');
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Fill login form
await page.fill('input[type="email"]', 'cuongpk.giong04@gmail.com');
await page.fill('input[type="password"]', 'Admin123!');
await page.click('button[type="submit"]');
await page.waitForTimeout(5000);
console.log(`[TEST] After login URL: ${page.url()}`);

// Now open check-in
console.log('[TEST] Opening check-in page...');
await page.goto('http://localhost:3000/check-in', { waitUntil: 'networkidle', timeout: 30000 });

// Wait for app to load
await page.waitForTimeout(3000);

// Check if we need to login
const url = page.url();
console.log(`[TEST] Current URL: ${url}`);

// Take screenshot of current state
await page.screenshot({ path: 'screenshots/test-checkin-overlay.png', fullPage: true });
console.log('[TEST] Screenshot saved to screenshots/test-checkin-overlay.png');

// Try to click Check-in button
const checkinBtn = page.locator('button:has-text("Check-in")');
const btnCount = await checkinBtn.count();
console.log(`[TEST] Check-in button count: ${btnCount}`);

if (btnCount > 0) {
  await checkinBtn.first().click();
  await page.waitForTimeout(2000);
  
  // Check if dialog opened
  const dialog = page.locator('dialog');
  const dialogCount = await dialog.count();
  console.log(`[TEST] Dialog count after click: ${dialogCount}`);
  
  if (dialogCount > 0) {
    // Check for video element
    const video = page.locator('video');
    const videoCount = await video.count();
    console.log(`[TEST] Video element count: ${videoCount}`);
    
    if (videoCount > 0) {
      const videoEl = video.first();
      const hasSrc = await videoEl.getAttribute('src');
      const srcObject = await videoEl.evaluate(el => el.srcObject);
      console.log(`[TEST] Video src: ${hasSrc}`);
      console.log(`[TEST] Video srcObject present: ${!!srcObject}`);
      
      // Check video dimensions
      const dimensions = await videoEl.evaluate(el => ({
        videoWidth: el.videoWidth,
        videoHeight: el.videoHeight,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        paused: el.paused,
        readyState: el.readyState
      }));
      console.log(`[TEST] Video dimensions: ${JSON.stringify(dimensions)}`);
      
      // Check if canvas overlay exists
      const canvas = page.locator('canvas');
      const canvasCount = await canvas.count();
      console.log(`[TEST] Canvas element count: ${canvasCount}`);
      
      if (canvasCount > 1) {
        // First canvas is overlay, second is hidden capture
        const overlayCanvas = canvas.first();
        const canvasInfo = await overlayCanvas.evaluate(el => ({
          width: el.width,
          height: el.height,
          style: el.style.cssText
        }));
        console.log(`[TEST] Overlay canvas: ${JSON.stringify(canvasInfo)}`);
      }
      
      // Take screenshot of dialog
      await page.screenshot({ path: 'screenshots/test-checkin-camera.png', fullPage: true });
      console.log('[TEST] Camera screenshot saved');
    }
  }
}

// Also test cham-cong
console.log('\n[TEST] Navigating to cham-cong...');
await page.goto('http://localhost:3000/cham-cong', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const punchInBtn = page.locator('button:has-text("Vào ca")');
const punchCount = await punchInBtn.count();
console.log(`[TEST] Vào ca button count: ${punchCount}`);

if (punchCount > 0) {
  await punchInBtn.first().click();
  await page.waitForTimeout(3000);
  
  const dialog = page.locator('dialog');
  const dialogCount = await dialog.count();
  console.log(`[TEST] Cham-cong dialog count: ${dialogCount}`);
  
  if (dialogCount > 0) {
    const video = page.locator('video');
    const videoCount = await video.count();
    console.log(`[TEST] Cham-cong video count: ${videoCount}`);
    
    if (videoCount > 0) {
      const dimensions = await video.first().evaluate(el => ({
        videoWidth: el.videoWidth,
        videoHeight: el.videoHeight,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        paused: el.paused,
        readyState: el.readyState
      }));
      console.log(`[TEST] Cham-cong video dimensions: ${JSON.stringify(dimensions)}`);
      
      const canvas = page.locator('canvas');
      const canvasCount = await canvas.count();
      console.log(`[TEST] Cham-cong canvas count: ${canvasCount}`);
      
      if (canvasCount > 1) {
        const overlayCanvas = canvas.first();
        const canvasInfo = await overlayCanvas.evaluate(el => ({
          width: el.width,
          height: el.height
        }));
        console.log(`[TEST] Cham-cong overlay canvas: ${JSON.stringify(canvasInfo)}`);
      }
      
      await page.screenshot({ path: 'screenshots/test-chamcong-camera.png', fullPage: true });
      console.log('[TEST] Cham-cong screenshot saved');
    }
  }
}

await browser.close();
console.log('\n[TEST] Done');
