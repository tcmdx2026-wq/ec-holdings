"""GĐ 498 — Probe chi tiết hôm nay: nhóm theo report + lỗi đầy đủ + scheduled_tasks. Chỉ-đọc."""
import base64, json, urllib.request, collections
from pathlib import Path

BASE = "http://127.0.0.1:8777"
AGENT = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent/.secrets/agent_token.txt").read_text(encoding="utf-8").strip()
API = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent/api_server/.secrets/api_token.txt").read_text(encoding="utf-8").strip()
USER = base64.b64encode(json.dumps({"empId": "probe", "name": "probe", "role": "SuperAdmin", "mods": []}).encode()).decode()


def call(path, body=None, headers=None):
    h = {"x-bh-user": USER}
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


jobs = call("/jobs", headers={"Authorization": "Bearer " + AGENT}).get("jobs") or []
TODAY = "2026-10-21"
today = [j for j in jobs if str(j.get("created_at") or "").startswith(TODAY)]

print("=== NHOM THEO (report, query_key) x STATUS ===")
grp = collections.Counter((j.get("report"), j.get("query_key"), j.get("status")) for j in today)
for (rep, qk, st), n in sorted(grp.items(), key=lambda x: str(x[0])):
    print(f"{rep!s:22} | {qk!s:24} | {st:10} | {n}")

print("\n=== JOB ERROR — NOI DUNG DAY DU (tail 700) ===")
for j in today:
    if j.get("status") == "error":
        err = str(j.get("error") or "")
        print(f"\n--- {str(j.get('id'))[:8]} | {str(j.get('created_at'))[11:19]} | report={j.get('report')} qk={j.get('query_key')} | {j.get('date_from')}→{j.get('date_to')} | error len={len(err)}")
        print(err[-700:].replace("\\n", "\n"))

print("\n=== JOB needsData — report/query_key + error/info ===")
for j in today:
    if j.get("status") == "needsData":
        err = str(j.get("error") or j.get("result") or "")[:200].replace("\n", " ")
        print(f"{str(j.get('id'))[:8]} | {str(j.get('created_at'))[11:19]} | {j.get('report')} | {j.get('query_key')} | {j.get('date_from')}→{j.get('date_to')} | no_data={j.get('no_data')} | {err}")

print("\n=== BANG scheduled_tasks (neu co) ===")
try:
    r = call("/query", {"sql": "select top 40 name, status, last_run, last_status, next_run from dbo.scheduled_tasks order by name"}, headers={"x-api-token": API})
    print(json.dumps(r, ensure_ascii=False, indent=1)[:3000])
except Exception as e:
    print("scheduled_tasks loi:", e)
    try:
        r = call("/query", {"sql": "select top 30 table_name from information_schema.tables where table_name like '%task%' or table_name like '%sched%'"}, headers={"x-api-token": API})
        print("Bang lien quan:", json.dumps(r, ensure_ascii=False)[:1500])
    except Exception as e2:
        print("fallback loi:", e2)
