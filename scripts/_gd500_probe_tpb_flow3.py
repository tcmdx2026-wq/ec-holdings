# -*- coding: utf-8 -*-
"""GĐ 500 — Probe luồng TPB mới bước 3: dropdown 'Sao kê' → tìm đường vào form xuất
sao kê (Tùy chỉnh/Excel/Xuất sao kê) + tab 'Sao kê đã xuất'. Chỉ-đọc (không bấm Xuất)."""
import sys
from pathlib import Path

AG = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent")
SEC = AG / ".secrets"
OUT = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/screenshots")
user = (SEC / "tpb_user.txt").read_text(encoding="utf-8").strip()
pwd = (SEC / "tpb_pass.txt").read_text(encoding="utf-8").strip()
TPB_BASE = "https://biz.tpb.vn"

from playwright.sync_api import sync_playwright

out = []
def log(m):
    print(m, flush=True)
    out.append(str(m))


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=False)
    context = browser.new_context(accept_downloads=True, viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.set_default_timeout(20000)

    page.goto(TPB_BASE, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    page.get_by_role("textbox", name="Nhập tên đăng nhập").click()
    page.get_by_role("textbox", name="Nhập tên đăng nhập").fill(user)
    page.get_by_role("textbox", name="Nhập mật khẩu").click()
    page.get_by_role("textbox", name="Nhập mật khẩu").fill(pwd)
    page.get_by_role("button", name="Đăng nhập").click()
    page.wait_for_timeout(6000)
    if page.get_by_role("textbox", name="Nhập tên đăng nhập").count() != 0:
        log("LOGIN FAIL"); browser.close(); sys.exit(1)
    log("login OK")
    page.wait_for_timeout(3000)

    # đóng modal intro: JS click nút Đóng → JS remove
    page.evaluate("() => { const b = document.querySelector('.v2-intro-modal__close-btn'); if (b) b.click(); }")
    page.wait_for_timeout(1200)
    if page.locator("div.v2-intro-modal").count():
        page.evaluate("() => document.querySelectorAll('.v2-intro-modal').forEach(e => e.remove())")
    page.wait_for_timeout(800)
    log(f"modal con: {page.locator('div.v2-intro-modal').count()}")

    # click 'Sao kê' (widget card) → dropdown
    page.get_by_text("Sao kê", exact=True).first.click(timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=str(OUT / "gd500-tpb-4-dropdown.png"))

    # dump item trong dropdown dang mo
    log("--- item trong popup/dropdown dang mo ---")
    for sel in ["[role=menuitem]", ".v2-dropdown-item", ".mat-mdc-menu-item", "mat-menu button", ".cdk-overlay-container button", ".cdk-overlay-container a", ".cdk-overlay-container [role=button]"]:
        loc = page.locator(sel)
        n = loc.count()
        if not n:
            continue
        log(f"[{sel}] count={n}")
        for i in range(min(n, 12)):
            el = loc.nth(i)
            try:
                if not el.is_visible():
                    continue
                t = (el.inner_text() or "").strip().replace("\n", " ")[:60]
                aria = el.get_attribute("aria-label") or ""
                log(f"    '{t}' | aria='{aria}'")
            except Exception:
                continue

    # thu click 'Sao kê tài khoản' neu co trong dropdown
    cand = page.get_by_text("Sao kê tài khoản", exact=True)
    log(f"'Sao kê tài khoản' count = {cand.count()}")
    if cand.count():
        try:
            cand.first.click(timeout=8000)
            page.wait_for_timeout(2500)
            log("da click 'Sao kê tài khoản'")
        except Exception as e:
            log(f"click 'Sao kê tài khoản' loi: {str(e)[:120]}")
        page.screenshot(path=str(OUT / "gd500-tpb-5-sao-ke-tk.png"))
        for probe in ["Tùy chỉnh", "Excel", "Xuất sao kê", "Sao kê đã xuất", "Từ ngày", "Đến ngày"]:
            try:
                log(f"   '{probe}' count = {page.get_by_text(probe, exact=True).count()}")
            except Exception:
                pass
        try:
            _txt = page.evaluate("() => document.body.innerText.slice(0, 900)")
            log("   innerText: " + str(_txt).replace(chr(10), " | "))
        except Exception:
            pass

    context.close()
    browser.close()

Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/scripts/_gd500_tpb_flow3.txt").write_text("\n".join(out), encoding="utf-8")
print("\n(luu: scripts/_gd500_tpb_flow3.txt + 2 anh gd500-tpb-4/5)")
