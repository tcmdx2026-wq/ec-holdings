# -*- coding: utf-8 -*-
"""GĐ 500 — Probe modal giới thiệu TPB (v2-intro-modal) + thử các cách đóng.
Chỉ-đọc (không tải/không sửa gì trên TPB)."""
import sys
from pathlib import Path

AG = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent")
SEC = AG / ".secrets"
user = (SEC / "tpb_user.txt").read_text(encoding="utf-8").strip()
pwd = (SEC / "tpb_pass.txt").read_text(encoding="utf-8").strip()
TPB_BASE = "https://biz.tpb.vn"

from playwright.sync_api import sync_playwright

out = []
def log(m):
    print(m, flush=True)
    out.append(m)

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=False)
    context = browser.new_context(accept_downloads=True)
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
    ok = page.get_by_role("textbox", name="Nhập tên đăng nhập").count() == 0
    log(f"   login OK = {ok}")
    if not ok:
        browser.close(); sys.exit(1)

    page.wait_for_timeout(3000)

    # ── Modal intro ──
    modal = page.locator("div.v2-intro-modal")
    log(f"2) modal count = {modal.count()}")
    if modal.count():
        try:
            html = modal.first.evaluate("el => el.outerHTML")
            log("--- outerHTML (2500 ky tu dau) ---")
            log(html[:2500])
        except Exception as e:
            log(f"   loi lay outerHTML: {e}")
        # các nút bên trong
        btns = page.locator("div.v2-intro-modal button, div.v2-intro-modal [role=button], div.v2-intro-modal img, div.v2-intro-modal span.v2-icon, div.v2-intro-modal i")
        n = btns.count()
        log(f"3) phan tu bam duoc trong modal: {n}")
        for i in range(min(n, 15)):
            el = btns.nth(i)
            try:
                info = el.evaluate("el => ({tag: el.tagName, cls: el.className, aria: el.getAttribute('aria-label'), txt: (el.innerText||'').slice(0,40)})")
                log(f"   [{i}] {info}")
            except Exception as e:
                log(f"   [{i}] loi: {e}")

        # ── thử các cách đóng ──
        def modal_open():
            try:
                return page.locator("div.v2-intro-modal.v2-intro-modal--open").count() > 0 or page.locator("div.v2-intro-modal").count() > 0
            except Exception:
                return False

        tried = []
        def try_close(name, fn):
            if not modal_open():
                return True
            try:
                fn()
                page.wait_for_timeout(1500)
                still = modal_open()
                tried.append(f"{name}: {'ĐÓNG ĐƯỢC' if not still else 'chưa đóng'}")
                log(f"   thu {name} -> {'OK' if not still else 'chua dong'}")
                return not still
            except Exception as e:
                tried.append(f"{name}: LỖI {type(e).__name__} {str(e)[:80]}")
                log(f"   thu {name} -> LOI {type(e).__name__}: {str(e)[:100]}")
                return False

        if modal_open():
            try_close("Escape", lambda: page.keyboard.press("Escape"))
        if modal_open():
            try_close("nut aria-label close", lambda: page.locator("div.v2-intro-modal button[aria-label], div.v2-intro-modal [aria-label*='óng'], div.v2-intro-modal [aria-label*='lose']").first.click())
        if modal_open():
            try_close("element class *close*", lambda: page.locator("div.v2-intro-modal [class*='close'], div.v2-intro-modal [class*='Close']").first.click())
        if modal_open():
            try_close("anh/icon cuoi modal", lambda: page.locator("div.v2-intro-modal img, div.v2-intro-modal i, div.v2-intro-modal span").last.click())
        if modal_open():
            try_close("JS remove modal", lambda: page.evaluate("document.querySelectorAll('.v2-intro-modal').forEach(e => e.remove())"))

        log("--- KET QUA THU DONG ---")
        for t in tried:
            log("   " + t)

    # ── sau khi đóng: click 'Sao kê' ──
    log("4) kiem tra 'Sao kê' sau khi dong modal:")
    cnt = page.get_by_text("Sao kê", exact=True).count()
    log(f"   so element 'Sao kê' (exact) = {cnt}")
    try:
        page.get_by_text("Sao kê", exact=True).first.click(timeout=15000)
        page.wait_for_timeout(2000)
        vis = page.get_by_text("Sao kê tài khoản").first.is_visible()
        log(f"   click 'Sao kê'.first OK — thay 'Sao kê tài khoản' = {vis}")
    except Exception as e:
        log(f"   click 'Sao kê' LOI: {type(e).__name__}: {str(e)[:200]}")

    context.close()
    browser.close()

Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/scripts/_gd500_tpb_modal_probe.txt").write_text("\n".join(out), encoding="utf-8")
print("\n(ket qua da luu scripts/_gd500_tpb_modal_probe.txt)")
