# GĐ 498/C.319 — probe deployments app con qua Vercel REST API (Code in kết quả nhỏ — quy tắc Think in Code)
import json, os, urllib.request, time

tok_p = os.path.expandvars(r"%APPDATA%/xdg.data/com.vercel.cli/auth.json")
tok = json.load(open(tok_p, encoding="utf-8"))
token = tok.get("token") if isinstance(tok, dict) else tok
if isinstance(token, dict):
    token = token.get("token")

def api(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    return json.load(urllib.request.urlopen(req, timeout=30))

# lấy project id
pj = api("https://api.vercel.com/v9/projects/giong-banhang?teamId=giong-vn")
pid = pj["id"]
print("project id =", pid, "| target prod:", pj.get("latestDeployments") is not None)

ds = api(f"https://api.vercel.com/v6/deployments?projectId={pid}&teamId=giong-vn&limit=6")
for d in ds.get("deployments", []):
    t = time.strftime("%d/%m %H:%M:%S", time.localtime(d["createdAt"] / 1000))
    meta = d.get("meta", {})
    print(f"{t} | {d.get('state'):9} | {d['uid'][:16]} | sha={meta.get('githubCommitSha', '')[:7]} | msg={meta.get('githubCommitMessage','')[:60]}")
