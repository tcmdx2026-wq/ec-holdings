# -*- coding: utf-8 -*-
"""Nạp backup Neon (JSON) vào GiongDB (SQL Server) — app tổng GIONG VN.

Chạy trên máy chủ công ty (nơi có SQL Server .\\SQLEXPRESS).
Idempotent: chạy lại = nạp ĐÈ toàn bộ dữ liệu (source of truth = file backup mới nhất).

Dùng: python scripts/seed-giongdb-from-backup.py
"""
import json
import glob
import os
import sys
from datetime import datetime, date
import pyodbc

ATT_DIR = r"D:\DuLieuChung\CUONG_2026\giong-vn-v6\attachments"
CONN_STR = (
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=.\\SQLEXPRESS;Database=GiongDB;"
    "Trusted_Connection=yes;Encrypt=no;TrustServerCertificate=yes;"
)

TS_KEYS = {
    "created_at", "updated_at", "deleted_at", "requested_at", "reviewed_at",
    "approved_at", "added_at", "applied_at",
    "createdAt", "updatedAt", "expiresAt",
}
DATE_KEYS = {"hire_date"}

# --- DDL tường minh cho các bảng KHÔNG có trong backup (tạo rỗng) ---
EXTRA_DDL = [
    # Better Auth (camelCase giữ nguyên — app query bằng quoted identifier)
    """IF OBJECT_ID(N'dbo.[user]') IS NULL CREATE TABLE dbo.[user] (
  [id] NVARCHAR(64) NOT NULL PRIMARY KEY,
  [name] NVARCHAR(MAX) NOT NULL,
  [email] NVARCHAR(320) NOT NULL,
  [emailVerified] BIT NOT NULL DEFAULT 0,
  [image] NVARCHAR(MAX) NULL,
  [createdAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [updatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
)""",
    """IF OBJECT_ID(N'dbo.[session]') IS NULL CREATE TABLE dbo.[session] (
  [id] NVARCHAR(64) NOT NULL PRIMARY KEY,
  [expiresAt] DATETIME2 NOT NULL,
  [token] NVARCHAR(128) NOT NULL,
  [createdAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [updatedAt] DATETIME2 NOT NULL,
  [ipAddress] NVARCHAR(MAX) NULL,
  [userAgent] NVARCHAR(MAX) NULL,
  [userId] NVARCHAR(64) NOT NULL
)""",
    """IF OBJECT_ID(N'dbo.[account]') IS NULL CREATE TABLE dbo.[account] (
  [id] NVARCHAR(64) NOT NULL PRIMARY KEY,
  [accountId] NVARCHAR(MAX) NOT NULL,
  [providerId] NVARCHAR(64) NOT NULL,
  [userId] NVARCHAR(64) NOT NULL,
  [accessToken] NVARCHAR(MAX) NULL,
  [refreshToken] NVARCHAR(MAX) NULL,
  [idToken] NVARCHAR(MAX) NULL,
  [accessTokenExpiresAt] DATETIME2 NULL,
  [refreshTokenExpiresAt] DATETIME2 NULL,
  [scope] NVARCHAR(MAX) NULL,
  [password] NVARCHAR(MAX) NULL,
  [createdAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [updatedAt] DATETIME2 NOT NULL
)""",
    """IF OBJECT_ID(N'dbo.[verification]') IS NULL CREATE TABLE dbo.[verification] (
  [id] NVARCHAR(64) NOT NULL PRIMARY KEY,
  [identifier] NVARCHAR(MAX) NOT NULL,
  [value] NVARCHAR(MAX) NOT NULL,
  [expiresAt] DATETIME2 NOT NULL,
  [createdAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [updatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
)""",
    """IF OBJECT_ID(N'dbo.module_access') IS NULL CREATE TABLE dbo.module_access (
  employee_id NVARCHAR(64) NOT NULL PRIMARY KEY,
  modules NVARCHAR(MAX) NOT NULL DEFAULT '{}',
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
)""",
    """IF OBJECT_ID(N'dbo.push_subscriptions') IS NULL CREATE TABLE dbo.push_subscriptions (
  [id] NVARCHAR(64) NOT NULL PRIMARY KEY,
  endpoint NVARCHAR(MAX) NOT NULL,
  p256dh NVARCHAR(MAX) NOT NULL,
  [auth] NVARCHAR(MAX) NOT NULL,
  employee_id NVARCHAR(64) NOT NULL DEFAULT '',
  employee_name NVARCHAR(200) NOT NULL DEFAULT '',
  user_agent NVARCHAR(MAX) NOT NULL DEFAULT '',
  created_at DATETIME2 NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NULL DEFAULT SYSUTCDATETIME()
)""",
    """IF OBJECT_ID(N'dbo.kv_settings') IS NULL CREATE TABLE dbo.kv_settings (
  [key] NVARCHAR(128) NOT NULL PRIMARY KEY,
  [value] NVARCHAR(MAX) NULL,
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
)""",
    """IF OBJECT_ID(N'dbo._migrations') IS NULL CREATE TABLE dbo._migrations (
  filename NVARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
)""",
]

# Migration files của app tổng — đánh dấu ĐÃ ÁP (schema do script này tạo)
MIGRATION_FILES = [f"{i:04d}" for i in range(1, 30)]


def pick_backup_file():
    files = sorted(glob.glob(os.path.join(ATT_DIR, "giong-vn-backup-*.json")))
    if not files:
        print("KHONG tim thay file backup trong", ATT_DIR)
        sys.exit(1)
    return files[-1]


KEY_CANDIDATES = {
    "id", "group_id", "employee_id", "key", "token",
}


def sql_type(key, values):
    if key in TS_KEYS:
        return "DATETIME2"
    if key in DATE_KEYS:
        return "DATE"
    if key in KEY_CANDIDATES:
        return "NVARCHAR(128)"
    non_null = [v for v in values if v is not None]
    if non_null and all(isinstance(v, bool) for v in non_null):
        return "BIT"
    # đo độ dài thật trên TẤT CẢ giá trị (dict/list sẽ thành JSON string lúc insert)
    max_len = max((len(str(v)) for v in non_null), default=0)
    if max_len <= 3900:
        return f"NVARCHAR({max(50, min(4000, max_len + 100))})"
    return "NVARCHAR(MAX)"


def convert(key, v):
    if v is None:
        return None
    if key in TS_KEYS:
        if isinstance(v, str):
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            return dt.replace(tzinfo=None)  # naive UTC — giá trị tuyệt đối giữ nguyên
        if isinstance(v, (int, float)):
            return datetime.utcfromtimestamp(v / 1000)
        return v
    if key in DATE_KEYS and isinstance(v, str):
        return datetime.strptime(v[:10], "%Y-%m-%d").date()
    if isinstance(v, bool):
        return 1 if v else 0
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, (int, float, datetime, date)):
        return v
    return str(v)


def table_exists(cn, name):
    cur = cn.execute("SELECT COUNT(*) FROM sys.tables WHERE name = ?", name)
    return cur.fetchone()[0] > 0


def create_dynamic_table(cn, name, rows):
    sample = rows[0]
    pk = "id" if "id" in sample else None
    cols = []
    for k, v in sample.items():
        vals = [r.get(k) for r in rows]
        t = sql_type(k, vals)
        # khóa PHẢI NOT NULL (SQL Server bắt buộc); cột backup có thể thiếu → kềm dữ liệu None
        is_key = (pk and k == pk) or (not pk and k in ("group_id", "employee_id"))
        cols.append(f"[{k}] {t}" + (" NOT NULL" if is_key else " NULL"))
    if pk:
        ddl = f"IF OBJECT_ID(N'dbo.{name}') IS NULL CREATE TABLE dbo.{name} (\n  "
        ddl += ",\n  ".join(cols)
        ddl += f",\n  PRIMARY KEY ([{pk}])\n)"
    else:
        # chat_group_members — composite key
        ddl = f"IF OBJECT_ID(N'dbo.{name}') IS NULL CREATE TABLE dbo.{name} (\n  "
        ddl += ",\n  ".join(cols)
        ddl += ",\n  PRIMARY KEY ([group_id], [employee_id])\n)"
    cn.execute(ddl)


def main():
    backup = pick_backup_file()
    print(f"[seed] Backup: {os.path.basename(backup)}")
    with open(backup, encoding="utf-8") as f:
        data = json.load(f)["data"]

    cn = pyodbc.connect(CONN_STR)
    cn.timeout = 30

    # 0) Xóa bảng mirror schema-rút-gọn của app con (Bước 2) — seed full schema thay thế.
    #    Full schema là superset (đủ code/name/short_name/status cho /api/units app con).
    for old in ("employees", "centers"):
        cn.execute(f"IF OBJECT_ID(N'dbo.{old}') IS NOT NULL DROP TABLE dbo.{old}")
    cn.commit()
    print("[seed] Drop mirror cu (employees, centers) neu co")

    # 1) DDL tường minh (auth + kv + _migrations...)
    for ddl in EXTRA_DDL:
        cn.execute(ddl)
    cn.commit()
    print(f"[seed] Extra DDL: {len(EXTRA_DDL)} bang")

    # 2) Tạo bảng động + nạp đè từng bảng
    for tname, rows in data.items():
        if not rows:
            print(f"[seed] {tname}: 0 rows — bo qua")
            continue
        if not table_exists(cn, tname):
            create_dynamic_table(cn, tname, rows)
            print(f"[seed] {tname}: TAO BANG MOI")
        cols = list(rows[0].keys())
        col_list = ", ".join(f"[{c}]" for c in cols)
        ph = ", ".join("?" for _ in cols)
        cn.execute(f"DELETE FROM dbo.{tname}")
        cur = cn.cursor()
        # KHÔNG bật fast_executemany — nó đo buffer theo dòng đầu, dòng sau dài hơn bị truncate
        batch = []
        for r in rows:
            batch.append(tuple(convert(c, r.get(c)) for c in cols))
            if len(batch) >= 500:
                cur.executemany(f"INSERT INTO dbo.{tname} ({col_list}) VALUES ({ph})", batch)
                batch = []
        if batch:
            cur.executemany(f"INSERT INTO dbo.{tname} ({col_list}) VALUES ({ph})", batch)
        print(f"[seed] {tname}: nap {len(rows)} rows")

    # 3) Đánh dấu migrations đã áp
    for mf in MIGRATION_FILES:
        cn.execute(
            "IF NOT EXISTS (SELECT 1 FROM dbo._migrations WHERE filename LIKE ?) "
            "INSERT INTO dbo._migrations (filename) VALUES (?)",
            mf + "%", mf + "_seeded_by_script",
        )
    cn.commit()

    # 4) Verify
    print("\n=== VERIFY ===")
    for tname, rows in sorted(data.items()):
        n = cn.execute(f"SELECT COUNT(*) FROM dbo.{tname}").fetchone()[0]
        mark = "OK" if n == len(rows) else f"!! expected {len(rows)}"
        print(f"{tname}: {n} {mark}")
    for extra in ("[user]", "[session]", "[account]", "[verification]", "module_access", "kv_settings"):
        n = cn.execute(f"SELECT COUNT(*) FROM dbo.{extra}").fetchone()[0]
        print(f"{extra}: {n}")

    # Sample kiểm tra dữ liệu tiếng Việt + JSON
    row = cn.execute("SELECT TOP 1 name, status, updated_at FROM dbo.employees WHERE email = ?", "cuongpk.giong04@gmail.com").fetchone()
    print("\nSample admin:", row)
    cn.close()
    print("\n[seed] HOAN THANH")


if __name__ == "__main__":
    main()
