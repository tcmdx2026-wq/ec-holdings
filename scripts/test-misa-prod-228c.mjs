// GĐ 228c — verify production: tạo job MISA kỳ 1 ngày → ghi chú thời gian khi running
// + badge "Hoàn thành 1/1" khi done (hết cảnh báo "thiếu 18 file" sai).
import { chromium } from "playwright";

const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

// 1. Login app tổng PRODUCTION
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
step("1. Login app tổng production", !page.url().includes("/login"), page.url());

// 2. SSO sang app con production
await page.waitForTimeout(2000);
const aside = page.locator("aside").first();
await aside.hover();
await page.waitForTimeout(800);
const [child] = await Promise.all([
  ctx.waitForEvent("page", { timeout: 15000 }),
  page.click('a:has-text("Bán hàng")'),
]);
await child.waitForLoadState("domcontentloaded");
await child.waitForTimeout(5000);
step("2. SSO app con production", child.url().includes("giong-banhang.vercel.app"), child.url().slice(0, 60));

// 3. Mở trang MISA + tạo job kỳ 25/09 (1 ngày, có data)
await child.goto("https://giong-banhang.vercel.app/m/misa-hoadon", { waitUntil: "domcontentloaded" });
await child.waitForTimeout(4000);
const inputs = child.locator('input[type="date"]');
await inputs.nth(0).fill("2026-09-25");
await inputs.nth(1).fill("2026-09-25");
const cta = child.locator('button:has-text("Lấy dữ liệu MISA")').first();
await cta.click();
await child.waitForTimeout(4000);
step("3. Đã bấm tạo job MISA kỳ 25/09", true, "");

// 4. Kiểm tra ghi chú thời gian khi job running
let runningNote = "";
for (let i = 0; i < 12; i++) {
  await child.waitForTimeout(10000);
  const body = await child.evaluate(() => document.body.innerText);
  if (/MISA xuất Excel nền/.test(body)) {
    runningNote = (body.match(/MISA xuất Excel nền[^\n]*/) || [""])[0];
    break;
  }
  if (/Hoàn thành|Lỗi/.test(body.match(/(Hoàn thành[^\n]*|Lỗi[^\n]*)/)?.[0] || "")) break;
}
step(
  "4. Ghi chú thời gian hiện khi running (PA-A)",
  /MISA xuất Excel nền — thường 4-6 phút/.test(runningNote),
  runningNote.slice(0, 120),
);

// 5. Đợi job xong — tối đa 10 phút
let finalStatus = "";
for (let i = 0; i < 60; i++) {
  await child.waitForTimeout(10000);
  const body = await child.evaluate(() => document.body.innerText);
  // dòng job mới nhất: tìm badge trạng thái cạnh kỳ 25/09 → 25/09
  const jobLine = body.split("\n").find((l) => l.includes("25/09/2026 → 25/09/2026"));
  if (jobLine && /Hoàn thành|Lỗi|Đã hủy/.test(body)) {
    // badge done + expected 1 → "Hoàn thành 1/1"
    const doneOk = /Hoàn thành 1\/1/.test(body);
    if (doneOk || /Lỗi/.test(jobLine || "")) {
      finalStatus = doneOk ? "Hoàn thành 1/1" : "Lỗi";
      break;
    }
  }
  if (i % 6 === 5) console.log(`  … đợi ${((i + 1) * 10)}s`);
}
step("5. Job xong với trạng thái", finalStatus === "Hoàn thành 1/1", finalStatus);

// 6. KHÔNG còn cảnh báo "thiếu file" cho job mới
const body2 = await child.evaluate(() => document.body.innerText);
const hasWrongWarn = /Tỷ lệ hoàn thành: 1\/19|thiếu 18 file/.test(body2);
step("6. Không còn cảnh báo 1/19 sai", !hasWrongWarn, hasWrongWarn ? "VẪN còn 1/19" : "sạch");

await child.screenshot({ path: "screenshots/misa-prod-228c.png", fullPage: true });
await browser.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\n=== KẾT QUẢ: ${pass}/${results.length} PASS ===`);
process.exit(pass === results.length ? 0 : 1);
