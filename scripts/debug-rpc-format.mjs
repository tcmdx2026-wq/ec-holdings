/** Capture request _serverFn mà browser gửi (tạo job) — tạm thời. */
import { chromium } from "playwright";

const MAIN = "https://giong-vn-v6.vercel.app";
const CHILD = "https://giong-banhang.vercel.app";
const EMAIL = "cuongpk.giong04@gmail.com";
const PASSWORD = "Admin123!";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

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
await childPage.goto(CHILD + "/m/smed-hdd", { waitUntil: "networkidle" });
await childPage.waitForTimeout(3000);

// Bắt request POST _serverFn khi bấm tạo job
const captured = [];
childPage.on("request", (req) => {
  if (req.url().includes("_serverFn") && req.method() === "POST") {
    captured.push({
      url: req.url(),
      headers: req.headers(),
      body: req.postData(),
    });
  }
});

const d = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
await childPage.fill('input[type="date"] >> nth=0', d);
await childPage.fill('input[type="date"] >> nth=1', d);
await childPage.click('button:has-text("Lấy dữ liệu 19 trung tâm")');
await childPage.waitForTimeout(6000);

console.log("===== REQUEST RPC BROWSER GỬI =====");
for (const c of captured) {
  console.log("URL:", c.url);
  console.log("HEADERS:", JSON.stringify(c.headers, null, 2));
  console.log("BODY (first 400):", (c.body ?? "").slice(0, 400));
  console.log("---");
}
await browser.close();
