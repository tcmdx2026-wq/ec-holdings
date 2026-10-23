# -*- coding: utf-8 -*-
"""GĐ 433 — Backup định kỳ GiondDB (SQL Server Express .\\SQLEXPRESS).

Vì sao: GĐ 431 cảnh báo login State 38 + GĐ 433 chẩn đoán ra GiongDB bật
AUTO_CLOSE (đã tắt) — kèm phát hiện GiongDB CHƯA TỪNG có backup nào. Script
này chạy hằng ngày qua Task Scheduler (02:00, account SYSTEM — cùng account
service SQL ghi được thư mục backup).

Mỗi bản: BACKUP full WITH CHECKSUM + RESTORE VERIFYONLY (chứng minh bản
backup đọc lại được) + giữ 14 bản gần nhất (2 tuần), xóa dần bản cũ.
Log: <BACKUP_DIR>/backup.log
Chạy tay: python scripts/gionddb-backup.py
"""
import glob
import os
import sys
from datetime import datetime

BACKUP_DIR = r"D:\DuLieuChung\CUONG_2026\backups\GiondDB"
KEEP = 14
LOG = os.path.join(BACKUP_DIR, "backup.log")

CONN_STR = (
    "Driver={ODBC Driver 18 for SQL Server};Server=.\\SQLEXPRESS;Database=master;"
    "Trusted_Connection=yes;TrustServerCertificate=yes"
)


def log(msg: str) -> None:
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}"
    print(line)
    os.makedirs(BACKUP_DIR, exist_ok=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def main() -> int:
    import pyodbc

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(BACKUP_DIR, f"gionddb_full_{ts}.bak")
    cn = pyodbc.connect(CONN_STR, timeout=600, autocommit=True)
    cur = cn.cursor()

    log(f"Bắt đầu backup → {os.path.basename(path)}")
    cur.execute(
        f"BACKUP DATABASE GiongDB TO DISK = N'{path}' WITH INIT, CHECKSUM, "
        f"NAME = N'GiondDB full {ts}'"
    )
    while cur.nextset():
        pass
    size_mb = os.path.getsize(path) // (1024 * 1024)
    log(f"BACKUP xong — {size_mb} MB")

    cur.execute(f"RESTORE VERIFYONLY FROM DISK = N'{path}' WITH CHECKSUM")
    log("VERIFYONLY OK — bản backup hợp lệ, đọc lại được")
    cn.close()

    files = sorted(glob.glob(os.path.join(BACKUP_DIR, "gionddb_full_*.bak")))
    for old in files[:-KEEP]:
        os.remove(old)
        log(f"Xóa bản cũ: {os.path.basename(old)}")
    log(f"Hoàn tất — giữ {min(len(files), KEEP)} bản gần nhất")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001 — log mọi lỗi để Task Scheduler soi được
        log(f"LỖI BACKUP: {e}")
        sys.exit(1)
