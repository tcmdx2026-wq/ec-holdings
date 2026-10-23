import json
import os
import re
import tempfile
import urllib.error
import urllib.request

tmp = os.environ.get("TEMP", tempfile.gettempdir())
gist_path = os.path.join(tmp, "gist_url.txt")
if not os.path.exists(gist_path):
    gist_path = "/tmp/gist_url.txt"
gist = open(gist_path, encoding="utf-8").read().strip()
token = open("giong-apps/apps/banhang/agent/api_server/.secrets/api_token.txt", encoding="utf-8").read().strip()

import re
m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", urllib.request.urlopen(gist).read().decode("utf-8"))
tunnel = m.group(0)
out = []
out.append(f"tunnel: {tunnel}")

payload_path = os.path.join(tmp, "q5.json")
if not os.path.exists(payload_path):
    payload_path = "/tmp/q5.json"
payload = open(payload_path, "rb").read()
req = urllib.request.Request(
    tunnel + "/query",
    data=payload,
    headers={"x-api-token": token, "Content-Type": "application/json"},
    method="POST",
)
try:
    r = urllib.request.urlopen(req).read().decode("utf-8")
except urllib.error.HTTPError as e:
    r = e.read().decode("utf-8")
out.append(f"insert: {r}")

q6 = json.dumps({"text": "select error from smed_pull_jobs where id = '00000000-0000-0000-0000-00000000d172'"})
req2 = urllib.request.Request(
    tunnel + "/query",
    data=q6.encode("utf-8"),
    headers={"x-api-token": token, "Content-Type": "application/json"},
    method="POST",
)
try:
    r2 = urllib.request.urlopen(req2).read().decode("utf-8")
except urllib.error.HTTPError as e:
    r2 = e.read().decode("utf-8")
out.append(f"read-back: {r2}")

open("/tmp/unicode_result.txt", "w", encoding="utf-8").write("\n".join(out))
print("OK — kết quả trong /tmp/unicode_result.txt")
