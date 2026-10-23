# -*- coding: utf-8 -*-
"""GĐ 434 / C.263 — ghi entry AGENTS.md (2 repo) + unlock registry (idempotent)."""

import io
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
AGENTS_TONG = os.path.join(ROOT, "AGENTS.md")
AGENTS_CON = os.path.join(ROOT, "giong-apps", "AGENTS.md")
REGISTRY = os.path.join(ROOT, "AGENT_REGISTRY.md")

MARK = "### GĐ 434 / C.263 (Trợ lý Freebuff): Kho file nhập liệu → thư mục INPUT"

ENTRY_TONG = """### GĐ 434 / C.263 (Trợ lý Freebuff): Kho file nhập liệu → thư mục INPUT (ngang hàng OUTPUT) — giữ nguyên file gốc rồi mới cho AI đọc → DB (2026-10-14)

> **Yêu cầu ĐH (14/10):** file upload sau khi AI đọc xong phải lưu vào thư mục MỚI
> `apps/banhang/INPUT` NGANG HÀNG thư mục OUTPUT (các thư mục trong INPUT làm việc
> giống cách làm với OUTPUT) — GIỮ LẠI file gốc — sau đó mới để AI đọc & lưu DB.

> **⚠️ TRÙNG LẶP ĐA AGENT (ĐH cần biết):** phiên song song (tự gọi "GĐ 429b") đã
> làm AGENT-SIDE y hệt TRƯỚC em: `_MH_ROOT` → `apps/banhang/INPUT` +
> `MH_MODULE_FOLDER` map (folder module gạch dưới) + log "file gốc GIỮ LẠI tại
> INPUT" + guard extract đọc trong INPUT + kèm MODULE MỚI Điều chuyển nội bộ
> (`/dieu-chuyen/*` + `INPUT\\dieu_chuyen\\`). Em KHÔNG sửa đè — chỉ làm phần còn
> lại + restart + verify.

> **Em làm (repo con `6b9cbb6`):** `apps/banhang/.gitignore` +`INPUT/` (ngang hàng
> OUTPUT/ — file ĐH tải lên không vào git) · `-chuong-trinh-km.ts` comment kho
> INPUT · trang CTKM: mô tả "File GỐC GIỮ NGUYÊN ... thư mục INPUT (ngang hàng
> OUTPUT)" + hover tên file hiện đường dẫn đầy đủ.

> **Restart GIONG_API_Server (nạp code mới — 08:32):** syntax OK → sc stop/start
> (lần này service STOPPED hẳn, PID cũ thoát) → **tunnel MỚI
> `warranties-publishing-out-ethics`** + `scripts/update-tunnel-env.py` sync
> .env.local 2 app — production TỰ LÀNH nhờ fallback gist GĐ 426 đã push (KHÔNG
> cần redeploy). `__pycache__` agent/ + etl/ bị SMED agent giữ (Access denied —
> không xóa được) nhưng Python tự invalidate .pyc theo mtime source → rủi ro thấp.

> **Verify E2E thật (file gốc GIỮ NGUYÊN):** file Excel mẫu → upload qua endpoint
> thật → lưu ĐÚNG `apps\\banhang\\INPUT\\chuong_trinh_km\\2026-10-14\\083802_
> Ctkm-mau-INPUT-check.xlsx` (id=14, file tồn tại trên đĩa) → extract đọc OK
> (178 ký tự/1 bảng) → mh_files id=14 trỏ INPUT ✓ → dọn dòng id=7 MỒ CÔI (file
> test cũ bị xóa cùng `agent/mua-hang/` — KHÔNG phải file thật của ĐH).

> **⚠️ Việc còn ở phiên khác (không phải GĐ 434):** `api_server.py` (+159/−3:
> INPUT + module điều-chuyển) CHƯA commit, đang M chung → em KHÔNG add (quy tắc
> đa agent — sẽ vào git khi phiên đó commit); tsc app con hiện 5 lỗi trong
> `-dieu-chuyen.ts`/`nhap-dieu-chuyen.tsx` CỦA PHIÊN KIA đang viết dở (0 lỗi file
> GĐ 434).

> **Tiêu chí kiểm chứng của ĐH:** lên trang Chương trình khuyến mãi → tải 1 file
> thật → mở thư mục `D:\\DuLieuChung\\CUONG_2026\\giong-vn-v6\\giong-apps\\apps\\
> banhang\\INPUT\\chuong_trinh_km\\<ngày>\\` thấy file gốc + bấm "AI đọc" → Lưu →
> dữ liệu vào bảng như cũ.

> **Version:** KHÔNG bump (chờ lệnh Push). App tổng **6.3.0** / repo con **9.4.0**.
"""

ENTRY_CON = """### C.263 / GĐ 434 (Trợ lý Freebuff): Kho file upload → thư mục INPUT (ngang hàng OUTPUT) — giữ file gốc rồi mới cho AI đọc → DB (2026-10-14)

> **Yêu cầu ĐH:** file upload lưu vào `apps/banhang/INPUT` NGANG HÀNG OUTPUT
> (giống cách làm với OUTPUT) — GIỮ LẠI file gốc — rồi mới cho AI đọc → DB.

> **⚠️ Trùng lặp đa agent:** agent-side (`_MH_ROOT` → INPUT + `MH_MODULE_FOLDER` +
> log giữ gốc + guard extract) do PHIÊN SONG SONG làm trước ("GĐ 429b" — kèm
> module Điều chuyển nội bộ /dieu-chuyen) — em không sửa đè.

> **Code em (`6b9cbb6`):** `apps/banhang/.gitignore` +`INPUT/` ·
> `-chuong-trinh-km.ts` comment kho INPUT · trang CTKM mô tả "File GỐC GIỮ NGUYÊN
> — thư mục INPUT (ngang hàng OUTPUT)" + hover đường dẫn.

> **Restart GIONG_API_Server 08:32** nạp code mới → tunnel MỚI
> `warranties-publishing-out-ethics` + sync .env.local 2 app (production tự lành
> — fallback gist GĐ 426). Verify E2E thật: upload → `INPUT\\chuong_trinh_km\\
> 2026-10-14\\083802_Ctkm-mau-INPUT-check.xlsx` (id=14) + extract OK + dọn dòng
> mh_files id=7 mồ côi (file test cũ). tsc 0 lỗi file GĐ 434 (5 lỗi hiện có
> thuộc -dieu-chuyen.ts của phiên kia đang viết dở).

> **Version:** KHÔNG bump (chờ lệnh Push). App tổng **6.3.0** / repo con **9.4.0**.
"""

REG_NEW = (
    "| GĐ 434 / C.263 (Trợ lý Freebuff) | Trợ lý Freebuff | ✅ Kho file nhập liệu → thư mục INPUT "
    "(ngang hàng OUTPUT), giữ nguyên file gốc rồi mới cho AI đọc → DB (yêu cầu ĐH 14/10) — "
    "⚠️ TRÙNG LẶP: agent-side (_MH_ROOT → INPUT + MH_MODULE_FOLDER + log giữ gốc + guard + kèm "
    "module Điều chuyển nội bộ /dieu-chuyen) do PHIÊN SONG SONG làm trước (\"GĐ 429b\") — em KHÔNG "
    "sửa đè, chỉ làm phần còn lại | repo con: apps/banhang/.gitignore (+INPUT/) · "
    "src/routes/api/-chuong-trinh-km.ts · src/routes/m/banhang-chuong-trinh-khuyen-mai.tsx · "
    "app tổng: AGENT_REGISTRY.md + AGENTS.md — KHÔNG add api_server.py (đang M chung phiên khác) "
    "| ✅ repo con `6b9cbb6` (3 file) · entry + unlock commit này | 14/10 | RESTART GIONG_API_Server "
    "08:32 nạp code mới (syntax OK, service STOPPED hẳn) → tunnel MỚI "
    "`warranties-publishing-out-ethics` + sync .env.local 2 app (production tự lành — fallback gist "
    "GĐ 426 đã push) · verify E2E thật: upload → INPUT\\chuong_trinh_km\\2026-10-14\\083802_"
    "Ctkm-mau-INPUT-check.xlsx (id=14) + extract 178 ký tự OK + dọn mh_files id=7 mồ côi (file test "
    "cũ bị xóa cùng agent/mua-hang — KHÔNG phải file thật ĐH) · tsc 0 lỗi file GĐ 434 (5 lỗi thuộc "
    "-dieu-chuyen.ts phiên kia viết dở) · __pycache__ agent/etl không xóa được (SMED agent giữ — "
    "Python tự invalidate) · KHÔNG bump chờ Push (6.3.0/9.4.0) |"
)


def append_entry(path: str, entry: str) -> bool:
    with io.open(path, encoding="utf-8", newline="") as f:
        t = f.read()
    if MARK in t:
        print(f"  đã có entry — bỏ qua: {path}")
        return False
    if not t.endswith("\n"):
        t += "\n"
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(t + "\n" + entry)
    print(f"  + entry → {path}")
    return True


def fix_registry() -> bool:
    with io.open(REGISTRY, encoding="utf-8", newline="") as f:
        t = f.read()
    nl = "\r\n" if "\r\n" in t else "\n"
    lines = t.split(nl)
    hit = 0
    for i, ln in enumerate(lines):
        if ln.startswith("| GĐ 434 / C.263 (Trợ lý Freebuff) |"):
            if "✅" in ln.split("|")[2]:
                print("  registry đã ✅ — bỏ qua")
                return False
            lines[i] = REG_NEW
            hit += 1
    if hit != 1:
        raise SystemExit(f"LỖI: tìm thấy {hit} dòng GĐ 434 (mong 1)")
    with io.open(REGISTRY, "w", encoding="utf-8", newline="") as f:
        f.write(nl.join(lines))
    print(f"  ✅ unlock registry: {hit} dòng")
    return True


if __name__ == "__main__":
    append_entry(AGENTS_TONG, ENTRY_TONG)
    append_entry(AGENTS_CON, ENTRY_CON)
    fix_registry()
