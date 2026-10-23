/**
 * E2E HĐĐT qua web — tạm thời, xóa sau test.
 * Trước khi chạy: đặt biến môi trường JOB_MODE = A | B
 *   A (happy path): stub tool — kỳ vọng done + ≥1 file
 *   B (error path): tool thật thiếu playwright — kỳ vọng error + error text
 */
import { chromium } from "playwright";

const MODE = process.env.JOB_MODE || "A";
const MAIN = "https://giong-vn-v6.vercel.app";
const CHILD = "https://giong-banhang.vercel.app";
const EMAIL = "cuongpk.giong04@gmail.com";
const PASSWORD = "Admin123!";
const HDDT_URL = CHILD + "/m/smed-hdd";
const POLL_MS = 15000;
const TIMEOUT_MIN = 6;

const results = [];
function log(step, ok, detail = "") {
  results.push({ step, ok });
  console.log(`${ok ? "✅" : "❌"} ${step}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  // 1. Login app tổng → SSO sang app con → vào module HĐĐT
  await page.goto(MAIN + "/login", { waitUntil: "networkidle", timeout: 60000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(MAIN + "/", { timeout: 60000 });
  await page.waitForTimeout(6000);

  const sellBtn = page.locator('a[href*="giong-banhang"]').first();
  const [childPage] = await Promise.all([
    context.waitForEvent("page", { timeout: 30000 }),
    sellBtn.click(),
  ]);
  await childPage.waitForLoadState("networkidle");
  await childPage.goto(HDDT_URL, { waitUntil: "networkidle", timeout: 60000 });
  await childPage.waitForTimeout(3000);
  const body = await childPage.locator("body").innerText();
  log("1. Vào trang HĐĐT qua SSO", body.includes("Lấy báo cáo theo khoảng ngày"));

  // 2. Tạo job (ngày quá khứ — không chạy tool thật, chỉ test flow)
  const d = new Date(Date.now() - 7 * 86400000);
  const iso = d.toISOString().slice(0, 10);
  await childPage.fill('input[type="date"] >> nth=0', iso);
  await childPage.fill('input[type="date"] >> nth=1', iso);
  await childPage.click('button:has-text("Lấy dữ liệu 19 trung tâm")');
  await childPage.waitForTimeout(3000);
  const bodyAfterCreate = await childPage.locator("body").innerText();
  const jobCreated = bodyAfterCreate.includes("Chờ agent nhận") || bodyAfterCreate.includes("Đang chạy");
  log("2. Tạo job qua web", jobCreated, iso);

  if (!jobCreated) {
    console.log(bodyAfterCreate.slice(0, 800));
  } else {
    // 3. Chờ agent claim → poll ĐÚNG card job vừa tạo (card ĐẦU TIÊN trong danh sách
    //    — list sort created_at DESC; KHÔNG đọc toàn trang vì các job cũ có thể đã done)
    const firstCard = childPage.locator("div.rounded-lg.border-line.bg-surface-2").first();
    const deadline = Date.now() + TIMEOUT_MIN * 60 * 1000;
    let finalStatus = "";
    let finalText = "";
    while (Date.now() < deadline) {
      await childPage.reload({ waitUntil: "networkidle" }).catch(() => {});
      await childPage.waitForTimeout(2000);
      const t = await firstCard.innerText().catch(() => "");
      if (t.includes("Hoàn thành") || t.includes("Lỗi")) {
        finalStatus = t.includes("Hoàn thành") ? "done" : "error";
        finalText = t;
        break;
      }
      await childPage.waitForTimeout(POLL_MS - 2000);
    }
    const expectDone = MODE === "A";
    log(`3. Job ${MODE} kỳ vọng ${expectDone ? "Hoàn thành" : "Lỗi"}`, finalStatus === (expectDone ? "done" : "error"),
      finalStatus || "timeout 6 phút — job vẫn pending/running");

    if (finalStatus) {
      // 4. Verify chi tiết hiển thị trên web
      if (finalStatus === "done") {
        const hasFile = finalText.includes("file Excel đã lưu Drive");
        log("4. Web hiện số file Excel đã lưu Drive", hasFile);
        // 19/19 chỉ render ở trạng thái running (dòng 'Đã export X/Y…') — done state hiển thị bằng số file
        console.log(`ℹ️  Tiến độ 19/19: ${finalText.includes("19/19") ? "bắt được khi running" : "done state không render — đúng thiết kế UI"}`);
      } else {
        const hasErr = finalText.includes("Tool thoát mã");
        log("4. Web hiện chi tiết lỗi tool", hasErr, hasErr ? finalText.match(/Tool thoát mã.{0,120}/)?.[0] : "");
      }
    }
  }
} catch (err) {
  log("LỖI NGOÀI DỰ KIẾN", false, err instanceof Error ? err.message : String(err));
}

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n===== JOB ${MODE}: ${passed}/${results.length} pass =====`);
process.exit(passed === results.length ? 0 : 1);
