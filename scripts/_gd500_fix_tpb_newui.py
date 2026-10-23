# -*- coding: utf-8 -*-
"""GĐ 500 — Fix 42_tpb_saoke.py cho UI MỚI của TPB (đổi 21/10):
(a) modal giới thiệu che trang; (b) 'Sao kê' thành dropdown 3 mục; (c) màn 'Sao kê
tài khoản' cũ không còn. Giữ nguyên logic tải row đúng kỳ (đã verify dùng lại được).
Surgical: replace đúng 4 vùng, giữ nguyên byte phần còn lại (CRLF)."""
from pathlib import Path

AG = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent")
p = AG / "42_tpb_saoke.py"
raw = p.read_bytes().decode("utf-8")
nl = "\r\n" if "\r\n" in raw else "\n"


def rep(old_lines, new_lines, tag):
    global raw
    old = nl.join(old_lines)
    new = nl.join(new_lines)
    n = raw.count(old)
    assert n == 1, f"{tag}: khop {n} lan (can 1)"
    raw = raw.replace(old, new, 1)
    print(f"OK {tag}: {len(old_lines)} -> {len(new_lines)} dong")


# ── A. Chèn 2 helper trước _pick_date_in_calendar ──
rep([
    '',
    '',
    'def _pick_date_in_calendar(page, want_dd_mm_yyyy: str, label: str, nth_icon: int) -> None:',
], [
    '',
    '',
    'def _close_intro_modal(page) -> None:',
    '    """GĐ 500 — UI mới TPB: modal giới thiệu \'v2-intro-modal\' (Xin chào …) CHE',
    '    TRANG sau login → click nào cũng bị chặn ("subtree intercepts pointer events",',
    '    job fail 3 đêm 18→20/10). Đóng: JS click nút \'Đóng\' → click thường → xoá khỏi',
    '    DOM (modal chỉ quảng cáo, không chứa nghiệp vụ)."""',
    '    try:',
    '        if page.locator("div.v2-intro-modal").count() == 0:',
    '            return',
    '        page.evaluate("() => { const b = document.querySelector(\'.v2-intro-modal__close-btn\'); if (b) b.click(); }")',
    '        page.wait_for_timeout(1200)',
    '        if page.locator("div.v2-intro-modal").count():',
    '            try:',
    '                page.locator(".v2-intro-modal__close-btn").first.click(timeout=5000)',
    '                page.wait_for_timeout(800)',
    '            except Exception:',
    '                pass',
    '        if page.locator("div.v2-intro-modal").count():',
    '            page.evaluate("() => document.querySelectorAll(\'.v2-intro-modal\').forEach(e => e.remove())")',
    '            page.wait_for_timeout(500)',
    '        log(f"modal giới thiệu: còn {page.locator(\'div.v2-intro-modal\').count()} (0 = đã đóng)")',
    '    except Exception as e:',
    '        log(f"đóng modal giới thiệu lỗi (bỏ qua): {type(e).__name__}: {str(e)[:100]}")',
    '',
    '',
    'def _open_da_xuat(page) -> bool:',
    '    """GĐ 500 — vào danh sách \'Sao kê đã xuất\' trên UI mới. 2 đường:',
    '    1) nút \'Sao kê đã xuất\' ở trang success (\'Yêu cầu xuất sao kê thành công\');',
    '    2) về trang chủ → dropdown \'Sao kê\' → menuitem \'Sao kê đã xuất\'."""',
    '    b = page.get_by_text("Sao kê đã xuất", exact=True)',
    '    if b.count():',
    '        try:',
    '            b.first.click(timeout=8000)',
    '            page.wait_for_timeout(2500)',
    '            if page.get_by_role("row").count():',
    '                return True',
    '        except Exception:',
    '            pass',
    '    try:',
    '        back = page.get_by_text("Quay lại trang trước", exact=True)',
    '        if back.count():',
    '            back.first.click(timeout=8000)',
    '            page.wait_for_timeout(2500)',
    '    except Exception:',
    '        pass',
    '    try:',
    '        sk = page.get_by_text("Sao kê", exact=True)',
    '        if sk.count():',
    '            sk.first.click(timeout=8000)',
    '            page.wait_for_timeout(1200)',
    '        mi = page.get_by_role("menuitem", name="Sao kê đã xuất")',
    '        if mi.count():',
    '            mi.first.click(timeout=8000)',
    '            page.wait_for_timeout(2500)',
    '            return page.get_by_role("row").count() > 0',
    '    except Exception:',
    '        pass',
    '    return False',
    '',
    '',
    'def _pick_date_in_calendar(page, want_dd_mm_yyyy: str, label: str, nth_icon: int) -> None:',
], "A: chen 2 helper")

# ── B. Nav mới: modal → Sao kê → menuitem 'Xuất sao kê' ──
rep([
    '        # ── 2. Vào Sao kê → Sao kê tài khoản ──',
    '        # GĐ 500 (21/10): TPB đổi UI — "Sao kê" giờ khớp 2 element (nút widget',
    '        # HOME_V2 + tiêu đề bottom-sheet \'Dịch vụ khác\') → strict mode violation',
    '        # làm job FAIL 3 đêm liền (18→20/10). .first = nút widget (DOM order 1 —',
    '        # đúng element tool vẫn bấm trước khi TPB thêm element thứ 2).',
    '        page.get_by_text("Sao kê", exact=True).first.click()',
    '        page.wait_for_timeout(1500)',
    '        page.get_by_label("/ 1").get_by_text("Sao kê tài khoản").click()',
    '        page.wait_for_timeout(2000)',
    '        log("Đã vào Sao kê tài khoản")',
], [
    '        # ── 2. UI MỚI (TPB đổi 21/10): đóng modal → Sao kê → \'Xuất sao kê\' ──',
    '        # GĐ 500: TPB đổi UI hàng loạt — (a) sau login có modal \'v2-intro-modal\'',
    '        # (Xin chào …) CHE TRANG → mọi click bị chặn ("subtree intercepts pointer',
    '        # events") làm job FAIL 3 đêm liền 18→20/10; (b) "Sao kê" giờ khớp 2',
    '        # element (nút widget HOME_V2 + tiêu đề bottom-sheet \'Dịch vụ khác\') →',
    '        # strict mode violation; (c) màn \'Sao kê tài khoản\' CŨ không còn — \'Sao kê\'',
    '        # giờ là DROPDOWN trên thẻ tài khoản, 3 mục: Xuất sao kê · Sao kê đã xuất ·',
    '        # Sao kê định kỳ. Bằng chứng probe thật 21/10 (scripts/_gd500_probe_tpb_',
    '        # flow4-7): luồng mới = Sao kê → Xuất sao kê → form (Tùy chỉnh ngày + Excel)',
    '        # → nút Xuất sao kê (btn-primary) → nút \'Sao kê đã xuất\' → tải row đúng kỳ',
    '        # (bảng \'Sao kê đã xuất\' + logic tải CŨ dùng lại NGUYÊN VẸN — row vẫn ghi',
    '        # \'Thời gian: DD/MM/YYYY - DD/MM/YYYY\', đã tải thật OK 1 file .xlsx).',
    '        _close_intro_modal(page)',
    '        page.get_by_text("Sao kê", exact=True).first.click()',
    '        page.wait_for_timeout(1500)',
    '        page.get_by_role("menuitem", name="Xuất sao kê").click()',
    '        page.wait_for_timeout(2500)',
    '        log("Đã vào form Xuất sao kê (UI mới)")',
], "B: nav moi")

# ── C. Excel + nút Xuất sao kê (btn-primary) ──
rep([
    '        # ── 4. Định dạng Excel + Xuất sao kê ──',
    '        page.get_by_text("Excel").click()',
    '        page.wait_for_timeout(500)',
    '        before_rows = 0',
    '        try:',
    '            before_rows = page.get_by_role("row").count()',
    '        except Exception:',
    '            pass',
    '        page.get_by_role("button", name="Xuất sao kê").click()',
    '        page.wait_for_timeout(3000)',
], [
    '        # ── 4. Định dạng Excel + Xuất sao kê ──',
    '        page.get_by_text("Excel", exact=True).first.click()',
    '        page.wait_for_timeout(500)',
    '        # UI mới: nút submit = button.btn-primary (đứng cạnh \'Hủy bỏ\'); giữ',
    '        # fallback get_by_role như bản cũ phòng class đổi.',
    '        _btn_xuat = page.locator("button.btn-primary", has_text="Xuất sao kê").first',
    '        if _btn_xuat.count() == 0:',
    '            _btn_xuat = page.get_by_role("button", name="Xuất sao kê").last',
    '        _btn_xuat.click()',
    '        page.wait_for_timeout(3000)',
], "C: nut xuat")

# ── D. Trong vòng lặp tải: dùng _open_da_xuat ──
rep([
    '            try:',
    '                page.get_by_text("Sao kê đã xuất").first.click()',
    '                page.wait_for_timeout(2500)',
], [
    '            try:',
    '                _open_da_xuat(page)  # GĐ 500: UI mới — nút success page HOẶC dropdown trang chủ',
    '                page.wait_for_timeout(2500)',
], "D: vong lap")

p.write_bytes(raw.encode("utf-8"))
import py_compile
py_compile.compile(str(p), doraise=True)
print("py_compile PASS — HOAN TAT FIX TPB")
