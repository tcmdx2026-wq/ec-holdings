# -*- coding: utf-8 -*-
"""GĐ 437 / C.266 — ghi entry AGENTS.md (2 repo) + unlock registry (idempotent)."""

import io
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
AGENTS_TONG = os.path.join(ROOT, "AGENTS.md")
AGENTS_CON = os.path.join(ROOT, "giong-apps", "AGENTS.md")
REGISTRY = os.path.join(ROOT, "AGENT_REGISTRY.md")

MARK = "### GĐ 437 / C.266 (Trợ lý Freebuff): Sắp xếp danh sách Vắc xin theo TÊN SMED A→Z"

ENTRY_TONG = """### GĐ 437 / C.266 (Trợ lý Freebuff): Sắp xếp danh sách Vắc xin theo TÊN SMED A→Z — rà hết app con: 6 bảng (2026-10-14)

> **Yêu cầu ĐH (14/10):** "Tìm kiếm các bảng thể hiện danh sách Vắc xin để sắp xếp
> Vắc xin theo tên từ A đến Z theo tên SMED" — ĐH mới thấy 4 chỗ (Danh mục Vắc xin
> · Mua hàng/Bảng giá Vắc xin · Bán hàng/Bảng giá dịch vụ · Bảng TH GB-KM) và yêu
> cầu rà HẾT các bảng còn lại.

> **Rà toàn app (Explore, 72 lượt tool): 6 BẢNG danh sách VX cần sửa — 5 file:**
> 1. `/m/danh-muc-vac-xin` — `vaccines ORDER BY ten_hang` → **`ma_smed`
>    COLLATE Vietnamese_CI_AS** (ma_smed = tên rút gọn SMED; STT render theo index).
> 2. `/m/mua-hang-bang-gia-vx` — SPECS `bang-gia-vx` orderBy `id` → `ten_smed
>    COLLATE Vietnamese_CI_AS, id` (STT render index).
> 3. `/m/nhap-loyty` (LOYALTY — cũng là bảng danh sách VX theo chương trình) —
>    orderBy `id` → `ten_smed COLLATE Vietnamese_CI_AS, id`.
> 4. `/m/banhang-bang-gia-dich-vu` — `price_list ORDER BY stt` → `ten_smed
>    COLLATE Vietnamese_CI_AS` + **STT đánh LẠI 1..N** (trước hiện stt gốc bảng giá
>    → sort lại sẽ lộn xộn; trang render `r.stt` trực tiếp).
> 5. `/m/banhang-th-gbkm-gnck-ln` — `th_gbkm_gnck_ln ORDER BY id` → `ten_smed
>    COLLATE Vietnamese_CI_AS, id` (STT render index).
> 6. `/m/banhang-chuong-trinh-khuyen-mai` — mảng `vaccines` sort SAU dedup bằng
>    `localeCompare("vi")` + đánh lại STT (**giữ cách chọn dòng MIN(stt) đại diện
>    cho tên trùng — KHÔNG đổi nguồn giá**; sort sau dedup vì lý do này).

> **LOẠI TRỪ có lý do (bảng GIAO DỊCH — giữ thứ tự nhập liệu):** đơn đặt hàng gửi
> NCC + NCC gửi Order (id DESC) · theo dõi trạng thái mua hàng (center→ncc→ten_smed
> theo thiết kế) · điều chuyển nội bộ (id DESC) · matrix điều chuyển (builder đã
> sort VX A→Z tiếng Việt sẵn) · danh mục khách hàng/NCC/trung tâm + báo cáo
> kho/MISA/bank/lịch hẹn (không phải danh sách VX).

> **Verify:** tsc app con **EXIT 0 sạch toàn bộ** (5 lỗi cũ `-dieu-chuyen.ts` của
> phiên khác đã được họ sửa) · SQL THẬT 4 bảng đều A→Z chuẩn tiếng Việt
> (**Abhayrab 0.5ml < ABRYSVO < Adacel < Avaxim 80U < BARYCELA < BCG-TCDV <
> Bexsero < Boostrix**) · **sort JS `localeCompare("vi")` khớp 100% SQL `COLLATE
> Vietnamese_CI_AS` (52/52 vị trí)** — bảng CTKM (sort JS) đồng nhất 5 bảng SQL ·
> mh_loyalty hiện 0 dòng (sort áp dụng đúng khi có dữ liệu).

> **Không đụng (ngoài phạm vi chỉ-định — ĐH cần thì báo em):** dropdown chọn Vắc
> xin trong các form (mua-hàng / điều chuyển / CTKM / GB-KM) vẫn theo thứ tự gốc.

> **Tiêu chí kiểm chứng (sau Push):** mở 6 trang liệt kê — mọi dòng Vắc xin xếp
> A→Z theo tên SMED; cột STT (Bảng giá dịch vụ + DS Vắc Xin theo CTKM) đánh lại
> 1..N liền mạch.

> **Version:** KHÔNG bump (chờ lệnh Push). App tổng **6.3.0** / repo con **9.4.0**.
"""

ENTRY_CON = """### C.266 / GĐ 437 (Trợ lý Freebuff): Sắp 6 bảng danh sách Vắc xin theo TÊN SMED A→Z (2026-10-14)

> **Yêu cầu ĐH:** tìm các bảng thể hiện danh sách Vắc xin → sắp theo tên SMED A→Z.

> **Rà hết app — 6 bảng / 5 file (`5353f46`):** `-danh-muc.ts` (vaccines →
> `ma_smed COLLATE Vietnamese_CI_AS`) · `-mua-hang.ts` SPECS `bang-gia-vx` +
> `loyalty` (id → `ten_smed COLLATE Vietnamese_CI_AS, id`) · `-bang-gia.ts`
> (price_list stt → ten_smed COLLATE VI + **STT đánh lại 1..N**) · `-th-gbkm.ts`
> (id → ten_smed COLLATE VI, id) · `-chuong-trinh-km.ts` (sort SAU dedup
> `localeCompare("vi")` + STT lại — giữ dòng MIN(stt) đại diện, không đổi nguồn giá).

> **Loại trừ (bảng giao dịch, giữ thứ tự nhập liệu):** đơn đặt/NCC Order (id DESC) ·
> theo dõi mua hàng (center→ncc→ten_smed) · điều chuyển (id DESC) · matrix (đã sort
> A→Z sẵn). Lý do đầy đủ ở entry GĐ 437 AGENTS.md app tổng.

> **Verify:** tsc **EXIT 0** · SQL thật 4 bảng A→Z chuẩn tiếng Việt (Abhayrab <
> ABRYSVO < Adacel < Avaxim < BARYCELA < BCG-TCDV < Bexsero < Boostrix) · JS ↔ SQL
> **khớp 100% (52/52)**.

> **Version:** KHÔNG bump (chờ lệnh Push). App tổng **6.3.0** / repo con **9.4.0**.
"""

REG_NEW = (
    "| GĐ 437 / C.266 (Trợ lý Freebuff) | Trợ lý Freebuff | ✅ Sắp xếp danh sách Vắc xin theo TÊN "
    "SMED A→Z (yêu cầu ĐH 14/10) — rà hết app con: 6 BẢNG danh sách VX (Danh mục Vắc xin → ma_smed "
    "· Bảng giá Vắc xin + LOYALTY → ten_smed · Bảng giá dịch vụ → ten_smed + STT đánh lại 1..N · "
    "Bảng TH GB-KM → ten_smed · DS Vắc Xin theo CTKM → sort sau dedup giữ dòng MIN(stt)) — "
    "COLLATE Vietnamese_CI_AS + localeCompare vi; KHÔNG đụng bảng giao dịch (đơn đặt/Order/theo "
    "dõi/điều chuyển/matrix) | repo con: src/routes/api/-danh-muc.ts · -mua-hang.ts · -bang-gia.ts · "
    "-th-gbkm.ts · -chuong-trinh-km.ts · app tổng: AGENT_REGISTRY.md + AGENTS.md | ✅ repo con "
    "`5353f46` (5 file +19/−7) · entry + unlock commit này | 14/10 | tsc app con **EXIT 0 sạch** · "
    "SQL thật 4 bảng A→Z chuẩn VI (Abhayrab 0.5ml < ABRYSVO < Adacel < Avaxim 80U < BARYCELA < "
    "BCG-TCDV < Bexsero < Boostrix) · sort JS localeCompare(vi) khớp 100% SQL (52/52) · dropdown "
    "chọn VX KHÔNG sửa (ngoài phạm vi) · KHÔNG bump chờ Push (6.3.0/9.4.0) |"
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
        if ln.startswith("| GĐ 437 / C.266 (Trợ lý Freebuff) |"):
            if "✅" in ln.split("|")[2]:
                print("  registry đã ✅ — bỏ qua")
                return False
            lines[i] = REG_NEW
            hit += 1
    if hit != 1:
        raise SystemExit(f"LỖI: tìm thấy {hit} dòng GĐ 437 (mong 1)")
    with io.open(REGISTRY, "w", encoding="utf-8", newline="") as f:
        f.write(nl.join(lines))
    print(f"  ✅ unlock registry: {hit} dòng")
    return True


if __name__ == "__main__":
    append_entry(AGENTS_TONG, ENTRY_TONG)
    append_entry(AGENTS_CON, ENTRY_CON)
    fix_registry()
