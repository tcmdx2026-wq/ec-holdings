"""GĐ 498 — Probe jobs hôm nay 21/10/2026 (chỉ-đọc). In bản gọn."""
import base64, json, urllib.request, collections, sys
from pathlib import Path

BASE = "http://127.0.0.1:8777"
TOKEN = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent/.secrets/agent_token.txt").read_text(encoding="utf-8").strip()
USER = base64.b64encode(json.dumps({"empId": "probe", "name": "probe", "role": "SuperAdmin", "mods": []}).encode()).decode()


def get(path):
    req = urllib.request.Request(BASE + path, headers={
        "Authorization": "Bearer " + TOKEN,
        "x-bh-user": USER,
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


data = get("/jobs")
jobs = data.get("jobs") or []
print("TONG jobs tra ve:", len(jobs))
if jobs:
    print("Cot job:", sorted(jobs[0].keys()))

TODAY = "2026-10-21"
today = [j for j in jobs if str(j.get("created_at") or "").startswith(TODAY)]
print("JOBS HOM NAY:", len(today))

by_status = collections.Counter(j.get("status") for j in today)
print("Trang thai:", dict(by_status))

by_kind = collections.Counter(j.get("kind") or j.get("job_type") or j.get("type") for j in today)
print("Loai job:", dict(by_kind))

print("\n--- TAT CA JOB HOM NAY (id8 | gio | loai | trang thai | progress | error) ---")
for j in sorted(today, key=lambda x: str(x.get("created_at"))):
    err = (j.get("error") or j.get("error_message") or "")
    err = err.replace("\n", " ")[:140]
    prog = (j.get("progress") or j.get("message") or "")
    prog = str(prog).replace("\n", " ")[:100]
    print(f"{str(j.get('id'))[:8]} | {str(j.get('created_at'))[11:19]} | {j.get('kind') or j.get('job_type') or j.get('type')} | {j.get('status')} | {prog} | {err}")
