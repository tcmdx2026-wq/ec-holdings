import json
import os
import re
import urllib.error
import urllib.request

tmp = "C:/Users/ADMINI~1/AppData/Local/Temp"
gist = open(os.path.join(tmp, "gist_url.txt"), encoding="utf-8").read().strip()
token = open("giong-apps/apps/banhang/agent/api_server/.secrets/api_token.txt", encoding="utf-8").read().strip()
m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", urllib.request.urlopen(gist).read().decode("utf-8"))
tunnel = m.group(0)

results = []

def call(body: bytes, label: str):
    req = urllib.request.Request(
        tunnel + "/query",
        data=body,
        headers={"x-api-token": token, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        r = urllib.request.urlopen(req).read().decode("utf-8")
    except urllib.error.HTTPError as e:
        r = e.read().decode("utf-8")
    results.append(f"{label}: {r}")

# Test A: unicode có em-dash (—) — nghi ngờ ký tự này gây lỗi json decode phía API Server
payload_a = {
    "text": "insert into smed_pull_jobs (id, report, date_from, date_to, mode, status, total_centers, output_dir, publish_status, cqt_status, query_key, created_by, error) values ('00000000-0000-0000-0000-00000000d172', 'test_unicode', '01/01/2026', '01/01/2026', 'headless', 'cancel', 1, '', '', '', '', 'test', $2)",
    "params": ["Đã hủy bởi người dùng — test unicode Ế"],
}
call(json.dumps(payload_a, ensure_ascii=False).encode("utf-8"), "A unicode+emdash")

# Test B: unicode KHÔNG em-dash
payload_b = {
    "text": "insert into smed_pull_jobs (id, report, date_from, date_to, mode, status, total_centers, output_dir, publish_status, cqt_status, query_key, created_by, error) values ('00000000-0000-0000-0000-00000000d173', 'test_unicode', '01/01/2026', '01/01/2026', 'headless', 'cancel', 1, '', '', '', '', 'test', $2)",
    "params": ["Đã hủy bởi người dùng"],
}
call(json.dumps(payload_b, ensure_ascii=False).encode("utf-8"), "B unicode thuan")

# Đọc lại cả 2
call(json.dumps({"text": "select id, error from smed_pull_jobs where id like '00000000-0000-0000-0000-00000000d17%'" }).encode("utf-8"), "read-back")

# Dọn test
call(json.dumps({"text": "delete from smed_pull_jobs where id like '00000000-0000-0000-0000-00000000d17%'"}).encode("utf-8"), "cleanup")

open("scripts/_unicode_result_copy.txt", "w", encoding="utf-8").write("\n\n".join(results))
print("done")
