# -*- coding: utf-8 -*-
"""GĐ 416 — Tách AGENTS.md lần 2: entry GĐ 319→410 dời NGUYÊN VĂN sang AGENTS_ARCHIVE.md.

- AGENTS.md: giữ mục 1-12 + quy tắc + entry GĐ 411-415 (đổi tham chiếu mục 12: GĐ 1→410).
- AGENTS_ARCHIVE.md: khối GĐ 319→410 nối VÀO CUỐI (đúng thứ tự thời gian sau GĐ 318),
  cập nhật header + footer; footer cũ dời xuống dưới khối.
- Verify: md5 khối dời byte-đối-byte; ranh giới assert từng dòng.
"""
import hashlib
import sys

sys.stdout.reconfigure(encoding="utf-8")

AGENTS = r"D:\DuLieuChung\CUONG_2026\giong-vn-v6\AGENTS.md"
ARCH = r"D:\DuLieuChung\CUONG_2026\giong-vn-v6\AGENTS_ARCHIVE.md"

with open(AGENTS, encoding="utf-8") as f:
    lines = f.read().splitlines(keepends=True)

# Ranh giới (1-based dòng 583 → 3745; giữ từ "---" dòng 3746 + entry GĐ 411 dòng 3748)
assert lines[582].startswith("### GĐ 319"), "GĐ 319 không ở dòng 583: " + lines[582][:60]
assert lines[3747].startswith("### GĐ 411"), "GĐ 411 không ở dòng 3748: " + lines[3747][:60]
assert lines[3745].strip() == "---", "dòng 3746 phải là '---': " + repr(lines[3745][:40])
assert lines[3746].strip() == "", "dòng 3747 phải trống: " + repr(lines[3746][:40])

block = lines[582:3745]  # entry GĐ 319 → 410 (kết thúc trước '---' của GĐ 411)
agents_new = lines[:582] + lines[3745:]

md5_before = hashlib.md5("".join(block).encode("utf-8")).hexdigest()

# Sửa mục 12 trong AGENTS.md (2 dòng — text byte chính xác)
agents_text = "".join(agents_new)
old_keep = "quy tắc hiện hành (mục 1-12) + entry từ GĐ 319"
new_keep = "quy tắc hiện hành (mục 1-12) + entry từ GĐ 411"
assert agents_text.count(old_keep) == 1
agents_text = agents_text.replace(old_keep, new_keep)
old_hist = "Lịch sử GĐ 1 → 318: nằm trọn trong **AGENTS_ARCHIVE.md**"
new_hist = "Lịch sử GĐ 1 → 410: nằm trọn trong **AGENTS_ARCHIVE.md**"
assert agents_text.count(old_hist) == 1
agents_text = agents_text.replace(old_hist, new_hist)

with open(AGENTS, "w", encoding="utf-8", newline="") as f:
    f.write(agents_text)

# Archive: tách footer cũ → body + khối dời + footer mới
with open(ARCH, encoding="utf-8") as f:
    arch_text = f.read()

foot_idx = arch_text.rfind("\n*Cập nhật lần cuối:")
assert foot_idx > 0, "không tìm thấy footer archive"
footer_old = arch_text[foot_idx + 1:]
body = arch_text[: foot_idx + 1]

arch_new = (
    body.rstrip("\n")
    + "\n\n"
    + "".join(block).rstrip("\n")
    + "\n\n*Cập nhật lần cuối: 2026-10-13 (GĐ 416 — tách lần 2: entry GĐ 319→410 dời nguyên văn từ AGENTS.md; lần 1 GĐ 319 ngày 05/10: GĐ 1→318)*\n"
    + "*Người cập nhật: Trợ lý Freebuff*"
)

# Sửa header archive dòng 4 (mốc lịch sử)
old_hdr = "(đủ lịch sử Giai đoạn 1 → GĐ 318 + các khối quy tắc)"
new_hdr = (
    "(đủ lịch sử Giai đoạn 1 → GĐ 318 + các khối quy tắc).\n"
    "> **Lần 2 (GĐ 416, 13/10):** entry GĐ 319 → 410 dời nguyên văn từ AGENTS.md — file này đủ lịch sử GĐ 1 → GĐ 410."
)
assert arch_new.count(old_hdr) == 1
arch_new = arch_new.replace(old_hdr, new_hdr)

with open(ARCH, "w", encoding="utf-8", newline="") as f:
    f.write(arch_new)

# Verify: md5 khối dời trong archive phải khớp byte-đối-byte
with open(ARCH, encoding="utf-8") as f:
    final = f.read()
md5_after = hashlib.md5(
    "".join(block).rstrip("\n").encode("utf-8")
).hexdigest()  # block đã rstrip trong archive — so khớp phần thân
found = final.find(block[0].rstrip("\n"))
seg = final[found : found + len("".join(block).rstrip("\n"))]
md5_seg = hashlib.md5(seg.encode("utf-8")).hexdigest()
md5_body = hashlib.md5("".join(block).rstrip("\n").encode("utf-8")).hexdigest()

print("Khối dời:", len(block), "dòng")
print("AGENTS.md mới:", len(agents_text.splitlines()), "dòng")
print("AGENTS_ARCHIVE.md mới:", len(final.splitlines()), "dòng")
print("md5 block (trước) :", md5_before)
print("md5 khối trong archive:", md5_seg, "— KHỚP" if md5_seg == md5_body else "— KHÁC!!!")
assert md5_seg == md5_body, "md5 khối dời KHÁC — dừng!"
print("VERIFY MD5: PASS")
