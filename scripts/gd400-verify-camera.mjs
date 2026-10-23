/**
 * E2E verify GĐ 400 — chụp ảnh điểm danh + check-in (fake camera, local :3000).
 * Kiểm 4 điểm Đại ca chốt:
 *   1. Độ trễ chụp: bấm nút → preview hiện (đo ms; cham-cong phải KHÔNG chờ GPS)
 *   2. Preview live có filter mới brightness(1.15) + lớp soft-light #9ecbff
 *   3. Mirror camera trước: video transform scaleX(-1) + ảnh chụp (canvas mirror — kiểm qua preview img)
 *   4. Khối dấu: kiểm JS đánh giá bố cục không crash + preview img hiện (kích thước dấu đo trực tiếp khó
 *      trong fake camera — kiểm dấu vẽ được vào ảnh lưu qua dataURL có nội dung)
 * Chạy: node scripts/gd400-verify-camera.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = "cuongpk.giong04@gmail.com";
const PASSWORD = "Admin123!";

const results = [];
function log(step, ok, detail = "") {
  results.push({ step, ok });
  console.log(`${ok ? "✅" : "❌"} ${step}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const context = await browser.newContext({
  permissions: ["camera", "geolocation"],
  geolocation: { latitude: 21.028, longitude: 105.854 },
  locale: "vi-VN",
});
const page = await context.newPage();

try {
  // 0. Login
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000); // đợi hydrate
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !window.location.pathname.includes("login"), { timeout: 30000 });
  log("0. Login local", true, page.url());

  // ── Trang CHECK-IN ──
  await page.goto(BASE + "/check-in", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  // 1. Mở dialog Thêm Check-in
  const addBtn = page.locator('button:has-text("Thêm Check-in")').first();
  const addEnabled = await addBtn.isEnabled().catch(() => false);
  if (!addEnabled) {
    log("1. Nút Thêm Check-in", false, "DISABLED (đã Check-in hôm nay — nghiệp vụ chặn; phần camera check-in bỏ qua)");
  } else {
  await addBtn.click({ timeout: 15000 });
  await page.waitForTimeout(2500); // camera khởi động

  // 2. Preview live: filter mới + soft-light layer + mirror camera trước (default user)
  const video = page.locator("video").first();
  const vidVisible = await video.isVisible().catch(() => false);
  log("2a. Video preview mở (fake camera)", vidVisible);

  const vidStyle = await video.evaluate((el) => {
    const s = window.getComputedStyle(el);
    return { filter: s.filter, transform: s.transform };
  });
  log("2b. Filter mới brightness(1.15)+saturate(0.82)", vidStyle.filter.includes("1.15") && vidStyle.filter.includes("0.82"), vidStyle.filter);
  log("2c. Mirror camera trước scaleX(-1)", vidStyle.transform.includes("-1"), vidStyle.transform);

  const softLight = await page.locator('div[style*="soft-light"]').count();
  log("2d. Lớp soft-light trắng vàng trên preview", softLight >= 1, `count=${softLight}`);

  // 3. Bấm chụp → đo thời gian đến khi preview ảnh hiện
  const shotBtn = page.locator('button[title*="Chụp ảnh"]').first();
  const t0 = Date.now();
  await shotBtn.click();
  await page.waitForSelector('img[alt*="check-in đã đóng dấu"]', { timeout: 20000 });
  const captureMs = Date.now() - t0;
  log("3. Ghim ảnh NGAY (< 2s, trước đây chờ GPS 1-5s)", captureMs < 2000, `${captureMs}ms`);

  // 4. Ảnh chụp: dataURL JPEG + có nội dung (không đen)
  const img = page.locator('img[alt*="check-in đã đóng dấu"]').first();
  const src = (await img.getAttribute("src")) ?? "";
  const isJpeg = src.startsWith("data:image/jpeg");
  const imgLen = src.length;
  log("4. Ảnh lưu JPEG có nội dung", isJpeg && imgLen > 50000, `len=${imgLen}`);
  await page.screenshot({ path: "screenshots/gd400-checkin-preview.png" });

  // 5. Chụp lại → camera mở lại → tắt làm đẹp → filter rỗng + soft-light mất
  await page.locator('button:has-text("Chụp lại")').first().click();
  await page.waitForTimeout(2000);
  const sparkBtn = page.locator('button[title*="Làm đẹp"]').first();
  await sparkBtn.click(); // tắt beauty
  await page.waitForTimeout(400);
  const vidOff = await video.evaluate((el) => {
    const s = window.getComputedStyle(el);
    return { filter: s.filter, transform: s.transform };
  });
  const softLightOff = await page.locator('div[style*="soft-light"]').count();
  log("5. Tắt làm đẹp: filter về none, soft-light mất", (vidOff.filter === "none" || !vidOff.filter.includes("1.15")) && softLightOff === 0, `filter=${vidOff.filter} soft=${softLightOff}`);

  // Đóng dialog check-in
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);
  } // end else (nút Thêm Check-in enabled)

  // ── Trang CHẤM CÔNG (chụp ảnh điểm danh) ──
  await page.goto(BASE + "/cham-cong", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  // 6. Mở dialog điểm danh (Tan ca nếu đã vào ca, ngược lại Vào ca — cùng dialog camera)
  const punchOutBtn = page.locator('button:has-text("Tan ca")').first();
  const punchInBtn = page.locator('button:has-text("Vào ca")').first();
  let punchBtn = (await punchOutBtn.isEnabled().catch(() => false)) ? punchOutBtn : punchInBtn;
  const punchEnabled = await punchBtn.isEnabled().catch(() => false);
  if (punchEnabled) {
    await punchBtn.click();
    await page.waitForTimeout(2500);
    const video2 = page.locator("video").first();
    const vid2 = await video2.isVisible().catch(() => false);
    log("6a. Camera chấm công mở", vid2);

    // 7. Bấm chụp → đo trễ (đã bỏ chờ GPS 1-5s)
    const shot2 = page.locator('button[title*="Chụp ảnh"]').first();
    const t1 = Date.now();
    await shot2.click();
    await page.waitForSelector('img[alt*="đã đóng dấu"]', { timeout: 20000 });
    const cap2 = Date.now() - t1;
    log("7. Chấm công ghim ảnh NGAY (< 2s — đã bỏ chờ GPS)", cap2 < 2000, `${cap2}ms`);
    await page.screenshot({ path: "screenshots/gd400-chamcong-preview.png" });
  } else {
    log("6a. Camera chấm công mở", false, "không thấy nút Điểm danh vào ca (có thể đã điểm danh hôm nay — hợp lệ nghiệp vụ)");
  }
} catch (e) {
  console.error("❌ LỖI E2E:", e.message);
  results.push({ step: "CRASH", ok: false });
} finally {
  await browser.close();
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n=== KẾT QUẢ: ${pass}/${results.length} PASS ===`);
process.exit(pass === results.length ? 0 : 1);
