# -*- coding: utf-8 -*-
"""GĐ 500 — Probe luồng TPB sau khi TPB đổi UI: đóng modal → xem UI → tìm đường vào
'Sao kê tài khoản'. Lưu 4 ảnh chụp để soi. Chỉ-đọc."""
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


def dump_clicks(page, tag):
    """Liệt kê các phần tử bấm được đang hiển thị."""
    log(f"--- {tag}: phan tu bam duoc (visible) ---")
    for sel in ["button", "a", "[role=button]"]:
        loc = page.locator(sel)
        n = loc.count()
        shown = 0
        for i in range(n):
            el = loc.nth(i)
            try:
                if not el.is_visible():
                    continue
                txt = (el.inner_text() or "").strip().replace("\n", " ")[:45]
                aria = el.get_attribute("aria-label") or ""
                cls = (el.get_attribute("class") or "")[:40]
                log(f"   <{sel}> '{txt}' aria='{aria}' cls='{cls}'")
                shown += 1
                if shown >= 18:
                    return
            except Exception:
                continue


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=False)
    context = browser.new_context(accept_downloads=True, viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.set_default_timeout(20000)

    log("1) login...")
    page.goto(TPB_BASE, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    page.get_by_role("textbox", name="Nhập tên đăng nhập").click()
    page.get_by_role("textbox", name="Nhập tên đăng nhập").fill(user)
    page.get_by_role("textbox", name="Nhập mật khẩu").click()
    page.get_by_role("textbox", name="Nhập mật khẩu").fill(pwd)
    page.get_by_role("button", name="Đăng nhập").click()
    page.wait_for_timeout(6000)
    if page.get_by_role("textbox", name="Nhập tên đăng nhập").count() != 0:
        log("   LOGIN FAIL"); browser.close(); sys.exit(1)
    log("   login OK")
    page.wait_for_timeout(3000)
    page.screenshot(path=str(OUT / "gd500-tpb-1-logged.png"))
    dump_clicks(page, "sau login (modal mo)")

    # ── đóng modal: thử JS click nút Đóng → force click → JS remove ──
    log("2) dong modal intro:")
    try:
        page.evaluate("() => { const b = document.querySelector('.v2-intro-modal__close-btn'); if (b) b.click(); }")
        page.wait_for_timeout(1200)
        left = page.locator("div.v2-intro-modal").count()
        log(f"   JS click nut Dong -> modal con: {left}")
    except Exception as e:
        log(f"   JS click loi: {e}")
    if page.locator("div.v2-intro-modal").count():
        try:
            page.evaluate("() => document.querySelectorAll('.v2-intro-modal').forEach(e => e.remove())")
            page.wait_for_timeout(800)
            log(f"   JS remove -> modal con: {page.locator('div.v2-intro-modal').count()}")
        except Exception as e:
            log(f"   JS remove loi: {e}")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / "gd500-tpb-2-modal-closed.png"))

    # ── click 'Sao kê' ──
    log("3) click 'Sao kê' (exact, first):")
    n = page.get_by_text("Sao kê", exact=True).count()
    log(f"   so element = {n}")
    try:
        page.get_by_text("Sao kê", exact=True).first.click(timeout=8000)
        log("   click OK")
    except Exception as e:
        log(f"   click thuong loi: {type(e).__name__} -> thu force")
        try:
            page.get_by_text("Sao kê", exact=True).first.click(force=True, timeout=8000)
            log("   force click OK")
        except Exception as e2:
            log(f"   force cung loi: {type(e2).__name__}: {str(e2)[:150]}")
    page.wait_for_timeout(2500)
    page.screenshot(path=str(OUT / "gd500-tpb-3-sau-click-sao-ke.png"))
    dump_clicks(page, "sau click 'Sao kê'")
    log(f"   'Sao kê tài khoản' count = {page.get_by_text('Sao kê tài khoản').count()}")
    try:
        _txt = page.evaluate("() => document.body.innerText.slice(0, 700)")
        log("   innerText dau trang: " + str(_txt).replace(chr(10), " | "))
    except Exception:
        pass

    context.close()
    browser.close()

Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/scripts/_gd500_tpb_flow2.txt").write_text("\n".join(out), encoding="utf-8")
print("\n(luu: scripts/_gd500_tpb_flow2.txt + 3 anh screenshots/gd500-tpb-*.png)")
