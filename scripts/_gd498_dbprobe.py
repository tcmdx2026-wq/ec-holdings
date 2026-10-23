"""GĐ 498 — Probe DB GiongDB qua /query (chỉ-đọc). In gọn."""
import json, sys, urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:8777"
API = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent/api_server/.secrets/api_token.txt").read_text(encoding="utf-8").strip()


def q(sql, params=None):
    body = json.dumps({"text": sql, "params": params or []}).encode()
    req = urllib.request.Request(BASE + "/query", data=body, headers={
        "Content-Type": "application/json",
        "x-api-token": API,
    })
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8")).get("rows") or []


def show(title, sql, limit=25):
    print(f"\n=== {title} ===")
    try:
        rows = q(sql)
        for i, r in enumerate(rows[:limit]):
            print("  ", json.dumps(r, ensure_ascii=False, default=str)[:240])
        if len(rows) > limit:
            print(f"   ... (+{len(rows)-limit} dòng)")
    except Exception as e:
        print("   LỖI:", e)


# 1) scheduled_tasks hôm nay + gần đây
show("scheduled_tasks 3 ngày gần nhất", """
select top 30 name, status, config, convert(char(19), created_at, 120) as t_created
from dbo.scheduled_tasks
where created_at >= dateadd(day, -2, sysdatetime())
order by created_at desc
""", 30)

# 2) accounts SMED
show("smed_accounts", "select top 10 accountKey, user, baseUrl from dbo.smed_accounts")

# 3) Task_02 config (chuỗi bước tối nay)
show("Task_02 daily config", "select top 3 name, config from dbo.scheduled_tasks where name like 'Task_02%' and kind='daily' order by created_at desc")

# 4) kv_settings task_schedule_paused
show("kv_settings", "select k, v from dbo.kv_settings")

# 5) job xuatkho/xnkt/hddt/bank-tpb lịch sử gần nhất (cho biết lần cuối thành công)
show("job SMED gần nhất theo report", """
select report, status, convert(char(19), created_at, 120) as t, date_from, date_to
from dbo.smed_pull_jobs
where report in ('xuatkho','xnkt','hddt','bank-tpb','bank-tcb','bank-vcb')
  and created_at >= dateadd(day, -4, sysdatetime())
order by created_at desc
""", 40)
