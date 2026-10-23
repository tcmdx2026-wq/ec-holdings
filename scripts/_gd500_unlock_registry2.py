# -*- coding: utf-8 -*-
"""GĐ 500 — unlock registry qua cổng: --replace-old/--replace-new trên AGENT_REGISTRY.md."""
import subprocess
from pathlib import Path

OLD = "42_tpb_saoke}.py · app tổng: AGENT_REGISTRY.md + AGENTS.md | 🔄 đang làm | 21/10 |"
NEW = ("42_tpb_saoke}.py · app tổng: AGENT_REGISTRY.md + AGENTS.md + scripts/_gd500_* | "
       "✅ DONE — code repo con `5d7ff56` · entry repo con `0cfce54` · entry app tổng `21c2cbb` · "
       "scripts probe/fix `6a5054a` · verify chạy thật: xuatkho/xnkt/hddt 21/10 ✅ (19/18/19 file + ETL) · "
       "TPB 19-20/10 DONE qua agent ✅ + 18/10 file tải thật 23:25 ✅ (cả 3 ngày 0 giao dịch — valid-empty) | 21/10 |")

cmd = [
    "python", "scripts/agents/shared-doc.py", "commit",
    "--replace-old", OLD,
    "--replace-new", NEW,
    "--file", "AGENT_REGISTRY.md",
    "-m",
    "docs(registry): GĐ 500 / C.320 (Trợ lý Freebuff) — unlock ✅: rà 84 job 21/10 + khắc phục 4 nhóm lỗi (hover SMED · THỐNG KÊ xnkt · TPB UI mới) — verify chạy thật (xuatkho/xnkt/hddt + TPB 18-20/10)",
]
p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=r"D:/DuLieuChung/CUONG_2026/giong-vn-v6")
print(p.stdout[-1500:])
print(p.stderr[-400:] if p.stderr else "")
print("exit:", p.returncode)
