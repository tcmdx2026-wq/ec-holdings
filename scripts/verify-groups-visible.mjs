/**
 * Verify tên nhóm HIỂN THỊ THẬT (visible) — không chỉ có trong HTML (bài học 0.3.2/0.3.3).
 * Desktop: thu hẹp → ẨN nhóm là đúng; hover mở 320px → PHẢI THẤY tên nhóm HOA.
 * Mobile: mở drawer → PHẢI THẤY tên nhóm.
 */
import { chromium } from "playwright";

const URL = process.argv[2] ?? "https://giong-banhang.vercel.app";
const GROUPS = ["ĐIỀU HÀNH", "LẤY DỮ LIỆU TỪ MISAmeInvoice", "LẤY DỮ LIỆU TỪ SMED - BÁN HÀNG", "LẤY DỮ LIỆU TỪ SMED - KHO", "LẤY DỮ LIỆU TỪ SMED - MARKETING", "BÁO CÁO", "UPLOAD - MISA AMIS"];

const browser = await chromium.launch({ headless: true });

// --- Desktop ---
const p1 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p1.goto(URL, { waitUntil: "networkidle" });
await p1.waitForTimeout(2500);

const visibleGroups = async () =>
  p1.evaluate((names) => {
    return names.map((n) => {
      // tìm <p> chứa đúng tên nhóm và đang visible (có rect + không display:none)
      const els = [...document.querySelectorAll("nav p")];
      const el = els.find((e) => e.textContent?.trim() === n);
      if (!el) return { n, found: false, visible: false };
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible = style.display !== "none" && rect.width > 0 && rect.height > 0;
      return { n, found: true, visible, w: Math.round(rect.width) };
    });
  }, GROUPS);

const collapsedState = await visibleGroups();
await p1.hover("aside.group");
await p1.waitForTimeout(700);
const hoverState = await visibleGroups();
await p1.close();

const collapsedHidden = collapsedState.filter((s) => !s.visible).length;
const hoverVisible = hoverState.filter((s) => s.visible && s.found).length;
console.log("=== DESKTOP ===");
console.log(`${collapsedHidden === 7 ? "✅" : "⚠️"} Thu hẹp: ${collapsedHidden}/7 nhóm ẩn (đúng thiết kế)`);
console.log(`${hoverVisible === 7 ? "✅" : "❌"} Hover mở 320px: ${hoverVisible}/7 nhóm HIỂN THỊ`);
for (const s of hoverState) if (!s.visible || !s.found) console.log(`  ❌ "${s.n}" ${s.found ? "bị ẩn" : "KHÔNG TỒN TẠI trong DOM"}`);

// --- Mobile drawer ---
const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p2.goto(URL, { waitUntil: "networkidle" });
await p2.waitForTimeout(2500);
await p2.locator('header button[aria-label="Mở menu"]').click();
await p2.waitForTimeout(600);
const mobileState = await p2.evaluate((names) => {
  return names.map((n) => {
    const els = [...document.querySelectorAll("nav p")];
    const el = els.find((e) => e.textContent?.trim() === n && e.getBoundingClientRect().width > 0);
    return { n, visible: !!el };
  });
}, GROUPS);
await p2.close();
await browser.close();

const mobileVisible = mobileState.filter((s) => s.visible).length;
console.log("=== MOBILE drawer ===");
console.log(`${mobileVisible === 7 ? "✅" : "❌"} ${mobileVisible}/7 nhóm HIỂN THỊ`);
for (const s of mobileState) if (!s.visible) console.log(`  ❌ "${s.n}" không thấy`);

const pass = hoverVisible === 7 && mobileVisible === 7;
console.log(`\n=== ${pass ? "TẤT CẢ ĐẠT" : "CÒN LỖI"} ===`);
process.exit(pass ? 0 : 1);
