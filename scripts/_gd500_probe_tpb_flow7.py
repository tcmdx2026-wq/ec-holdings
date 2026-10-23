# -*- coding: utf-8 -*-
"""GĐ 500 — Probe TPB bước 7: vào 'Sao kê đã xuất' từ trang chủ (dropdown) → dump DOM
danh sách → tải row đúng kỳ nếu có. Lưu file vào thư mục TẠM."""
import sys
from pathlib import Path

AG = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent")
SEC = AG / ".secrets"
OUT = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/screenshots")
TMP = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/scripts/_gd500_tpb_test")
TMP.mkdir(parents=True, exist_ok=True)
user = (SEC / "tpb_user.txt").read_text(encoding="utf-8").strip()
pwd = (SEC / "tpb_pass.txt").read_text(encoding="utf-8").strip()
TPB_BASE = "https://biz.tpb.vn"
DF, DT = "18/10/2026", "18/10/2026"

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
    log("1) login OK")
    page.wait_for_timeout(3000)
    page.evaluate("() => { const b = document.querySelector('.v2-intro-modal__close-btn'); if (b) b.click(); }")
    page.wait_for_timeout(1200)
    if page.locator("div.v2-intro-modal").count():
        page.evaluate("() => document.querySelectorAll('.v2-intro-modal').forEach(e => e.remove())")
    log("2) modal dong")

    # vào danh sách
    page.get_by_text("Sao kê", exact=True).first.click(timeout=15000)
    page.wait_for_timeout(1500)
    page.get_by_role("menuitem", name="Sao kê đã xuất").click(timeout=10000)
    page.wait_for_timeout(3000)
    page.screenshot(path=str(OUT / "gd500-tpb-14-danh-sach.png"))
    try:
        _txt = page.evaluate("() => document.body.innerText.slice(0, 1200)")
        log("3) innerText: " + str(_txt).replace(chr(10), " | ")[:1200])
    except Exception:
        pass

    for sel in ["[role=row]", "tr", ".v2-card", "[class*='statement']", "[class*='statement-item']", "app-icon-v2", "button"]:
        loc = page.locator(sel)
        n = loc.count()
        if n:
            log(f"   [{sel}] count={n}")
            for i in range(min(n, 8)):
                el = loc.nth(i)
                try:
                    if not el.is_visible():
                        continue
                    t = (el.inner_text() or "").strip().replace("\n", " | ")[:100]
                    aria = el.get_attribute("aria-label") or ""
                    cls = (el.get_attribute("class") or "")[:45]
                    log(f"      '{t}' aria='{aria}' cls='{cls}'")
                except Exception:
                    continue

    # tải row đúng kỳ nếu có
    dl = None
    rows = page.get_by_role("row")
    if rows.count():
        target = rows.filter(has_text=DF).filter(has_text=DT).first
        log(f"4) rows={rows.count()} | row dung ky count={target.count()}")
        if target.count():
            try:
                log("   row text: " + (target.inner_text() or "").replace(chr(10), " | ")[:200])
                btns = target.get_by_role("button")
                log(f"   row co {btns.count()} button")
                with page.expect_download(timeout=60_000) as dl_info:
                    (btns.first if btns.count() else target).click()
                dl = dl_info.value
            except Exception as e:
                log(f"   tai row loi: {type(e).__name__}: {str(e)[:180]}")
    else:
        log("4) KHONG co [role=row] nao")

    if dl is not None:
        save = TMP / dl.suggested_filename
        dl.save_as(save)
        log(f"5) TAI THANH CONG: {dl.suggested_filename} ({save.stat().st_size} bytes)")
    else:
        log("5) chua tai duoc")

    context.close()
    browser.close()

Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/scripts/_gd500_tpb_flow7.txt").write_text("\n".join(out), encoding="utf-8")
print("\n(luu: scripts/_gd500_tpb_flow7.txt)")
