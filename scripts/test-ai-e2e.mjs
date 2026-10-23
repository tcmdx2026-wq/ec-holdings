/**
 * GĐ C.51 — E2E Trợ lý AI (tạm thời). Login app tổng → bấm nút Bán hàng
 * (SSO, không chờ tab mới — bắt tab sau bằng contexts) → panel AI → hỏi.
 */
import { chromium } from "playwright";

const BASE = "https://giong-vn-v6.vercel.app";
const EMAIL = "cuongpk.giong04@gmail.com";
const PASS = "Admin123!";

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
try {
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  await p.fill('input[type="email"]', EMAIL);
  await p.fill('input[type="password"]', PASS);
  await p.click('button[type="submit"]');
  await p.waitForURL("**/", { timeout: 30000 });
  console.log("1. Login OK");
  await p.waitForTimeout(2000);

  // Sidebar thu hẹp — hover để hiện chữ "Bán hàng"
  const aside = p.locator("aside").first();
  await aside.hover();
  await p.waitForTimeout(800);

  // Bấm nút Bán hàng — KHÔNG đợi tab event, click xong rảnh tay
  const btn = p.locator('a:has-text("Bán hàng")').first();
  await btn.click({ timeout: 10000 }).catch(async (e) => {
    console.log("click catch:", e.message.slice(0, 80));
  });
  console.log("2. Đã bấm Bán hàng — chờ tab app con...");
  await p.waitForTimeout(12000);

  // Tìm tab app con trong context
  const pages = ctx.pages();
  const bh = pages.find((pg) => pg.url().includes("giong-banhang")) ?? null;
  console.log("   pages:", pages.map((pg) => pg.url().slice(8, 40)).join(" | "));
  if (!bh) throw new Error("Không tìm thấy tab app con");
  await bh.waitForLoadState("domcontentloaded");
  await bh.waitForTimeout(6000);
  console.log("3. App con:", bh.url().slice(0, 60));

  const aiBtn = bh.locator('button:has-text("Trợ lý AI")').first();
  await aiBtn.waitFor({ state: "visible", timeout: 20000 });
  await aiBtn.click();
  await bh.waitForTimeout(800);
  console.log("4. Panel mở:", await bh.isVisible("text=Anh/chị cứ hỏi bằng tiếng Việt"));

  await bh.fill('input[placeholder*="đơn giá"]', "Đơn giá nhập Sốvac mới nhất?");
  await bh.click('button[aria-label="Gửi"]');
  console.log("5. Đã gửi — chờ trả lời 60s...");
  await bh.waitForTimeout(120000);
  const msgs = await bh.locator("div.rounded-bl-md").allTextContents();
  console.log("6. Trả lời:", (msgs[msgs.length - 1] ?? "(trống)").slice(0, 500));
  await bh.screenshot({ path: "screenshots/ai-assistant-e2e.png" });
  console.log("OK — screenshots/ai-assistant-e2e.png");
} catch (e) {
  console.error("FAIL:", e.message.slice(0, 300));
  process.exitCode = 1;
} finally {
  await b.close();
}
