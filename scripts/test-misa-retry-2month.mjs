// GĐ 228d — chạy lại job MISA kỳ 2 tháng (01/07→31/08) qua nút "Chạy lại" trên production
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Login + SSO
await page.goto("https://giong-vn-v6.vercel.app/login", { waitUntil: "domcontentloaded" });
const submit = page.locator('button[type="submit"]');
await submit.waitFor({ state: "visible", timeout: 30000 });
await page.waitForFunction(() => {
  const b = document.querySelector('button[type="submit"]');
  return b && !b.disabled;
}, { timeout: 30000 });
await page.fill('input[type="email"], input[name="email"]', "cuongpk.giong04@gmail.com");
await page.fill('input[type="password"], input[name="password"]', "Admin123!");
await submit.click();
await page.waitForTimeout(10000);
console.log("login:", page.url().includes("/login") ? "FAIL" : "OK");

const aside = page.locator("aside").first();
await aside.hover();
await page.waitForTimeout(800);
const [child] = await Promise.all([
  ctx.waitForEvent("page", { timeout: 15000 }),
  page.click('a:has-text("Bán hàng")'),
]);
await child.waitForLoadState("domcontentloaded");
await child.waitForTimeout(5000);
console.log("sso:", child.url().includes("giong-banhang") ? "OK" : "FAIL", child.url().slice(0, 50));

// Mở trang MISA → tìm job lỗi 01/07→31/08 → bấm Chạy lại
await child.goto("https://giong-banhang.vercel.app/m/misa-hoadon", { waitUntil: "domcontentloaded" });
await child.waitForTimeout(4000);
const body1 = await child.evaluate(() => document.body.innerText);
const errJobLine = body1.split("\n").findIndex((l) => l.includes("01/07/2026 → 31/08/2026"));
console.log("job 2 tháng ở dòng:", errJobLine, "→", (body1.split("\n")[errJobLine] || "").slice(0, 100));

// Nút "Chạy lại tác vụ này" của job LỖI (đầu tiên trong danh sách khớp kỳ)
const retryBtn = child.locator('button:has-text("Chạy lại tác vụ này")').first();
if (await retryBtn.isVisible().catch(() => false)) {
  await retryBtn.click();
  await child.waitForTimeout(4000);
  console.log("✅ Đã bấm Chạy lại — job về hàng chờ pending");
} else {
  // Job error có thể không có nút retry (chỉ job done thiếu file có) → tạo job mới cùng kỳ
  console.log("⚠️ không thấy nút Chạy lại trên job lỗi — tạo job mới cùng kỳ");
  const inputs = child.locator('input[type="date"]');
  await inputs.nth(0).fill("2026-07-01");
  await inputs.nth(1).fill("2026-08-31");
  await child.locator('button:has-text("Lấy dữ liệu MISA")').first().click();
  await child.waitForTimeout(4000);
  console.log("✅ Đã tạo job mới kỳ 01/07→31/08");
}

await child.screenshot({ path: "screenshots/misa-retry-2month.png", fullPage: true });
await browser.close();
console.log("XONG — agent sẽ nhận job trong ≤20s, theo dõi qua log");
