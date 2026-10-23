# -*- coding: utf-8 -*-
"""GĐ 500 — Probe luồng TPB MỚI đầy đủ: modal dong → Sao kê → Xuất sao kê → Tùy chỉnh
ngày → Excel → Xuất sao kê → Sao kê đã xuất → tải file. Lưu file vào thư mục TẠM."""
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

# nạp module tool để dùng _pick_date_in_calendar / log
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

    # 1) login
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
    log("1) login OK")
    page.wait_for_timeout(3000)

    # 2) đóng modal intro (JS click nút Đóng; fallback JS remove)
    page.evaluate("() => { const b = document.querySelector('.v2-intro-modal__close-btn'); if (b) b.click(); }")
    page.wait_for_timeout(1200)
    n_modal = page.locator("div.v2-intro-modal").count()
    if n_modal:
        page.evaluate("() => document.querySelectorAll('.v2-intro-modal').forEach(e => e.remove())")
        page.wait_for_timeout(600)
    log(f"2) dong modal: truoc={n_modal} sau={page.locator('div.v2-intro-modal').count()}")

    # 3) 'Sao kê' → 'Xuất sao kê'
    page.get_by_text("Sao kê", exact=True).first.click(timeout=15000)
    page.wait_for_timeout(1500)
    page.get_by_role("menuitem", name="Xuất sao kê").click(timeout=10000)
    page.wait_for_timeout(2500)
    log("3) da vao form 'Xuat sao ke'")
    page.screenshot(path=str(OUT / "gd500-tpb-8-form.png"))

    # 4) Tùy chỉnh ngày
    try:
        page.get_by_text("Tùy chỉnh", exact=True).first.click(timeout=8000)
        page.wait_for_timeout(1000)
        log(f"4) click 'Tuy chinh' OK — .icon-date count = {page.locator('.icon-date').count()}")
    except Exception as e:
        log(f"4) click 'Tuy chinh' LOI: {type(e).__name__}: {str(e)[:140]}")
    try:
        tpb._pick_date_in_calendar(page, DF, "Từ ngày", 0)
        tpb._pick_date_in_calendar(page, DT, "Đến ngày", 1)
        page.wait_for_timeout(600)
    except Exception as e:
        log(f"4b) chon ngay LOI: {type(e).__name__}: {str(e)[:160]}")
    page.screenshot(path=str(OUT / "gd500-tpb-9-dates.png"))

    # 5) Excel
    try:
        page.get_by_text("Excel", exact=True).first.click(timeout=8000)
        page.wait_for_timeout(500)
        log("5) click 'Excel' OK")
    except Exception as e:
        log(f"5) click 'Excel' LOI: {type(e).__name__}: {str(e)[:140]}")

    # 6) bấm nút Xuất sao kê (btn-primary trên form)
    try:
        btn = page.locator("button.btn-primary", has_text="Xuất sao kê").first
        if btn.count() == 0:
            btn = page.get_by_role("button", name="Xuất sao kê").last
        btn.click(timeout=10000)
        page.wait_for_timeout(3000)
        log("6) da bam 'Xuat sao ke' (form)")
    except Exception as e:
        log(f"6) bam 'Xuat sao ke' LOI: {type(e).__name__}: {str(e)[:160]}")
    page.screenshot(path=str(OUT / "gd500-tpb-10-after-export.png"))

    # 7) sang 'Sao kê đã xuất' — thu 2 duong
    log("7) tim duong vao 'Sao ke da xuat'...")
    try:
        _txt = page.evaluate("() => document.body.innerText.slice(0, 700)")
        log("   innerText: " + str(_txt).replace(chr(10), " | ")[:700])
    except Exception:
        pass
    dl = None
    for nav_try in range(1, 9):   # 8 lan x 15s = 2 phut cho TPB xu ly
        try:
            # mở dropdown Sao kê (nếu đang ở trang chủ)
            if page.get_by_text("Sao kê", exact=True).count():
                page.get_by_text("Sao kê", exact=True).first.click(timeout=8000)
                page.wait_for_timeout(1200)
            mi = page.get_by_role("menuitem", name="Sao kê đã xuất")
            if mi.count():
                mi.first.click(timeout=8000)
                page.wait_for_timeout(2500)
            rows = page.get_by_role("row")
            n = rows.count()
            log(f"   lan {nav_try}: rows = {n}")
            if n:
                for i in range(min(n, 6)):
                    try:
                        log(f"      row[{i}]: " + (rows.nth(i).inner_text() or "").replace(chr(10), " | ")[:110])
                    except Exception:
                        pass
                target = rows.filter(has_text=DF).filter(has_text=DT).first
                if target.count():
                    with page.expect_download(timeout=60_000) as dl_info:
                        target.get_by_role("button").first.click()
                    dl = dl_info.value
                    break
                log("      chua co row dung ky — cho 15s")
            page.wait_for_timeout(15000)
        except Exception as e:
            log(f"   lan {nav_try} loi: {type(e).__name__}: {str(e)[:130]}")
            page.wait_for_timeout(15000)

    if dl is not None:
        save = TMP / dl.suggested_filename
        dl.save_as(save)
        log(f"8) TAI THANH CONG: {dl.suggested_filename} ({save.stat().st_size} bytes)")
        page.screenshot(path=str(OUT / "gd500-tpb-11-downloaded.png"))
    else:
        log("8) KHONG tai duoc file (het 8 lan thu)")
        page.screenshot(path=str(OUT / "gd500-tpb-11-fail.png"))

    context.close()
    browser.close()

Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/scripts/_gd500_tpb_flow5.txt").write_text("\n".join(out), encoding="utf-8")
print("\n(luu: scripts/_gd500_tpb_flow5.txt)")
