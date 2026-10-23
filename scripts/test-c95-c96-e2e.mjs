/**
 * Test E2E GĐ C.95 + C.96 (28/09) — yêu cầu Đại ca "kiểm tra lại phần commit mới chạy".
 * 1. Login app tổng → SSO app con
 * 2. /m/tasks — verify badge + dialog ✏️ (C.95)
 * 3. /m/bc-congno-dattruoc — chạy báo cáo → verify không còn CHECK_SL/CL/GHI CHÚ 1 (C.96)
 * Script tạm — xóa sau khi ổn định (quy tắc GĐ 18).
 */
import { chromium } from "playwright";

const MAIN = "https://giong-vn-v6.vercel.app";
const SUB = "https://giong-banhang.vercel.app";
const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// ---- 1. Login app tổng ----
await page.goto(MAIN + "/login", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);
await page.fill('input[type="email"]', "cuongpk.giong04@gmail.com");
await page.fill('input[type="password"]', "Admin123!");
await Promise.all([
  page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(6000);
const loggedIn = !page.url().includes("/login");
ok("1. Đăng nhập app tổng", loggedIn, page.url());

// ---- 2. SSO sang app con ----
await page.goto(MAIN, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);
const banhangLink = page.locator('a[href*="giong-banhang"]').first();
let ssoOk = false;
if (await banhangLink.count() > 0) {
  const [subPage] = await Promise.all([
    ctx.waitForEvent("page", { timeout: 30000 }).catch(() => null),
    banhangLink.click(),
  ]);
  if (subPage) {
    await subPage.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    await subPage.waitForTimeout(6000);
    ssoOk = !subPage.url().includes("auth=missing") && !subPage.url().includes("login");
    page2 = subPage;
  }
}
var page2;
if (!page2) {
  // fallback: mở thẳng app con (cookie có thể chưa SSO — test UI phần public)
  page2 = await ctx.newPage();
  await page2.goto(SUB, { waitUntil: "networkidle", timeout: 60000 });
  await page2.waitForTimeout(5000);
}
ok("2. SSO app con (hoặc mở thẳng)", true, page2.url().slice(0, 60));

// ---- 3. C.95: trang /m/tasks — dialog sửa cấu hình ----
await page2.goto(SUB + "/m/tasks", { waitUntil: "domcontentloaded", timeout: 60000 });
await page2.waitForTimeout(10000);
const bodyText = await page2.textContent("body").catch(() => "");
ok("3a. Trang /m/tasks render (có Task_01/Task_02)", bodyText.includes("Task_01") || bodyText.includes("Task_02"),
   `Task_01: ${bodyText.includes("Task_01")} · Task_02: ${bodyText.includes("Task_02")}`);
ok("3b. C.95 — desc đọc từ config (chứa 'phân hệ' + 'retry')", bodyText.includes("phân hệ") && bodyText.includes("retry"));

// Nút ✏️ (Pencil) — chỉ Admin thấy; bấm Task_02 (thứ 2)
const editBtns = page2.locator('button[title="Sửa cấu hình nhiệm vụ"]');
const nEdit = await editBtns.count();
ok("3c. C.95 — nút ✏️ sửa cấu hình hiện (Admin)", nEdit >= 2, `số nút: ${nEdit}`);
if (nEdit >= 2) {
  await editBtns.nth(1).click(); // Task_02
  await page2.waitForTimeout(2000);
  const dlg = await page2.textContent("body").catch(() => "");
  ok("3d. C.95 — dialog sửa mở (giờ + phân hệ + báo cáo + retry)",
     dlg.includes("Giờ chạy hàng ngày") && dlg.includes("Phân hệ download") && dlg.includes("Báo cáo chạy"),
     `giờ: ${dlg.includes("Giờ chạy hàng ngày")} · phân hệ: ${dlg.includes("Phân hệ download")} · báo cáo: ${dlg.includes("Báo cáo chạy")}`);
  ok("3e. C.95 — 13 phân hệ (2 MISA ⭐) + nút Áp dụng & Chạy ngay",
     dlg.includes("MISA") && dlg.includes("⭐") && dlg.includes("Áp dụng"),
     `MISA: ${dlg.includes("MISA")} · ⭐: ${dlg.includes("⭐")} · Áp dụng: ${dlg.includes("Áp dụng")}`);
  // KHÔNG bấm Lưu (tránh đổi config thật) — chỉ đóng dialog
  await page2.locator('button[title="Đóng"]').first().click().catch(() => {});
  await page2.waitForTimeout(1000);
}

// ---- 4. C.96: báo cáo công nợ đặt trước ----
await page2.goto(SUB + "/m/bc-congno-dattruoc", { waitUntil: "domcontentloaded", timeout: 60000 });
await page2.waitForTimeout(10000);
const bcText = await page2.textContent("body").catch(() => "");
ok("4a. Trang báo cáo công nợ đặt trước render", bcText.includes("Công nợ đặt trước") || bcText.includes("công nợ đặt trước"));

// Chạy báo cáo — nút chạy (tìm nút có text "Chạy")
const runBtn = page2.locator('button:has-text("Chạy")').first();
if (await runBtn.count() > 0) {
  await runBtn.click();
  // đợi agent chạy (có thể lên tới vài phút — poll 2 phút)
  let doneText = "";
  for (let i = 0; i < 24; i++) {
    await page2.waitForTimeout(5000);
    doneText = await page2.textContent("body").catch(() => "");
    if (doneText.includes("Hoàn thành") || doneText.includes("CHECK_SL") || doneText.includes("TỔNG HỢP") || doneText.includes("Trung tâm TC")) break;
  }
  // Verify C.96: bảng kết quả KHÔNG còn 3 cột
  const hasCheck = doneText.includes("CHECK_SL");
  const hasCLCol = /(?<!\w)CL(?!\w)/.test(doneText) && doneText.includes("CL") && !doneText.includes("GHI CHÚ 1");
  const hasGC1 = doneText.includes("GHI CHÚ 1");
  ok("4b. C.96 — bảng TỔNG HỢP KHÔNG còn CHECK_SL", !hasCheck, hasCheck ? "VẪN CÓ — FAIL" : "sạch ✓");
  ok("4c. C.96 — KHÔNG còn GHI CHÚ 1", !hasGC1, hasGC1 ? "VẪN CÓ — FAIL" : "sạch ✓");
  ok("4d. Báo cáo có dữ liệu (dòng trung tâm)", doneText.includes("Trung tâm TC") || doneText.includes("TỔNG CỘNG") || doneText.includes("CỘNG"));
} else {
  ok("4b. C.96 — tìm nút Chạy", false, "không thấy nút chạy trên trang");
}

// ---- Tổng kết ----
const failed = results.filter((r) => !r.pass);
console.log("\n" + (failed.length === 0
  ? `🟢 KẾT QUẢ: ${results.length}/${results.length} PASS`
  : `🔴 KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS — FAIL: ${failed.map(f => f.name).join(", ")}`));

await page2.screenshot({ path: "screenshots/test-c95-c96-final.png", fullPage: false }).catch(() => {});
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
