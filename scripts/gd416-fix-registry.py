# -*- coding: utf-8 -*-
"""GĐ 416 — Sửa AGENT_REGISTRY.md 3 dòng vỡ (44/80/91): tách entry riêng, đủ 7 cột.

- Dòng 44: gộp 2 ô cuối (dấu | nhầm trong text hoàn tất) → 7 ô chuẩn.
- Dòng 80: 4 entry dính → 4 dòng; 2 entry thiếu số trả lại số đã tồn tại
  trong hệ (C.198 = điều tra bccn — GĐ 377 nhắc "bản C.198"; C.197 = fix
  Tiền thuế MIA — ô hoàn tất nhắc C.197b). KHÔNG cấp số mới.
- Dòng 91: 2 entry dính → 2 dòng; entry khảo sát UI/UX = GĐ 347 (khớp entry
  AGENTS.md GĐ 347: claim e7a794e · code+docs 9cbf280).
- Verify: mọi dòng bảng = 7 ô (8 dấu |).
"""
import sys

sys.stdout.reconfigure(encoding="utf-8")

REG = r"D:\DuLieuChung\CUONG_2026\giong-vn-v6\AGENT_REGISTRY.md"

with open(REG, encoding="utf-8") as f:
    lines = f.read().splitlines(keepends=True)

# Guard idempotent: đã tách xong (4 entry riêng tồn tại + dòng 44 đủ 7 ô) → chỉ verify
joined = "".join(lines)
if "| C.198 (Trợ lý Freebuff) | Trợ lý Freebuff |" in joined:
    print("ĐÃ TÁCH TỪ LẦN TRƯỚC — bỏ qua phần sửa, chỉ chạy verify cuối")
else:
    def cells_of(idx0):
        parts = lines[idx0].split("|")
        return parts[1:-1], parts

    # --- Dòng 44 (index 43): gộp ô[6]+ô[7] ---
    cells, parts = cells_of(43)
    assert len(cells) == 8 and cells[0].strip().startswith("GĐ 399"), cells[0][:50]
    merged = cells[6].rstrip() + " · " + cells[7].strip() + " "
    new_cells = cells[:6] + [merged]
    lines[43] = "| " + " | ".join(c.strip() for c in new_cells) + " |\n"

    # --- Dòng 80 (index 79): tách 4 entry ---
    cells, _ = cells_of(79)
    assert len(cells) == 27 and cells[0].strip().startswith("GĐ 362"), cells[0][:50]
    e362 = cells[0:7]      # GĐ 362 / C.199 (ô[6] Hoàn tất trống)
    e363 = cells[7:14]     # GĐ 363 / C.200
    e198 = cells[14:21]    # thiếu số → C.198
    e197 = cells[21:27]    # thiếu số → C.197 (6 ô cuối)
    assert e362[0].strip().startswith("GĐ 362") and e363[0].strip().startswith("GĐ 363")
    assert e198[0].strip() == "Trợ lý Freebuff" and e197[0].strip() == "Trợ lý Freebuff"

    def row(cells7):
        return "| " + " | ".join(c.strip() for c in cells7) + " |\n"

    # Trả số đã tồn tại: ô Số + GIỮ ô Agent "Trợ lý Freebuff" (entry gốc lệch cấu trúc:
    # ô[0] của entry không số là Agent, không phải Số)
    e198_new = ["C.198 (Trợ lý Freebuff)"] + [c.strip() for c in e198[0:6]]
    e197_new = ["C.197 (Trợ lý Freebuff)"] + [c.strip() for c in e197[0:6]]
    assert len(e198_new) == 7 and len(e197_new) == 7

    lines[79:80] = [
        row(e362),
        row(e363),
        row(e198_new),
        row(e197_new),
    ]

    # --- Dòng 91 cũ (index 90) → sau chèn dòng 80 thành index 90+3=93 ---
    cells, _ = cells_of(93)
    assert len(cells) == 13 and cells[0].strip().startswith("GĐ 348"), cells[0][:50]
    e348 = cells[0:7]
    e347 = cells[7:13]  # 6 ô (thiếu ô Số)
    assert e347[0].strip() == "Trợ lý Freebuff"
    e347_new = ["GĐ 347 (Trợ lý Freebuff)"] + [c.strip() for c in e347[0:6]]
    assert len(e347_new) == 7
    lines[93:94] = [row(e348), row(e347_new)]

# --- Verify: mọi dòng bảng khóa số = 7 ô (bảng phân vai/sự cố khác cột — bỏ qua) ---
import re
with open(REG, "w", encoding="utf-8", newline="") as f:
    f.write("\n".join(ln.rstrip("\n") for ln in lines) + "\n")

bad = []
for i, ln in enumerate(lines, 1):
    if re.match(r"^\| (GĐ \d+ / C\.\d+ \(Trợ|GĐ \d+ \(Trợ|C\.\d+ \(Trợ)", ln) and ln.count("|") != 8:
        bad.append((i, ln.count("|"), ln[:70]))
if bad:
    for b in bad:
        print("VẪN VỠ:", b)
    sys.exit(1)
print("VERIFY PASS — mọi dòng bảng registry đều 7 ô (8 dấu |)")
print("Tổng dòng registry:", len(lines))
