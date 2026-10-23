// GĐ 228a — E2E SSO local: login app tổng → bấm Bán hàng → tab phải là localhost:3100
// + cookie bh_session KHÔNG Secure + /api/auth/me trả user.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

// 1. Login app tổng local — đợi nút submit ENABLED (hydration guard GĐ 167)
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
const submit = page.locator('button[type="submit"]');
await submit.waitFor({ state: "visible", timeout: 20000 });
await submit.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForFunction(
  () => {
    const b = document.querySelector('button[type="submit"]');
    return b && !b.disabled;
  },
  { timeout: 30000 },
);
await page.fill('input[type="email"], input[name="email"]', "cuongpk.giong04@gmail.com");
await page.fill('input[type="password"], input[name="password"]', "Admin123!");
await submit.click();
await page.waitForTimeout(10000);
step("1. Login app tổng local", !page.url().includes("/login"), page.url());

// 2. Hover sidebar + click Bán hàng → bắt tab mới
await page.waitForTimeout(2000);
const aside = page.locator("aside").first();
await aside.hover();
await page.waitForTimeout(800); // lesson GĐ 228: đợi rail mở trước khi click text
const [child] = await Promise.all([
  ctx.waitForEvent("page", { timeout: 15000 }),
  page.click('a:has-text("Bán hàng")'),
]);
await child.waitForLoadState("domcontentloaded");
await child.waitForTimeout(5000);
step("2. Tab mở đúng localhost:3100", child.url().startsWith("http://localhost:3100"), child.url());

// 3. Cookie bh_session KHÔNG Secure
const cookies = await ctx.cookies("http://localhost:3100");
const bh = cookies.find((c) => c.name === "bh_session");
step("3. Cookie bh_session tồn tại", !!bh, bh ? `secure=${bh.secure}` : "không thấy cookie");
step("4. Cookie KHÔNG Secure (HTTP được chấp nhận)", !!bh && bh.secure === false, bh ? `secure=${bh.secure}` : "—");

// 5. /api/auth/me trả user trong tab app con
const me = await child.evaluate(async () => {
  try {
    const res = await fetch("/api/auth/me");
    const j = await res.json().catch(() => null);
    return j;
  } catch (e) {
    return { error: String(e) };
  }
});
const hasUser = me && me.user && (me.user.name || me.user.email);
step("5. /api/auth/me trả user", !!hasUser, JSON.stringify(me).slice(0, 200));

// 6. App con hiển thị tên user (SSO thành công end-to-end)
const bodyText = await child.evaluate(() => document.body.innerText.slice(0, 500));
const notLoggedIn = bodyText.includes("Chưa đăng nhập");
step("6. App con render + có phiên (không 'Chưa đăng nhập')", bodyText.length > 50 && !notLoggedIn, bodyText.replace(/\s+/g, " ").slice(0, 120));

await browser.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\n=== KẾT QUẢ: ${pass}/${results.length} PASS ===`);
process.exit(pass === results.length ? 0 : 1);
