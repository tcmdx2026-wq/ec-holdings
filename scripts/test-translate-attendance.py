"""Test translate_sql với query INSERT attendance thật từ app tổng (GĐ 168)."""
import sys
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "api_server",
    str(Path(__file__).resolve().parent.parent / "giong-apps/apps/banhang/agent/api_server/api_server.py"),
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

ATT = """INSERT INTO attendance (id, name, status, time, date, weekday, gps, address, photo, type, approved, workplace, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6,
              $7, $8, $9,
              $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, status = EXCLUDED.status, time = EXCLUDED.time,
        date = EXCLUDED.date, weekday = EXCLUDED.weekday, gps = EXCLUDED.gps,
        address = EXCLUDED.address, photo = EXCLUDED.photo, workplace = EXCLUDED.workplace,
        updated_at = EXCLUDED.updated_at
      WHERE attendance.updated_at < EXCLUDED.updated_at"""

tsql, ordered = m.translate_sql(ATT, [f"p{i}" for i in range(1, 14)])
print("=== T-SQL ===")
print(tsql)
print()
print("=== Params:", len(ordered), ordered[:3], "...")

# Đếm dấu ? — phải = 13 (mỗi param dùng ĐÚNG 1 lần)
n_q = tsql.count("?")
print(f"Số dấu ? trong T-SQL: {n_q} (kỳ vọng 13)")
