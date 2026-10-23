# -*- coding: utf-8 -*-
"""Probe query thật lên API Server đang chạy — INSERT attendance với WHERE-LWW."""
import json
import sys
import io
import urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

TOKEN = Path(__file__).resolve().parent.parent / "giong-apps/apps/banhang/agent/api_server/.secrets/api_token.txt"
tok = TOKEN.read_text(encoding="utf-8").strip()

BASE = "http://127.0.0.1:8777"

ATT = (
    "INSERT INTO attendance (id, name, status, time, date, weekday, gps, address, photo, type, approved, workplace, updated_at) "
    "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) "
    "ON CONFLICT (id) DO UPDATE SET "
    "name = EXCLUDED.name, status = EXCLUDED.status, time = EXCLUDED.time, "
    "date = EXCLUDED.date, weekday = EXCLUDED.weekday, gps = EXCLUDED.gps, "
    "address = EXCLUDED.address, photo = EXCLUDED.photo, workplace = EXCLUDED.workplace, "
    "updated_at = EXCLUDED.updated_at "
    "WHERE attendance.updated_at < EXCLUDED.updated_at"
)
params = [
    "__probe_att_001", "__probe Ten", "Vào ca", "10:00", "2026-09-19",
    "Thứ Sáu", "21.0,105.8", "Hà Nội", None,
    "Bình thường", "Chưa", "VP", "2026-09-19T10:00:00.000Z",
]

req = urllib.request.Request(
    f"{BASE}/query",
    data=json.dumps({"text": ATT, "params": params}).encode("utf-8"),
    headers={"content-type": "application/json", "x-api-token": tok},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=25) as r:
        print("HTTP", r.status, r.read().decode("utf-8")[:400])
except urllib.error.HTTPError as e:
    print("HTTP", e.code)
    print(e.read().decode("utf-8")[:800])
