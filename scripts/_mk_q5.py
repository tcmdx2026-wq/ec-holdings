import json
payload = {
    "text": "insert into smed_pull_jobs (id, report, date_from, date_to, mode, status, total_centers, output_dir, publish_status, cqt_status, query_key, created_by, error) values ('00000000-0000-0000-0000-00000000d172', 'test_unicode', '01/01/2026', '01/01/2026', 'headless', 'cancel', 1, '', '', '', '', 'test', $2)",
    "params": ["Đã hủy bởi người dùng — test unicode Ế"],
}
open("/tmp/q5.json", "w", encoding="utf-8").write(json.dumps(payload, ensure_ascii=False))
print("written")
