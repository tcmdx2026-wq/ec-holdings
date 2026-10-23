# -*- coding: utf-8 -*-
"""GĐ 430 / C.260 — ghi entry AGENTS.md (2 repo) + unlock registry (idempotent).

Chạy 1 lần trong giai đoạn này; chạy lại KHÔNG nhân đôi nội dung (guard chuỗi đánh dấu).
"""

import io
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
AGENTS_TONG = os.path.join(ROOT, "AGENTS.md")
AGENTS_CON = os.path.join(ROOT, "giong-apps", "AGENTS.md")
REGISTRY = os.path.join(ROOT, "AGENT_REGISTRY.md")

MARK = "### GĐ 430 / C.260 (Trợ lý Freebuff): Module \"Chương trình khuyến mãi\""

ENTRY_TONG = """### GĐ 430 / C.260 (Trợ lý Freebuff): Module "Chương trình khuyến mãi" (BÁN HÀNG app con) — nhập file PDF/Word/Excel/Text/Ảnh → AI đọc → bảng DS Vắc Xin theo CTKM (cột động) → LINK bảng TH GB-KM_GN-CK-LN (2026-10-14)

> **Yêu cầu Đại ca (14/10):** xây "Chương trình khuyến mãi" trong app con: nhập
> dữ liệu từ file (PDF/Word/Excel/Text/Ảnh) → lưu tại máy chủ → AI đọc & phân
> tích → cập nhật bảng "Danh sách Vắc Xin theo chương trình khuyến mãi" (STT ·
> Vắc Xin · ĐVT · Giá niêm yết · CT khuyến mại_1/2/3…) → giá trị KM là căn cứ
> LINK vào bảng TH GB-KM_GN-CK-LN.

> **⚠️ ĐH CHƯA trả lời 4 câu hỏi chốt thiết kế (phiếu hỏi bị bỏ trống — không
> phải từ chối) → em tự chọn 4 mặc định Đề xuất, ĐH đổi được bất kỳ điểm nào:**
> (1) cột CT = SỐ TIỀN (đ/mũi) + mô tả nguyên văn; (2) bảng TH TỰ ĐỘNG lấy giá
> trị CT đang hiệu lực hôm nay — nhập tay ghi đè; (3) cột chương trình ĐỘNG
> theo dữ liệu; (4) đợt này CHỈ làm CTKM (7 module MUA HÀNG còn lại đợt sau).

> **⚠️ SONG SONG đa agent (đã kiểm tra trước khi sửa):** phiên khác (cùng "Trợ
> lý Freebuff") đang làm GĐ 429 Module MUA HÀNG — sửa nav.ts · smed-auth.ts ·
> lib/mua-hang.ts · -mua-hang.ts · mua-hang-page.tsx (mtime 02:20-02:27). Em
> TÁCH HOÀN TOÀN, không đụng các file đó: `-chuong-trinh-km.ts` tự chứa; chỉ
> IMPORT chỉ-đọc normVx từ lib/mua-hang.ts. Phiên kia đã commit `6b9ad4d`
> (GĐ 429 — gồm api_server.py chứa dòng MH_MODULES "chuong-trinh-km" của em),
> `7e26483` (hạ trần upload 4MB→3MB), `21c70d6` (GĐ 431/C.261). Em commit SAU
> — 0 file trùng.

> **Đã làm (repo con `5adec76` + `6e621ee`):**
> 1. Bảng `ctkm_vacxin` GiondDB (LONG: 1 dòng = 1 VX × 1 CT) — `agent/ctkm_setup.py`
>    DDL idempotent + report — ĐÃ CHẠY THẬT trên máy chủ.
> 2. `src/lib/ctkm.ts` (logic thuần, unit-test được): todayIso (VN = UTC+7) ·
>    listChuongTrinh (CT mới nhất đứng trước = CT_1) · buildMatrix (pivot cột
>    động; trùng key → id lớn thắng) · kmHieuLuc (chọn CT ĐANG HIỆU LỰC: hiệu
>    lực theo ngày, nhiều CT → den_ngay muộn nhất, fallback PREFIX tên theo bài
>    học GĐ 411) + `ctkm.test.ts`.
> 3. `src/routes/api/-chuong-trinh-km.ts` (tự chứa — không đụng file phiên kia):
>    loadCtkm (52 VX từ price_list + ĐVT từ mh_bang_gia_vx/vaccines + rows
>    ctkm_vacxin) · uploadCtkmFile (module `chuong-trinh-km` — dùng chung 3
>    endpoint agent GĐ 429) · parseCtkmFile (agent extract đa định dạng + OCR →
>    LLM Z.ai prompt CTKM: quy tiền CHỈ khi có căn cứ, nhiều CT trong 1 file →
>    1 tên riêng mỗi CT, KHÔNG bịa số) · saveCtkmDraft · saveCtkmCell (upsert ô)
>    · deleteCtkmCell · deleteCtkmChuongTrinh.
> 4. Trang `/m/banhang-chuong-trinh-khuyen-mai` (thay placeholder GĐ 370 — route
>    + menu + quyền bh-nhap-ban-hang đã có sẵn): khối 1 nhập file (chọn file →
>    lưu máy chủ → "AI đọc" → bảng NHÁP sửa được → nút Lưu mới ghi DB) + khối 2
>    bảng "Danh sách Vắc Xin theo chương trình khuyến mãi" (52 dòng × cột CT
>    ĐỘNG: header "CT khuyến mại_N" + tên CT + nút xóa CT; bấm ô → dialog
>    thêm/sửa/xóa; Tải Excel; đủ 4 nguyên tắc định dạng 21/09).
> 5. LINK bảng TH GB-KM_GN-CK-LN: `-th-gbkm.ts` thêm `kmCtkmMap` (CT đang hiệu
>    lực hôm nay per VX — thử/lỗi nếu bảng chưa tạo, không chặn trang) → trang
>    TH hiển thị giá trị tự động kèm "(CTKM)" + tooltip tên CT/mô tả; 3 cột LN
>    gộp dùng giá trị hiệu dụng; DB nhập tay GHI ĐÈ (mô hình giá nhập tạm GĐ 411).

> **Verify:** unit **14/14 PASS** (todayIso ngày VN · sắp cột · pivot trùng key ·
> hiệu lực/hết hạn/chưa tới ngày/nhiều CT/fallback prefix) · tsc app con **EXIT
> 0** · **E2E THẬT trên máy công ty:** tạo Excel mẫu 2 sheet → upload qua
> endpoint thật → lưu `agent/mua-hang/files/chuong-trinh-km/2026-10-14/024105_
> Ctkm-mau-2026-10-11.xlsx` (id=7) → extract 542 ký tự/2 bảng OK → ghi 4 dòng/2
> CT vào ctkm_vacxin → `kmHieuLuc` verify: **Hexaxim 200.000 · Infanrix Hexa
> 250.000 (CT Tháng 10 đang hiệu lực); PREVENAR 13 chỉ mô tả ("Giảm 10%" — không
> bịa số); ROTARIX 1.5ml CT Tháng 11 chưa tới ngày → không điền** = 3/52 VX có
> KM hiệu lực hôm nay.

> **Lưu ý ĐH:** (a) bước gọi LLM cần `ZAI_API_KEY` — chỉ có trên Vercel
> (Sensitive, không pull được) → em test trọn đường đọc file + chuẩn hóa + ghi
> DB + link; **LLM thật test trên production sau Push**; (b) 4 dòng CTKM MẪU giữ
> lại cho ĐH xem bảng hoạt động — xóa bằng nút ✕ trên header cột chương trình;
> (c) service agent đã nạp module mới (phiên kia restart) — KHÔNG cần restart lại.

> **Tiêu chí kiểm chứng (sau Push):** trang /m/banhang-chuong-trinh-khuyen-mai →
> chọn file CTKM thật (PDF/ảnh/Word/Excel) → "AI đọc" → sửa nháp → Lưu → bảng
> đủ 52 dòng × cột "CT khuyến mại_1..N" đúng dữ liệu; mở bảng TH GB-KM_GN-CK-LN
> → cột "KM khách hàng" tự điền kèm "(CTKM)" cho VX có CT hiệu lực + LN gộp đổi
> theo; nhập tay ở bảng TH → ghi đè.

> **Version:** KHÔNG bump (chờ lệnh Push — quy tắc ĐA AGENT). App tổng
> **6.2.0** / repo con **9.3.0**.
"""

ENTRY_CON = """### C.260 / GĐ 430 (Trợ lý Freebuff): Module "Chương trình khuyến mãi" (BÁN HÀNG) — nhập file PDF/Word/Excel/Text/Ảnh → AI đọc → bảng DS Vắc Xin theo CTKM (cột động) → LINK bảng TH GB-KM_GN-CK-LN (2026-10-14)

> **Yêu cầu ĐH (14/10):** nhập liệu từ file → lưu máy chủ → AI đọc & phân tích
> → bảng "Danh sách Vắc Xin theo chương trình khuyến mãi" (STT · Vắc Xin · ĐVT
> · Giá niêm yết · CT khuyến mại_1/2/3…) → giá trị KM là căn cứ link vào bảng
> TH GB-KM_GN-CK-LN.

> **ĐH chưa trả lời 4 câu chốt thiết kế → em tự chọn 4 mặc định Đề xuất (số tiền
> + mô tả · tự động + tay ghi đè · cột động · chỉ CTKM đợt này) — ĐH đổi được.**

> **Code (`5adec76` + `6e621ee`):** `agent/ctkm_setup.py` (DDL `ctkm_vacxin` —
> đã chạy thật máy chủ) · `src/lib/ctkm.ts` + `ctkm.test.ts` (todayIso VN ·
> listChuongTrinh · buildMatrix · kmHieuLuc) · `src/routes/api/-chuong-trinh-km.ts`
> (tự chứa: load/upload/parse AI/save draft/save cell/delete) · trang
> `banhang-chuong-trinh-khuyen-mai.tsx` (2 khối + cột CT động + dialog + Excel) ·
> `-th-gbkm.ts` + `banhang-th-gbkm-gnck-ln.tsx` (kmCtkmMap → cột KM khách hàng tự
> điền kèm "(CTKM)", tay ghi đè, 3 LN gộp dùng giá trị hiệu dụng).

> **⚠️ SONG SONG đa agent:** phiên khác làm GĐ 429 (nav/smed-auth/lib-mua-hang/
> -mua-hang.ts/mua-hang-page.tsx) — em TÁCH HOÀN TOÀN, 0 file trùng; api_server.py
> (dòng MH_MODULES thêm "chuong-trinh-km") đã vào git qua commit phiên kia `6b9ad4d`.

> **Verify:** unit **14/14 PASS** · tsc **EXIT 0** · E2E thật: upload Excel mẫu
> 2 sheet (id=7) → extract 542 ký tự/2 bảng → 4 dòng/2 CT vào ctkm_vacxin →
> kmHieuLuc **3/52** (Hexaxim 200.000 · Infanrix Hexa 250.000; PREVENAR 13 chỉ
> mô tả; ROTARIX CT tháng 11 chưa tới ngày) · LLM thật cần ZAI_API_KEY (Vercel)
> → test sau Push · 4 dòng mẫu giữ cho ĐH xem.

> **Version:** KHÔNG bump (chờ lệnh Push — quy tắc ĐA AGENT). App tổng **6.2.0**
> / repo con **9.3.0**.
"""

REG_NEW = (
    "| GĐ 430 / C.260 (Trợ lý Freebuff) | Trợ lý Freebuff | ✅ App con — BÁN HÀNG: "
    "Module \"Chương trình khuyến mãi\" (ĐH yêu cầu 14/10): nhập file PDF/Word/Excel/Text/Ảnh "
    "→ lưu máy chủ → AI đọc & phân tích → bảng \"Danh sách Vắc Xin theo chương trình khuyến mãi\" "
    "(STT · Vắc Xin · ĐVT · Giá niêm yết · CT khuyến mại_1/2/3… cột ĐỘNG) → LINK bảng TH "
    "GB-KM_GN-CK-LN (cột KM khách hàng tự động lấy CT đang hiệu lực — nhập tay ghi đè) — "
    "ĐH CHƯA trả lời 4 câu chốt thiết kế → em tự chọn 4 mặc định Đề xuất (ĐH đổi được) "
    "| repo con: apps/banhang/agent/ctkm_setup.py (mới) · src/lib/ctkm.ts + ctkm.test.ts (mới) · "
    "src/routes/api/-chuong-trinh-km.ts (mới) · src/routes/api/-th-gbkm.ts · "
    "src/routes/m/banhang-chuong-trinh-khuyen-mai.tsx · src/routes/m/banhang-th-gbkm-gnck-ln.tsx · "
    "app tổng: AGENT_REGISTRY.md + AGENTS.md — ⚠️ TÁCH HOÀN TOÀN khỏi phiên song song GĐ 429 "
    "(KHÔNG đụng nav/smed-auth/lib-mua-hang/-mua-hang.ts/mua-hang-page.tsx) "
    "| ✅ repo con `5adec76` (code 7 file +1.727/−8) + `6e621ee` (fix trần 3MB) · entry + unlock commit này "
    "| 14/10 | unit **14/14 PASS** · tsc app con **EXIT 0** · E2E thật: upload Excel mẫu 2 sheet "
    "(id=7 → mua-hang/files/chuong-trinh-km/2026-10-14/) → extract 542 ký tự/2 bảng → 4 dòng/2 CT "
    "ctkm_vacxin → kmHieuLuc **3/52** (Hexaxim 200.000 · Infanrix Hexa 250.000; PREVENAR 13 chỉ mô tả "
    "— không bịa số; ROTARIX CT tháng 11 chưa tới ngày) · LLM thật cần ZAI_API_KEY (Vercel, Sensitive "
    "— không pull được) → test sau Push · 4 dòng CTKM mẫu giữ cho ĐH xem · KHÔNG bump chờ Push "
    "(6.2.0/9.3.0) |"
)


def append_entry(path: str, entry: str) -> bool:
    with io.open(path, encoding="utf-8", newline="") as f:
        t = f.read()
    if MARK in t:
        print(f"  đã có entry — bỏ qua: {os.path.basename(os.path.dirname(path)) or path}")
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
        if ln.startswith("| GĐ 430 / C.260 (Trợ lý Freebuff) |"):
            if ln.startswith("| GĐ 430 / C.260 (Trợ lý Freebuff) | Trợ lý Freebuff | ✅"):
                print("  registry đã ✅ — bỏ qua")
                return False
            lines[i] = REG_NEW
            hit += 1
    if hit != 1:
        raise SystemExit(f"LỖI: tìm thấy {hit} dòng GĐ 430 (mong 1)")
    with io.open(REGISTRY, "w", encoding="utf-8", newline="") as f:
        f.write(nl.join(lines))
    print(f"  ✅ unlock registry: {hit} dòng")
    return True


if __name__ == "__main__":
    append_entry(AGENTS_TONG, ENTRY_TONG)
    append_entry(AGENTS_CON, ENTRY_CON)
    fix_registry()
