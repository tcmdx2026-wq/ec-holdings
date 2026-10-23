// Script TẠM (debug KPI trống sau PA-C): login app tổng → SSO app con → bắt lỗi loadOverviewKpi
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

let env = {};
try {
  env = Object.fromEntries(
    readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
} catch { console.log("KHÔNG đọc được .env.local"); process.exit(1); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errs = [];
const hookPage = (p) => {
  p.on("console", (m) => {
    if (m.type() === "error") errs.push(`[console.error] ${m.text().slice(0, 500)}`);
  });
  p.on("response", async (res) => {
    if (res.status() >= 400) {
      let body = "";
      try { body = (await res.text()).slice(0, 600); } catch { /* */ }
      errs.push(`[HTTP ${res.status()}] ${res.url().slice(0, 200)} :: ${body}`);
    }
  });
  p.on("pageerror", (e) => errs.push(`[pageerror] ${String(e).slice(0, 500)}`));
};
hookPage(page);

// 1. Login app tổng (local :3000)
await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2500);
await page.fill('input[type="email"]', env.PREFLIGHT_EMAIL ?? "");
await page.fill('input[type="password"]', env.PREFLIGHT_PASSWORD ?? "");
// GĐ 167: nút disabled đến khi hydrate xong — đợi enabled mới bấm
await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 25000 });
await page.click('button[type="submit"]');
// Đợi URL rời /login (tối đa 30s) — SPA redirect có thể chậm hơn URL check
await page.waitForURL((u) => !String(u).includes("/login"), { timeout: 30000 }).catch(() => {});
// Nếu URL vẫn /login, coi như OK khi nội dung ĐÃ là Dashboard ("Chào buổi")
let bodyTxt = await page.evaluate(() => document.body.innerText).catch(() => "");
if (page.url().includes("/login") && !bodyTxt.includes("Chào buổi")) {
  await page.waitForTimeout(10000);
  bodyTxt = await page.evaluate(() => document.body.innerText).catch(() => "");
}
console.log("App tổng sau login:", page.url(), "| Dashboard?", bodyTxt.includes("Chào buổi"));
if (page.url().includes("/login") && !bodyTxt.includes("Chào buổi")) {
  console.log("⚠️ Thật sự vẫn ở /login — text trang:", bodyTxt.slice(0, 300).replace(/\n+/g, " | "));
  for (const e of errs.slice(0, 10)) console.log(e);
  await browser.close();
  process.exit(1);
}

// 2. SSO sang app con qua nút Bán hàng (sidebar — hover để mở)
const popupPromise = ctx.waitForEvent("page", { timeout: 30000 });
await page.hover("aside.sidebar-desktop", { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(600);
const banhangLink = page.locator('a:has-text("Bán hàng")').first();
await banhangLink.click({ timeout: 15000 });
const page2 = await popupPromise;
hookPage(page2);
await page2.waitForLoadState("domcontentloaded");
await page2.waitForTimeout(4000);
console.log("App con URL:", page2.url());

// 3. Vào Tổng quan + đợi load KPI
await page2.goto("http://localhost:3100/", { waitUntil: "domcontentloaded", timeout: 30000 });
await page2.waitForTimeout(18000);

const bodyText = await page2.evaluate(() => document.body.innerText);
const kpiNames = ["THU TIỀN", "HÓA ĐƠN GTGT", "LƯỢT TIÊM", "NHẬP VẮC XIN", "XUẤT VẮC XIN", "TỒN KHO", "CẬN HẠN"];
console.log("Hộp KPI hiện:", kpiNames.filter((k) => bodyText.toUpperCase().includes(k)).join(", ") || "(KHÔNG CÓ HỘP NÀO)");
console.log("Banner 'Chưa đủ dữ liệu':", bodyText.includes("Chưa đủ dữ liệu"));
console.log("Biểu đồ Thu tiền hiện:", bodyText.toUpperCase().includes("THU TIỀN THEO NGÀY"));

console.log("\n=== LỖI BẮT ĐƯỢC (" + errs.length + ") ===");
for (const e of errs.slice(0, 30)) console.log(e);

await page2.screenshot({ path: "screenshots/debug-kpi-tmp.png" });
console.log("\nScreenshot: screenshots/debug-kpi-tmp.png");
await browser.close();
