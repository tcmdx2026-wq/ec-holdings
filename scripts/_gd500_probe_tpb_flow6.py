# -*- coding: utf-8 -*-
"""GĐ 500 — Probe TPB bước 6: sau Xuất sao kê → vào thẳng 'Sao kê đã xuất' (tab trên
trang) → dump danh sách → tải row đúng kỳ. Lưu file vào thư mục TẠM."""
import importlib.util
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

spec = importlib.util.spec_from_file_location("tpb_tool", AG / "42_tpb_saoke.py")
tpb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tpb)

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
    log(f"2) modal dong (con {page.locator('div.v2-intro-modal').count()})")

    # export (đã verify chạy được ở probe5) — làm lại nhanh để có row mới
    page.get_by_text("Sao kê", exact=True).first.click(timeout=15000)
    page.wait_for_timeout(1500)
    page.get_by_role("menuitem", name="Xuất sao kê").click(timeout=10000)
    page.wait_for_timeout(2500)
    page.get_by_text("Tùy chỉnh", exact=True).first.click(timeout=8000)
    page.wait_for_timeout(1000)
    tpb._pick_date_in_calendar(page, DF, "Từ ngày", 0)
    tpb._pick_date_in_calendar(page, DT, "Đến ngày", 1)
    page.get_by_text("Excel", exact=True).first.click(timeout=8000)
    page.wait_for_timeout(500)
    btn = page.locator("button.btn-primary", has_text="Xuất sao kê").first
    if btn.count() == 0:
        btn = page.get_by_role("button", name="Xuất sao kê").last
    btn.click(timeout=10000)
    page.wait_for_timeout(3000)
    log("3) da xuat sao ke ky " + DF)

    dl = None
    for attempt in range(1, 13):
        try:
            # vào tab 'Sao kê đã xuất' trên CHÍNH trang Xuất sao kê
            link = page.get_by_text("Sao kê đã xuất", exact=True)
            if link.count():
                link.first.click(timeout=8000)
                page.wait_for_timeout(2500)
            rows = page.get_by_role("row")
            n = rows.count()
            log(f"   lan {attempt}: 'Sao kê đã xuất' count={link.count()} | rows={n}")
            for i in range(min(n, 5)):
                try:
                    log(f"      row[{i}]: " + (rows.nth(i).inner_text() or "").replace(chr(10), " | ")[:120])
                except Exception:
                    pass
            if n:
                target = rows.filter(has_text=DF).filter(has_text=DT).first
                if target.count():
                    with page.expect_download(timeout=60_000) as dl_info:
                        target.get_by_role("button").first.click()
                    dl = dl_info.value
                    break
                log("      chua co row dung ky")
            if attempt == 1:
                page.screenshot(path=str(OUT / "gd500-tpb-12-da-xuat-list.png"))
                try:
                    _txt = page.evaluate("() => document.body.innerText.slice(0, 900)")
                    log("   innerText: " + str(_txt).replace(chr(10), " | ")[:900])
                except Exception:
                    pass
            page.wait_for_timeout(15000)
        except Exception as e:
            log(f"   lan {attempt} loi: {type(e).__name__}: {str(e)[:130]}")
            page.wait_for_timeout(15000)

    if dl is not None:
        save = TMP / dl.suggested_filename
        dl.save_as(save)
        log(f"4) TAI THANH CONG: {dl.suggested_filename} ({save.stat().st_size} bytes)")
        page.screenshot(path=str(OUT / "gd500-tpb-13-downloaded.png"))
    else:
        log("4) KHONG tai duoc file")
        page.screenshot(path=str(OUT / "gd500-tpb-13-fail.png"))

    context.close()
    browser.close()

Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/scripts/_gd500_tpb_flow6.txt").write_text("\n".join(out), encoding="utf-8")
print("\n(luu: scripts/_gd500_tpb_flow6.txt)")
