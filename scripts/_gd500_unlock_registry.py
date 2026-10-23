# -*- coding: utf-8 -*-
"""GĐ 500 — unlock registry row GĐ 500 / C.320 (thay ô trạng thái, giữ nguyên byte phần còn lại)."""
from pathlib import Path

p = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/AGENT_REGISTRY.md")
raw = p.read_bytes().decode("utf-8")

OLD = "42_tpb_saoke}.py · app tổng: AGENT_REGISTRY.md + AGENTS.md | 🔄 đang làm | 21/10 |"
NEW = ("42_tpb_saoke}.py · app tổng: AGENT_REGISTRY.md + AGENTS.md + scripts/_gd500_* | "
       "✅ DONE — code repo con `5d7ff56` · entry repo con `0cfce54` · entry app tổng `21c2cbb` · "
       "scripts probe/fix `6a5054a` · verify chạy thật: xuatkho/xnkt/hddt 21/10 ✅ (19/18/19 file + ETL) · "
       "TPB 19-20/10 DONE qua agent ✅ + 18/10 file tải thật 23:25 ✅ (cả 3 ngày 0 giao dịch — valid-empty) | 21/10 |")
assert raw.count(OLD) == 1, raw.count(OLD)
p.write_bytes(raw.replace(OLD, NEW, 1).encode("utf-8"))
print("OK unlock row GĐ 500 / C.320")
