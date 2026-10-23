"""Cập nhật TUNNEL_API_BASE_URL trong .env.local cả 2 app từ GitHub Gist.

Chạy từ GỐC giong-vn-v6 (script update-tunnel-local.bat gọi). URL tunnel
Quick Tunnel đổi mỗi lần service restart — app local đọc .env.local lúc
khởi động dev server nên phải cập nhật rồi chạy lại start-local.bat.
Exit 1 khi lấy URL thất bại (.bat hiện báo lỗi).

Lịch sử: GĐ 228 tạo .bat inline python (dòng lệnh quá dài + echo tiếng
Việt vỡ encoding khi chcp 65001 không ăn) — GĐ 276 tách ra script file
này, .bat chỉ gọi. URL live = Gist giong-tunnel-gist.txt (GĐ 169).
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

GIST_URL = "https://api.github.com/gists/db3dae34ac285bc7935a72f365cb0d21"
ENV_FILES = [Path(".env.local"), Path("giong-apps/apps/banhang/.env.local")]


def main() -> int:
    try:
        req = urllib.request.Request(
            GIST_URL, headers={"User-Agent": "giong-vn-agent"}
        )
        gist = json.loads(urllib.request.urlopen(req, timeout=15).read())
        m = re.search(
            r"base_url:\s*(\S+)", gist["files"]["giong-tunnel-gist.txt"]["content"]
        )
        if not m:
            print("[LOI] Gist khong co base_url — tunnel chua ghi?")
            return 1
        url = m.group(1).strip()
        print(f"URL moi tu Gist: {url}")
    except Exception as e:
        print(f"[LOI] Khong lay duoc Gist: {e}")
        return 1

    ok_any = False
    for p in ENV_FILES:
        if not p.exists():
            print(f"Bo qua (khong co file): {p}")
            continue
        txt = p.read_text(encoding="utf-8")
        if re.search(r"^TUNNEL_API_BASE_URL\s*=", txt, re.M):
            new = re.sub(
                r"(?m)^(TUNNEL_API_BASE_URL\s*=\s*'?)https?://[^\s'\n]+",
                r"\g<1>" + url,
                txt,
            )
        else:
            new = txt.rstrip("\n") + f"\nTUNNEL_API_BASE_URL={url}\n"
        p.write_text(new, encoding="utf-8", newline="\n")
        print(f"Da cap nhat: {p}")
        ok_any = True

    if not ok_any:
        print("[LOI] Khong tim thay file .env.local nao — bao tro ly biet.")
        return 1
    print("\nXong! Dong 2 cua so app (neu dang mo) roi chay lai start-local.bat")
    return 0


if __name__ == "__main__":
    sys.exit(main())
