import { chromium } from 'playwright';

const BASE = 'https://giong-vn-v6.vercel.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('1. Mở app...');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  
  // Get full HTML head
  const headHTML = await page.evaluate(() => document.head.innerHTML);
  console.log('=== HEAD HTML ===');
  console.log(headHTML);
  console.log('================');
  
  // Get all link tags
  const links = await page.$$eval('link[rel="icon"]', els => els.map(e => ({href: e.getAttribute('href'), type: e.getAttribute('type')})));
  console.log('Icon links:', links);
  
  const appleIcons = await page.$$eval('link[rel="apple-touch-icon"]', els => els.map(e => ({href: e.getAttribute('href')})));
  console.log('Apple-touch-icon links:', appleIcons);
  
  await browser.close();
})();
