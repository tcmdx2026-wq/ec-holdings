// GĐ 228b — test job MISA sau fix: login → SSO → tạo job → đợi agent chạy xong → đọc trạng thái
import { chromium } from "playwright";

const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Login app tổng local → SSO app con
await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
const submit = page.locator('button[type="submit"]');
await submit.waitFor({ state: "visible", timeout: 20000 });
await page.waitForFunction(() => {
  const b = document.querySelector('button[type="submit"]');
  return b && !b.disabled;
}, { timeout: 30000 });
await page.fill('input[type="email"], input[name="email"]', "cuongpk.giong04@gmail.com");
await page.fill('input[type="password"], input[name="password"]', "Admin123!");
await submit.click();
await page.waitForTimeout(10000);

const aside = page.locator("aside").first();
await aside.hover();
await page.waitForTimeout(800);
const [child] = await Promise.all([
  ctx.waitForEvent("page", { timeout: 15000 }),
  page.click('a:has-text("Bán hàng")'),
]);
await child.waitForLoadState("domcontentloaded");
await child.waitForTimeout(4000);
step("1. SSO vào app con local", child.url().startsWith("http://localhost:3100"), child.url());

// Mở trang MISA BKCT
await child.goto("http://localhost:3100/m/misa-hoadon", { waitUntil: "domcontentloaded" });
await child.waitForTimeout(3000);

// Điền ngày 25/09/2026 (kỳ có data thật) — giữ default Đã cấp mã / Tất cả
const inputs = child.locator('input[type="date"]');
step("2. Form có 2 ô date", (await inputs.count()) >= 2, `count=${await inputs.count()}`);
await inputs.nth(0).fill("2026-09-25");
await inputs.nth(1).fill("2026-09-25");

// Bấm CTA tạo job
const cta = child.locator('button:has-text("Lấy dữ liệu MISA")').first();
step("3. Nút tạo job hiện", await cta.isVisible(), "");
await cta.click();
await child.waitForTimeout(3000);

// Đợi agent chạy (poll 10s) — tối đa 6 phút
let finalText = "";
for (let i = 0; i < 36; i++) {
  await child.waitForTimeout(10000);
  const body = await child.evaluate(() => document.body.innerText);
  const m = body.match(/(Hoàn thành[^\n]*|Lỗi[^\n]*|Quá hạn[^\n]*)/);
  finalText = m ? m[1] : "";
  if (/Hoàn thành|Lỗi|Quá hạn/.test(finalText)) break;
  console.log(`  … đợi ${((i + 1) * 10)}s: ${finalText || "đang chạy"}`);
}
step("4. Job có trạng thái cuối", /Hoàn thành|Lỗi|Quá hạn/.test(finalText), finalText.slice(0, 120));

// Chụp màn hình lịch sử
await child.screenshot({ path: "screenshots/misa-228b-result.png", fullPage: true });

// Kiểm tra file OUTPUT
const fs = await import("node:fs");
const dayDir = "D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/OUTPUT/11.BKCT_HDGTGT/2026-09-25";
const hasFile = fs.existsSync(dayDir) && fs.readdirSync(dayDir).some((f) => f.endsWith(".xlsx"));
step("5. File XLSX về thư mục ngày", hasFile, dayDir);

await browser.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\n=== KẾT QUẢ: ${pass}/${results.length} PASS ===`);
process.exit(pass === results.length ? 0 : 1);
