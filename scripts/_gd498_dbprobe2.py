"""GĐ 498 — Probe MISA 20/10 + Task_06/05 + ETL 21/10 (chỉ-đọc)."""
import json, urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:8777"
API = Path(r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps/apps/banhang/agent/api_server/.secrets/api_token.txt").read_text(encoding="utf-8").strip()


def q(sql, params=None):
    body = json.dumps({"text": sql, "params": params or []}).encode()
    req = urllib.request.Request(BASE + "/query", data=body, headers={"Content-Type": "application/json", "x-api-token": API})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8")).get("rows") or []


def show(title, sql, limit=20):
    print(f"\n=== {title} ===")
    try:
        for r in q(sql)[:limit]:
            print("  ", json.dumps(r, ensure_ascii=False, default=str)[:260])
    except Exception as e:
        print("   LỖI:", e)


show("Bang bang co the lien quan MISA ban hang", "select name from sys.tables where name like '%banhang%' or name like '%bh_%' or name like 'sm_%' or name like '%misa%'")

show("Task_06 + Task_05 + Task_03 - 3 ban ghi moi nhat", """
select top 9 name, status, convert(char(19), created_at, 120) as t_created, ISNULL(error,'') as err
from dbo.scheduled_tasks
where name like 'Task_0[356]%'
order by created_at desc
""", 9)
