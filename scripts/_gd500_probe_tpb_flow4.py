# -*- coding: utf-8 -*-
"""GĐ 500 — Probe luồng TPB bước 4: 'Xuất sao kê' (form) + 'Sao kê đã xuất' (tab tải file).
KHÔNG bấm nút xuất/xác nhận cuối (chỉ xem form). Chỉ-đọc."""
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


def dump_screen(page, tag):
    log(f"--- {tag} ---")
    try:
        txt = page.evaluate("() => document.body.innerText.slice(0, 1100)")
        log("innerText: " + str(txt).replace(chr(10), " | "))
    except Exception:
        pass
    for sel in ["button", "input", "mat-select"]:
        loc = page.locator(sel)
        n = loc.count()
        shown = 0
        for i in range(n):
            el = loc.nth(i)
            try:
                if not el.is_visible():
                    continue
                t = (el.inner_text() or "").strip().replace("\n", " ")[:40]
                aria = el.get_attribute("aria-label") or ""
                ph = el.get_attribute("placeholder") or ""
                cls = (el.get_attribute("class") or "")[:38]
                log(f"   <{sel}> '{t}' aria='{aria}' ph='{ph}' cls='{cls}'")
                shown += 1
                if shown >= 25:
                    break
            except Exception:
                continue


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
    page.evaluate("() => { const b = document.querySelector('.v2-intro-modal__close-btn'); if (b) b.click(); }")
    page.wait_for_timeout(1200)
    if page.locator("div.v2-intro-modal").count():
        page.evaluate("() => document.querySelectorAll('.v2-intro-modal').forEach(e => e.remove())")
    page.wait_for_timeout(800)

    # mở dropdown 'Sao kê'
    page.get_by_text("Sao kê", exact=True).first.click(timeout=15000)
    page.wait_for_timeout(1500)

    # ── A. Xem form 'Xuất sao kê' ──
    log("A) click 'Xuất sao kê' ...")
    try:
        page.get_by_role("menuitem", name="Xuất sao kê").click(timeout=10000)
        page.wait_for_timeout(2500)
        page.screenshot(path=str(OUT / "gd500-tpb-6-form-xuat.png"))
        dump_screen(page, "sau 'Xuất sao kê'")
    except Exception as e:
        log(f"   loi: {type(e).__name__}: {str(e)[:150]}")

    # đóng form nếu có nút Hủy/Đóng (không bấm xuất)
    for t in ["Hủy", "Đóng", "Quay lại", "Cancel"]:
        try:
            b = page.get_by_role("button", name=t)
            if b.count() and b.first.is_visible():
                log(f"   (thay nut '{t}' — KHONG bam, chi liet ke)")
        except Exception:
            pass
    # press Escape để đóng
    try:
        page.keyboard.press("Escape"); page.wait_for_timeout(1200)
    except Exception:
        pass

    # ── B. Xem tab 'Sao kê đã xuất' ──
    log("B) click 'Sao kê' -> 'Sao kê đã xuất' ...")
    try:
        page.get_by_text("Sao kê", exact=True).first.click(timeout=15000)
        page.wait_for_timeout(1500)
        page.get_by_role("menuitem", name="Sao kê đã xuất").click(timeout=10000)
        page.wait_for_timeout(2500)
        page.screenshot(path=str(OUT / "gd500-tpb-7-da-xuat.png"))
        dump_screen(page, "sau 'Sao kê đã xuất'")
    except Exception as e:
        log(f"   loi: {type(e).__name__}: {str(e)[:150]}")

    context.close()
    browser.close()

Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/scripts/_gd500_tpb_flow4.txt").write_text("\n".join(out), encoding="utf-8")
print("\n(luu: scripts/_gd500_tpb_flow4.txt + 2 anh gd500-tpb-6/7)")
