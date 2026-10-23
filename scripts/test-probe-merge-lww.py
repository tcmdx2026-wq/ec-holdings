# -*- coding: utf-8 -*-
"""Test T-SQL MERGE mới (sau fix) chạy thật trên GiongDB — pyodbc trực tiếp, không đụng service."""
import sys, io, importlib.util
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

spec = importlib.util.spec_from_file_location(
    "api_server",
    str(Path(__file__).resolve().parent.parent / "giong-apps/apps/banhang/agent/api_server/api_server.py"),
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

import pyodbc

PG = """INSERT INTO attendance (id, name, status, time, date, weekday, gps, address, photo, type, approved, workplace, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, status = EXCLUDED.status, time = EXCLUDED.time,
        date = EXCLUDED.date, weekday = EXCLUDED.weekday, gps = EXCLUDED.gps,
        address = EXCLUDED.address, photo = EXCLUDED.photo, workplace = EXCLUDED.workplace,
        updated_at = EXCLUDED.updated_at
      WHERE attendance.updated_at < EXCLUDED.updated_at"""

params = [
    "__probe_att_fix1", "Probe Test", "Vào ca", "10:00", "2026-09-19",
    "Thứ Sáu", "21.0,105.8", "Hà Nội", None,
    "Bình thường", "Chưa", "VP", "2026-09-19T10:00:00.000Z",
]

tsql, ordered = m.translate_sql(PG, params)
print("T-SQL OK, params:", len(ordered))

cn = pyodbc.connect(m.CONN_STR, timeout=15)
cur = cn.cursor()

# 1. INSERT lần 1 (không có dòng cũ) — when not matched
cur.execute(tsql, ordered)
cn.commit()
print("Lan 1 (not matched): rowcount =", cur.rowcount)

# 2. INSERT lần 2 — updated_at MỚI HƠN → khi matched AND điều kiện đúng → update
params2 = params.copy()
params2[1] = "Probe Test UPDATED"
params2[12] = "2026-09-19T11:00:00.000Z"
tsql2, ordered2 = m.translate_sql(PG, params2)
cur.execute(tsql2, ordered2)
cn.commit()
print("Lan 2 (matched, moi hon): rowcount =", cur.rowcount)

# 3. INSERT lần 3 — updated_at CŨ HƠN → điều kiện LWW chặn → KHÔNG đè
params3 = params.copy()
params3[1] = "Probe Test OLD — KHONG duoc de"
params3[12] = "2026-09-19T09:00:00.000Z"
tsql3, ordered3 = m.translate_sql(PG, params3)
cur.execute(tsql3, ordered3)
cn.commit()
print("Lan 3 (matched, cu hon — bi chan): rowcount =", cur.rowcount)

# 4. Verify trong DB
cur.execute("SELECT name, updated_at FROM attendance WHERE id = '__probe_att_fix1'")
row = cur.fetchone()
print("Ket qua DB:", row[0], "|", row[1])
ok = row[0] == "Probe Test UPDATED"
print("LWW hoat dong DUNG:", "PASS" if ok else "FAIL")

# 5. Dọn probe
cur.execute("DELETE FROM attendance WHERE id = '__probe_att_fix1'")
cn.commit()
print("Da don probe:", cur.rowcount, "dong")
cn.close()
