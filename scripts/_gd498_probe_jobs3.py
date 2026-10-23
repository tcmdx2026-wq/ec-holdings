"""GĐ 498 — Dump 84 job hôm nay ra file gọn + kiểm tra CDP/Chrome + scheduled_tasks. Chỉ-đọc."""
import base64, json, urllib.request, socket, collections
from pathlib import Path

BASE = "http://127.0.0.1:8777"
AGENT = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent/.secrets/agent_token.txt").read_text(encoding="utf-8").strip()
API = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent/api_server/.secrets/api_token.txt").read_text(encoding="utf-8").strip()
USER = base64.b64encode(json.dumps({"empId": "probe", "name": "probe", "role": "SuperAdmin", "mods": []}).encode()).decode()
OUT = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/scripts/_gd498_jobs_today.txt")


def call(path, body=None, headers=None):
    h = {"x-bh-user": USER}
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


jobs = call("/jobs", headers={"Authorization": "Bearer " + AGENT}).get("jobs") or []
TODAY = "2026-10-21"
today = sorted([j for j in jobs if str(j.get("created_at") or "").startswith(TODAY)], key=lambda x: str(x.get("created_at")))

lines = [f"{str(j.get('id'))[:8]} | {str(j.get('created_at'))[11:19]} | {j.get('report')!s:20} | {j.get('status'):10} | {j.get('date_from')}→{j.get('date_to')} | files={len(j.get('files') or [])} | {str(j.get('error') or '')[:60]!r}" for j in today]
OUT.write_text("\n".join(lines), encoding="utf-8")
print("Da ghi", OUT, len(lines), "dong")

# Full errors ra file rieng
errs = []
for j in today:
    if j.get("status") == "error":
        errs.append(f"\n{'='*90}\nJOB {str(j.get('id'))[:8]} | {j.get('created_at')} | report={j.get('report')} | {j.get('date_from')}→{j.get('date_to')}\n{'='*90}\n{j.get('error') or ''}\n")
Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/scripts/_gd498_errors_today.txt").write_text("\n".join(errs), encoding="utf-8")
print("errors:", len(errs))

# CDP 9222 song khong?
s = socket.socket(); s.settimeout(3)
try:
    s.connect(("127.0.0.1", 9222)); print("CDP 9222: MO")
except Exception as e:
    print("CDP 9222:", type(e).__name__, e)
finally:
    s.close()

try:
    ver = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/version", timeout=4).read().decode())
    print("CDP version:", ver.get("Browser"), "| ws:", str(ver.get("webSocketDebuggerUrl"))[:60])
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=4).read().decode())
    print("CDP so tab:", len(tabs))
    for t in tabs[:8]:
        print("   -", t.get("type"), "|", (t.get("title") or "")[:50], "|", (t.get("url") or "")[:70])
except Exception as e:
    print("CDP /json loi:", type(e).__name__, e)

# scheduled_tasks
for sql in [
    "select top 60 name, status, last_run_at, last_status, note from dbo.scheduled_tasks order by name",
    "select top 30 name from sys.tables where name like '%task%' or name like '%sched%'",
]:
    try:
        r = call("/query", {"text": sql}, headers={"x-api-token": API})
        print("\nSQL:", sql, "\n", json.dumps(r, ensure_ascii=False)[:2500])
    except Exception as e:
        print("\nSQL loi:", sql, "->", e)
