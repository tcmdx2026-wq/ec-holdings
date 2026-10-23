/**
 * E2E test SSO flow (GĐ B hệ sinh thái) — tạm thời, xóa sau khi dùng.
 * 1. Login app tổng → kiểm tra nút Bán hàng (nhóm DỰ ÁN)
 * 2. Bấm nút → tab mới mở app con ?sso=… → verify phiên tự tạo
 * 3. Kiểm tra tên user hiện trên trang chủ app con
 * 4. Đăng xuất app con → mở lại app tổng vẫn còn phiên
 */
import { chromium } from "playwright";

const MAIN = "https://giong-vn-v6.vercel.app";
const CHILD = "https://giong-banhang.vercel.app";
const EMAIL = "cuongpk.giong04@gmail.com";
const PASSWORD = "Admin123!";

const results = [];
function log(step, ok, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${step}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  // 1. Login app tổng
  await page.goto(MAIN + "/login", { waitUntil: "networkidle", timeout: 60000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(MAIN + "/", { timeout: 60000 });
  await page.waitForTimeout(8000); // đợi hydrate Neon + nav render
  log("1. Login app tổng", true, page.url());

  // 2. Tìm nút Bán hàng trên sidebar
  const sellBtn = page.locator('a[href*="giong-banhang"]').first();
  const btnVisible = await sellBtn.isVisible().catch(() => false);
  log("2. Nút Bán hàng trên sidebar", btnVisible, btnVisible ? "" : "KHÔNG thấy nút");

  if (btnVisible) {
    // 3. Bấm → chờ tab mới (SSO handoff)
    const [childPage] = await Promise.all([
      context.waitForEvent("page", { timeout: 30000 }),
      sellBtn.click(),
    ]);
    await childPage.waitForLoadState("networkidle", { timeout: 60000 });
    const childUrl = childPage.url();
    log("3. Tab app con mở", childUrl.includes("giong-banhang"), childUrl);

    // 4. Token không còn nằm trong URL (đã redirect sạch)
    const urlClean = !childUrl.includes("sso=");
    log("4. URL sạch (không còn ?sso=)", urlClean, childUrl);

    // 5. Trang chủ app con hiện phiên user (SSO tự đăng nhập)
    await childPage.waitForTimeout(3000);
    const bodyText = await childPage.locator("body").innerText();
    const hasName = bodyText.includes("Phạm Kiên Cường");
    const hasSession = bodyText.includes("phiên 7 ngày");
    const hasLogout = bodyText.includes("Đăng xuất");
    log("5. Hiện tên user (SSO OK)", hasName);
    log("6. Hiện thông tin phiên 7 ngày", hasSession);
    log("7. Nút Đăng xuất hiện", hasLogout);

    // 6. Cookie bh_session đã set
    const cookies = await context.cookies(CHILD);
    const sessionCookie = cookies.find((c) => c.name === "bh_session");
    log("8. Cookie bh_session", !!sessionCookie, sessionCookie ? "httpOnly=" + sessionCookie.httpOnly : "không có");

    // 7. Vào lại app con trực tiếp trong 7 ngày — vẫn còn phiên
    await childPage.goto(CHILD + "/", { waitUntil: "networkidle" });
    await childPage.waitForTimeout(2000);
    const bodyAgain = await childPage.locator("body").innerText();
    log("9. Vào lại app con còn phiên", bodyAgain.includes("Đăng xuất"));

    // 8. /api/auth/me trả user đúng
    const me = await childPage.evaluate(() => fetch("/api/auth/me").then((r) => r.json()));
    log("10. /api/auth/me trả user", !!me.user, me.user ? me.user.name + " / " + me.user.role : JSON.stringify(me));

    // 9. Đăng xuất app con — phiên app tổng phải còn nguyên
    await childPage.goto(CHILD + "/api/auth/logout");
    await childPage.waitForLoadState("networkidle");
    const afterLogout = await childPage.locator("body").innerText();
    const loggedOut = !afterLogout.includes("Đăng xuất") || afterLogout.includes("Chưa có phiên");
    log("11. Đăng xuất app con OK", loggedOut);
    const cookiesAfter = await context.cookies(CHILD);
    log("12. Cookie bh_session đã xóa", !cookiesAfter.find((c) => c.name === "bh_session"));

    // 10. App tổng vẫn còn đăng nhập
    await page.bringToFront();
    await page.goto(MAIN + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    const mainText = await page.locator("body").innerText();
    log("13. App tổng giữ nguyên phiên", mainText.includes("Phạm Kiên Cường") || !page.url().includes("login"));
  }
} catch (err) {
  log("LỖI NGOÀI DỰ KIẾN", false, err instanceof Error ? err.message : String(err));
}

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n===== KẾT QUẢ: ${passed}/${results.length} pass =====`);
process.exit(passed === results.length ? 0 : 1);
