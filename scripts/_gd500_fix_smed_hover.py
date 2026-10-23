# -*- coding: utf-8 -*-
"""GĐ 500 — Fix 4 tool: retry hover lâu dần (3 SMED) + .first 'Sao kê' (TPB).
Sửa theo kiểu surgical: replace đúng 1 đoạn, giữ nguyên byte phần còn lại
(không đổi line-ending của file)."""
from pathlib import Path

AG = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent")


def fix(fname, old_lines, new_lines):
    p = AG / fname
    raw = p.read_bytes().decode("utf-8")
    nl = "\r\n" if "\r\n" in raw else "\n"
    old = nl.join(old_lines)
    new = nl.join(new_lines)
    n = raw.count(old)
    assert n == 1, f"{fname}: khop {n} lan (can dung 1)"
    p.write_bytes(raw.replace(old, new, 1).encode("utf-8"))
    print(f"OK {fname}: +{len(new_lines)-len(old_lines)} dong")


# ── FIX 1: 5_smed_XUATKHO.py — hover 'Kho' co retry ─────────────────────────
fix("5_smed_XUATKHO.py", [
    '        # 1️⃣ HIỆN THANH SIDEBAR',
    '        logger.info("🖱️ Di chuột sang trái để hiện Sidebar...")',
    '        page.mouse.move(50, 150)',
    '        time.sleep(1)',
    '        ',
    '        # 2️⃣ CLICK "KHO"',
    '        logger.info("📦 Click vào menu \'Kho\'...")',
    '        page.get_by_role("link", name="\uead2 Kho").click()',
    '        time.sleep(1)',
], [
    '        # 1️⃣ HIỆN THANH SIDEBAR + 2️⃣ CLICK "KHO"',
    '        # GĐ 500 (21/10): SMED sidebar render CHẬM hơn bình thường — hover ngắn',
    '        # (1s) trượt menu \'Kho\' làm xuatkho FAIL 2 lần tối 21/10 (tool 4 nhapkho',
    '        # cùng lúc thoát nhờ fallback hover lâu hơn 2 điểm). Thử 3 lần hover lâu',
    '        # dần; lần 2/3 dùng đúng pattern fallback của tool 4 đã chạy OK.',
    '        logger.info("🖱️ Di chuột sang trái để hiện Sidebar...")',
    '        kho_link = page.get_by_role("link", name="\uead2 Kho")',
    '        last_err = None',
    '        for attempt, (moves, gap, timeout) in enumerate([',
    '            ([(50, 150)], 1.0, 15000),               # lần 1: như cũ',
    '            ([(20, 100), (100, 100)], 2.0, 10000),   # lần 2: hover lâu hơn (mẫu tool 4)',
    '            ([(10, 120), (120, 120)], 2.5, 10000),   # lần 3: lâu hơn nữa',
    '        ], start=1):',
    '            try:',
    '                for x, y in moves:',
    '                    page.mouse.move(x, y)',
    '                    time.sleep(gap)',
    '                logger.info(f"📦 Click vào menu \'Kho\' (lần {attempt})...")',
    '                kho_link.click(timeout=timeout)',
    '                time.sleep(1)',
    '                last_err = None',
    '                break',
    '            except Exception as e:',
    '                last_err = e',
    '                logger.warning(f"⚠️ Menu \'Kho\' chưa hiện (lần {attempt}): {e}")',
    '        if last_err is not None:',
    '            raise last_err',
])

# ── FIX 2: 7_smed_BCNXT.py — nav co retry hover ─────────────────────────────
fix("7_smed_BCNXT.py", [
    '    def navigate_to_report(self, page):',
    '        logger.info("📂 Đang điều hướng đến báo cáo Nhập Xuất Tồn...")',
    '        try:',
    '',
    '            # 2. Hover mở menu',
    '            page.mouse.move(30, 150); time.sleep(0.25)',
    '            page.mouse.move(80, 150); time.sleep(Config.SIDEBAR_HOVER_DELAY)',
    '',
    '            # 3. Click Kho — GĐ C.9 FIX (15/09/2026): domain 2 menu render chậm hơn,',
    '            # timeout 5s bị THIẾU → trang chính load xong menu chưa kịp hiện.',
    '            # Đồng bộ với tool 4 (nhapkho chạy OK): timeout 15s + scroll_into_view.',
    '            kho_link = page.get_by_role("link", name="Kho").first',
    '            kho_link.wait_for(state="visible", timeout=15000)',
    '            kho_link.scroll_into_view_if_needed()',
    '            time.sleep(0.3)',
    '            kho_link.click()',
    '            time.sleep(Config.WAIT_MENU_RENDER)',
    '            page.mouse.move(400, 300); time.sleep(0.2)',
    '',
    '            # 4. Click Báo cáo xuất nhập tồn - ✅ Tối ưu: Thêm timeout cho networkidle',
    '            page.get_by_role("link", name="Báo cáo xuất nhập tồn").click()',
    '            page.wait_for_load_state("networkidle", timeout=10000)  # ✅ Tránh treo máy nếu có request ngầm',
    '            time.sleep(0.3)  # ✅ Giảm từ 0.5s',
    '',
    '            # 5. Click tab "Kế toán" thứ 2',
    '            try:',
    '                ke_toan_tabs = page.get_by_text("Kế toán")',
    '                if ke_toan_tabs.count() >= 2:',
    '                    ke_toan_tabs.nth(1).click()',
    '                    time.sleep(Config.WAIT_AFTER_CLICK_TAB)',
    '                    logger.info("✅ Đã click tab \'Kế toán\' thứ 2")',
    '            except Exception as e:',
    '                logger.warning(f"⚠️ Lỗi click tab Kế toán: {e}")',
    '',
    '            # 6. Chọn ngày tháng',
    '            self._select_date_range(page)',
    '            logger.info("✅ Hoàn thành điều hướng")',
    '            ',
    '        except Exception as e:',
    '            logger.error(f"❌ Lỗi điều hướng: {e}")',
    '            raise',
], [
    '    def navigate_to_report(self, page):',
    '        logger.info("📂 Đang điều hướng đến báo cáo Nhập Xuất Tồn...")',
    '',
    '        # GĐ 500 (21/10): SMED sidebar render CHẬM hơn bình thường — hover ngắn',
    '        # (Config.SIDEBAR_HOVER_DELAY) trượt menu \'Kho\' làm xnkt FAIL 2 lần tối',
    '        # 21/10 (tool 4 nhapkho cùng lúc thoát nhờ fallback hover lâu hơn 2 điểm).',
    '        # Thử 3 lần hover lâu dần; lần 2/3 dùng đúng pattern fallback của tool 4.',
    '        last_err = None',
    '        for attempt, (moves, gap) in enumerate([',
    '            ([(30, 150), (80, 150)], Config.SIDEBAR_HOVER_DELAY),  # lần 1: như cũ',
    '            ([(20, 100), (100, 100)], 2.0),                        # lần 2: hover lâu hơn (mẫu tool 4)',
    '            ([(10, 120), (120, 120)], 2.5),                        # lần 3: lâu hơn nữa',
    '        ], start=1):',
    '            try:',
    '                for x, y in moves:',
    '                    page.mouse.move(x, y); time.sleep(gap)',
    '',
    '                # Click Kho — GĐ C.9 FIX (15/09/2026): domain 2 menu render chậm hơn,',
    '                # timeout 5s bị THIẾU → trang chính load xong menu chưa kịp hiện.',
    '                kho_link = page.get_by_role("link", name="Kho").first',
    '                kho_link.wait_for(state="visible", timeout=15000 if attempt == 1 else 10000)',
    '                kho_link.scroll_into_view_if_needed()',
    '                time.sleep(0.3)',
    '                kho_link.click()',
    '                time.sleep(Config.WAIT_MENU_RENDER)',
    '                page.mouse.move(400, 300); time.sleep(0.2)',
    '',
    '                # Click Báo cáo xuất nhập tồn - ✅ Tối ưu: Thêm timeout cho networkidle',
    '                page.get_by_role("link", name="Báo cáo xuất nhập tồn").click()',
    '                page.wait_for_load_state("networkidle", timeout=10000)  # ✅ Tránh treo máy nếu có request ngầm',
    '                time.sleep(0.3)  # ✅ Giảm từ 0.5s',
    '',
    '                # Click tab "Kế toán" thứ 2',
    '                try:',
    '                    ke_toan_tabs = page.get_by_text("Kế toán")',
    '                    if ke_toan_tabs.count() >= 2:',
    '                        ke_toan_tabs.nth(1).click()',
    '                        time.sleep(Config.WAIT_AFTER_CLICK_TAB)',
    '                        logger.info("✅ Đã click tab \'Kế toán\' thứ 2")',
    '                except Exception as e:',
    '                    logger.warning(f"⚠️ Lỗi click tab Kế toán: {e}")',
    '',
    '                # Chọn ngày tháng',
    '                self._select_date_range(page)',
    '                logger.info(f"✅ Hoàn thành điều hướng (lần {attempt})")',
    '                return',
    '            except Exception as e:',
    '                last_err = e',
    '                logger.warning(f"⚠️ Lần {attempt} lỗi điều hướng: {e}")',
    '',
    '        logger.error(f"❌ Lỗi điều hướng sau 3 lần: {last_err}")',
    '        raise last_err',
])

# ── FIX 3: 1_smed_THSDHD.py — hover 'Báo cáo' co retry ──────────────────────
fix("1_smed_THSDHD.py", [
    '    print("Đang mở menu báo cáo...")',
    '    ',
    '    await page.mouse.move(50, 100)',
    '    await page.wait_for_timeout(1000)',
    '    ',
    '    if is_16:',
    '        await page.goto("https://tcgiong.smed.vn/Application#!/welcome")',
    '        await page.wait_for_timeout(3000)',
    '    ',
    '    await page.get_by_role("link", name="\ueae6 Báo cáo").click()',
    '    await page.wait_for_timeout(1000)',
    '    ',
    '    # ✅ SỬA: Chọn báo cáo "Thống kê tình hình sử dụng HĐĐT"',
    '    await page.get_by_role("link", name="Thống kê tình hình sử dụng H").click()',
    '    ',
    '    await page.wait_for_load_state("networkidle")',
    '    print("Đã mở màn hình báo cáo HĐĐT")',
], [
    '    print("Đang mở menu báo cáo...")',
    '',
    '    if is_16:',
    '        await page.goto("https://tcgiong.smed.vn/Application#!/welcome")',
    '        await page.wait_for_timeout(3000)',
    '',
    '    # GĐ 500 (21/10): SMED sidebar render CHẬM hơn bình thường — hover ngắn (1s)',
    '    # trượt menu \'Báo cáo\' làm job hddt 21:47 FAIL (tool 4 nhapkho cùng lúc thoát',
    '    # nhờ fallback hover lâu hơn 2 điểm). Thử 3 lần hover lâu dần; lần 2/3 dùng',
    '    # đúng pattern fallback của tool 4 đã chạy OK.',
    '    last_err = None',
    '    for attempt, (moves, gap, timeout) in enumerate([',
    '        ([(50, 100)], 1.0, 30000),               # lần 1: như cũ',
    '        ([(20, 100), (100, 100)], 2.0, 10000),   # lần 2: hover lâu hơn (mẫu tool 4)',
    '        ([(10, 120), (120, 120)], 2.5, 10000),   # lần 3: lâu hơn nữa',
    '    ], start=1):',
    '        try:',
    '            for x, y in moves:',
    '                await page.mouse.move(x, y)',
    '                await page.wait_for_timeout(int(gap * 1000))',
    '            await page.get_by_role("link", name="\ueae6 Báo cáo").click(timeout=timeout)',
    '            await page.wait_for_timeout(1000)',
    '',
    '            # ✅ SỬA: Chọn báo cáo "Thống kê tình hình sử dụng HĐĐT"',
    '            await page.get_by_role("link", name="Thống kê tình hình sử dụng H").click()',
    '',
    '            await page.wait_for_load_state("networkidle")',
    '            print("Đã mở màn hình báo cáo HĐĐT")',
    '            return',
    '        except Exception as e:',
    '            last_err = e',
    '            print(f"⚠️ Lần {attempt} mở menu báo cáo lỗi: {e}")',
    '',
    '    raise last_err',
])

# ── FIX 4: 42_tpb_saoke.py — 'Sao kê' khop 2 element → .first ───────────────
fix("42_tpb_saoke.py", [
    '        # ── 2. Vào Sao kê → Sao kê tài khoản ──',
    '        page.get_by_text("Sao kê", exact=True).click()',
], [
    '        # ── 2. Vào Sao kê → Sao kê tài khoản ──',
    '        # GĐ 500 (21/10): TPB đổi UI — "Sao kê" giờ khớp 2 element (nút widget',
    '        # HOME_V2 + tiêu đề bottom-sheet \'Dịch vụ khác\') → strict mode violation',
    '        # làm job FAIL 3 đêm liền (18→20/10). .first = nút widget (DOM order 1 —',
    '        # đúng element tool vẫn bấm trước khi TPB thêm element thứ 2).',
    '        page.get_by_text("Sao kê", exact=True).first.click()',
])

print("\n=== py_compile kiem tra syntax ===")
import py_compile
for f in ["5_smed_XUATKHO.py", "7_smed_BCNXT.py", "1_smed_THSDHD.py", "42_tpb_saoke.py"]:
    py_compile.compile(str(AG / f), doraise=True)
    print("  OK", f)
print("\nHOAN TAT 4 FIX")
