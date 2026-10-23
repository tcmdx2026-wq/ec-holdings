# -*- coding: utf-8 -*-
"""GĐ 500 — Chạy lại các job lỗi hôm nay: xuatkho/xnkt/hddt 21/10 + bank-tpb 18-20/10."""
import base64, json, urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:8777"
AGENT = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent/.secrets/agent_token.txt").read_text(encoding="utf-8").strip()
USER = base64.b64encode(json.dumps({
    "empId": "gd500-rerun", "name": "GD500 Rerun (Đại Ca yêu cầu khắc phục)",
    "role": "SuperAdmin", "mods": [],
}).encode()).decode()

JOBS = [
    ("xuatkho", "21/10/2026", "21/10/2026"),
    ("xnkt", "21/10/2026", "21/10/2026"),
    ("hddt", "21/10/2026", "21/10/2026"),
    ("bank-tpb", "18/10/2026", "18/10/2026"),
    ("bank-tpb", "19/10/2026", "19/10/2026"),
    ("bank-tpb", "20/10/2026", "20/10/2026"),
]

for report, df, dt in JOBS:
    body = json.dumps({"report": report, "dateFrom": df, "dateTo": dt, "mode": "headless"}).encode()
    req = urllib.request.Request(BASE + "/jobs", data=body, headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + AGENT,
        "x-bh-user": USER,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.loads(r.read().decode())
        print(f"OK  {report:10} {df} → job {res.get('id','')[:8]}")
    except urllib.error.HTTPError as e:
        print(f"LOI {report:10} {df} → HTTP {e.code}: {e.read().decode()[:200]}")
