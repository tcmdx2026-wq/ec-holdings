// Debug GĐ 313 — SSO LAN end-to-end: login qua IP → click Bán hàng → phiên app con
import { chromium } from "playwright";

const MAIN = "http://192.168.1.250:3000";
const CON = "http://192.168.1.250:3100";
const email = process.env.PREFLIGHT_EMAIL || "cuongpk.giong04@gmail.com";
const password = process.env.PREFLIGHT_PASSWORD || "Admin123!";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// [1] Login qua IP — đợi nút submit enabled (bài học GĐ 167: SSR bấm sớm = native submit)
await page.goto(MAIN + "/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
const submit = page.locator('button[type="submit"]').first();
await submit.waitFor({ state: "visible", timeout: 15000 });
for (let i = 0; i < 30; i++) {
  if (await submit.isEnabled()) break;
  await page.waitForTimeout(500);
}
if (!(await submit.isEnabled())) throw new Error("Nút Đăng nhập vẫn disabled sau 15s — hydration chưa xong");
await submit.click();
// SPA navigation — URL đổi không có load event, poll pathname
// Kèm bắt network sign-in để phân biệt "bấm không ăn" vs "lỗi server" (GĐ 167)
// Bấm bằng native click (evaluate) — tránh Playwright click() treo khi
// navigation + re-render làm nút detach sau khi login đã thành công
const respPromise = page
  .waitForResponse((r) => r.url().includes("/api/auth/sign-in"), { timeout: 15000 })
  .catch(() => null);
await page.evaluate(() => {
  const btn = document.querySelector('button[type="submit"]');
  if (btn) btn.click();
});
const resp = await respPromise;
console.log(
  "[1a] POST sign-in:",
  resp ? resp.status() + " " + resp.url().slice(0, 80) : "KHÔNG CÓ REQUEST (bấm không ăn / JS lỗi)"
);
if (resp && resp.status() !== 200) {
  console.log("[1b] body lỗi:", (await resp.text().catch(() => "")).slice(0, 300));
}
let navOk = false;
for (let i = 0; i < 60; i++) {
  if (!page.url().includes("login")) { navOk = true; break; }
  await page.waitForTimeout(500);
}
if (!navOk) {
  const bodyTxt = (await page.textContent("body").catch(() => "")) || "";
  const toastMatch = bodyTxt.match(/(Sai email[^"]{0,80}|không kết nối[^"]{0,80}|Máy chủ[^"]{0,80})/i);
  console.log("[1c] Vẫn ở login. Toast?:", toastMatch ? toastMatch[0] : "(không thấy text lỗi)");
  await page.screenshot({ path: "screenshots/lan-login-stuck.png" });
  throw new Error("Login không điều hướng sau 30s — xem screenshots/lan-login-stuck.png");
}
console.log("[1] Login OK →", page.url());

// [2] Xác minh session TRONG page context (cookie của chính trang)
await page.waitForTimeout(2500);
const session = await page.evaluate(async () => {
  const r = await fetch("/api/auth/get-session", { credentials: "include" });
  const j = await r.json().catch(() => null);
  return { status: r.status, user: j?.user?.email ?? null };
});
console.log("[2] get-session:", JSON.stringify(session));
if (!session.user) throw new Error("Login qua IP chưa tạo được phiên (user=null)");

// [3] Đợi dashboard ổn định rồi click Bán hàng qua evaluate (tránh element detach do re-render)
await page.waitForTimeout(1500);
const popupPromise = ctx.waitForEvent("page", { timeout: 30000 });
const clicked = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find((el) =>
    (el.textContent || "").includes("Bán hàng")
  );
  if (!a) return null;
  const href = a.getAttribute("href");
  a.click(); // native click → React onClick (delegated) vẫn chạy
  return href;
});
console.log("[3] Click Bán hàng — href:", clicked);
if (!clicked) throw new Error("Không tìm thấy nút Bán hàng trên sidebar");
if (!clicked.startsWith("http://192.168.1.250:3100")) {
  throw new Error("href sai! Kỳ vọng IP LAN 3100, nhận: " + clicked);
}

// [4] Tab app con — kiểm tra có phiên SSO không
const popup = await popupPromise;
await popup.waitForLoadState("domcontentloaded");
await popup.waitForTimeout(4000); // đợi SSO route set cookie + redirect
console.log("[4] URL tab app con:", popup.url());

const me = await popup.evaluate(async () => {
  const r = await fetch("/api/auth/me", { credentials: "include" });
  const j = await r.json().catch(() => null);
  return { status: r.status, user: j?.user?.name ?? j?.user?.email ?? null };
});
console.log("[5] /api/auth/me app con:", JSON.stringify(me));

const bodyText = (await popup.textContent("body").catch(() => "")) || "";
const hasLoginGate = bodyText.includes("Đăng nhập qua App tổng");
console.log("[6] Trang app con có gate 'Đăng nhập qua App tổng'? ", hasLoginGate ? "CÓ (FAIL)" : "KHÔNG (OK)");
console.log("[7] Body có tên user/đã đăng nhập?", me.user ? "CÓ (OK)" : "KHÔNG (FAIL)");

await page.screenshot({ path: "screenshots/lan-sso-main.png" });
await popup.screenshot({ path: "screenshots/lan-sso-con.png" });

await browser.close();
if (me.user && !hasLoginGate) {
  console.log("\n✅ SSO LAN PASS — máy trạm sẽ đăng nhập app con tự động qua nút Bán hàng");
  process.exit(0);
} else {
  console.log("\n❌ SSO LAN FAIL — xem [4]-[7] ở trên");
  process.exit(1);
}
