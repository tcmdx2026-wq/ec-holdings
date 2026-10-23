#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GĐ 312 (03/10/2026) — ĐỔI MÔI TRƯỜNG ĐĂNG NHẬP LOCAL ĐA MÁY.

3 chế độ (chọn qua tham số):
  localhost (mặc định) — máy chủ:      http://localhost:3000 / :3100 (như cũ)
  lan                  — máy trạm LAN:  http://192.168.1.250:3000 / :3100 (IP tĩnh)
  public               — máy ngoài LAN: Quick Tunnel HTTPS cho cả 2 app
                         (tự spawn cloudflared + lấy URL, hoặc truyền sẵn
                         --url-main=... --url-con=...)

Việc script làm:
  1. Backup .env.local -> .env.local.bak-312 (ghi đè backup cũ).
  2. Ghi đúng các biến URL cho từng chế độ (giữ nguyên API_TOKEN,
     APP_JWT_SECRET, TUNNEL_API_BASE_URL... — chỉ đụng biến URL/auth-local).
  3. LAN: thêm LOCAL_EXTRA_ORIGINS + LOCAL_COOKIE_MODE=lan — Better Auth bỏ
     prefix __Host- + tắt Secure cookie (HTTP qua IP không phải secure context).
  4. PUBLIC: set BETTER_AUTH_URL + LOCAL_EXTRA_ORIGINS theo URL tunnel (HTTPS
     giữ nguyên cookie __Host- + Secure).

Sau khi chạy: ĐÓNG 2 cửa sổ app (nếu đang mở) rồi chạy lại start-local.bat —
dev server chỉ đọc env LÚC KHỞI ĐỘNG (bài học GĐ 228o).
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_MAIN = os.path.join(ROOT, ".env.local")
ENV_CON = os.path.join(ROOT, "giong-apps", "apps", "banhang", ".env.local")
LAN_IP_DEFAULT = "192.168.1.250"  # IP tĩnh máy chủ (Đại ca chốt GĐ 312)

# Chỉ dùng để TÌM cloudflared cho chế độ public (không sửa gì).
CLOUDFLARED_CANDIDATES = [
    os.path.join(ROOT, "giong-apps", "apps", "banhang", "agent", "api_server", "bin", "cloudflared.exe"),
    r"C:\Program Files (x86)\cloudflared\cloudflared.exe",
    r"C:\Program Files\cloudflared\cloudflared.exe",
]


def load_lines(path: str) -> list:
    with open(path, encoding="utf-8") as f:
        return f.read().splitlines()


def save_lines(path: str, lines: list) -> None:
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")


def apply_env(path: str, updates: dict, removals: tuple = ()) -> None:
    """Cập nhật/xóa biến theo key, giữ nguyên comment + thứ tự; thêm mới ở cuối."""
    shutil.copy2(path, path + ".bak-312")
    lines = load_lines(path)
    out, seen = [], set()
    for ln in lines:
        s = ln.strip()
        if s and not s.startswith("#"):
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=", s)
            if m:
                k = m.group(1)
                if k in removals:
                    seen.add(k)
                    continue
                if k in updates:
                    out.append(f"{k}={updates[k]}")
                    seen.add(k)
                    continue
        out.append(ln)
    for k, v in updates.items():
        if k not in seen:
            out.append(f"{k}={v}")
    save_lines(path, out)


def find_cloudflared() -> str:
    exe = shutil.which("cloudflared")
    if exe:
        return exe
    for c in CLOUDFLARED_CANDIDATES:
        if os.path.isfile(c):
            return c
    return ""


def start_quick_tunnel(port: int, log_path: str) -> str:
    """Spawn cloudflared Quick Tunnel (detached) + đợi URL trong log. Trả URL."""
    cf = find_cloudflared()
    if not cf:
        sys.exit(
            "[LOI] Khong tim thay cloudflared.exe — khong the mo Quick Tunnel.\n"
            "       Truyen san URL bang: --url-main=... --url-con=... "
            "(neu anh mo tunnel bang tay)."
        )
    flags = 0
    if os.name == "nt":
        flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
    with open(log_path, "ab") as logf:
        subprocess.Popen(
            [cf, "tunnel", "--url", f"http://localhost:{port}"],
            stdout=logf,
            stderr=subprocess.STDOUT,
            creationflags=flags,
        )
    deadline = time.time() + 75
    while time.time() < deadline:
        try:
            with open(log_path, "rb") as f:
                txt = f.read().decode("utf-8", errors="replace")
        except OSError:
            txt = ""
        m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", txt)
        if m:
            return m.group(0)
        time.sleep(1.5)
    sys.exit(f"[LOI] Khong lay duoc URL tunnel sau 75s — xem log: {log_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="GĐ 312 — switch local env mode")
    ap.add_argument("mode", nargs="?", default="localhost", choices=["localhost", "lan", "public"])
    ap.add_argument("--ip", default=LAN_IP_DEFAULT, help="IP LAN tĩnh của máy chủ (mặc định 192.168.1.250)")
    ap.add_argument("--url-main", default="", help="(public) URL tunnel app tổng — bỏ qua nếu dùng --start-tunnel")
    ap.add_argument("--url-con", default="", help="(public) URL tunnel app con — bỏ qua nếu dùng --start-tunnel")
    ap.add_argument("--start-tunnel", action="store_true", help="(public) tự spawn 2 Quick Tunnel + lấy URL")
    args = ap.parse_args()

    if args.mode == "localhost":
        apply_env(
            ENV_MAIN,
            {
                "APP_CON_URL": "http://localhost:3100",
                "VITE_APP_CON_URL": "http://localhost:3100",
                "MAIN_APP_URL": "http://localhost:3000",
            },
            removals=("BETTER_AUTH_URL", "LOCAL_EXTRA_ORIGINS", "LOCAL_COOKIE_MODE"),
        )
        apply_env(
            ENV_CON,
            {"APP_URL": "http://localhost:3100", "MAIN_APP_URL": "http://localhost:3000"},
            removals=("LOCAL_EXTRA_ORIGINS", "LOCAL_COOKIE_MODE"),
        )
        print("[OK] che do LOCALHOST — may chu mo http://localhost:3000 (+3100)")
    elif args.mode == "lan":
        ip = args.ip
        main_origins = f"http://{ip}:3000"
        apply_env(
            ENV_MAIN,
            {
                "APP_CON_URL": f"http://{ip}:3100",
                "VITE_APP_CON_URL": f"http://{ip}:3100",
                "MAIN_APP_URL": main_origins,
                "LOCAL_EXTRA_ORIGINS": main_origins,
                "LOCAL_COOKIE_MODE": "lan",
            },
            removals=("BETTER_AUTH_URL",),
        )
        apply_env(
            ENV_CON,
            {"APP_URL": f"http://{ip}:3100", "MAIN_APP_URL": main_origins},
            removals=("LOCAL_EXTRA_ORIGINS", "LOCAL_COOKIE_MODE"),
        )
        print(
            f"[OK] che do LAN — may TRAM mo http://{ip}:3000 (+3100)\n"
            f"     Cookie local chay khong Secure (http qua IP) — dung danh lai mat khau lan dau."
        )
    else:  # public
        log_dir = os.path.join(ROOT, "LOG")
        os.makedirs(log_dir, exist_ok=True)
        if args.start_tunnel:
            url_main = start_quick_tunnel(3000, os.path.join(log_dir, "tunnel-local-main.log"))
            url_con = start_quick_tunnel(3100, os.path.join(log_dir, "tunnel-local-con.log"))
        else:
            url_main, url_con = args.url_main.rstrip("/"), args.url_con.rstrip("/")
            if not url_main or not url_con:
                sys.exit("[LOI] can --url-main + --url-con hoac --start-tunnel")
        apply_env(
            ENV_MAIN,
            {
                "APP_CON_URL": url_con,
                "VITE_APP_CON_URL": url_con,
                "MAIN_APP_URL": url_main,
                "LOCAL_EXTRA_ORIGINS": url_main,
                "BETTER_AUTH_URL": url_main,
            },
            removals=("LOCAL_COOKIE_MODE",),
        )
        apply_env(
            ENV_CON,
            {"APP_URL": url_con, "MAIN_APP_URL": url_main},
            removals=("LOCAL_EXTRA_ORIGINS", "LOCAL_COOKIE_MODE"),
        )
        print(
            "[OK] che do PUBLIC (Quick Tunnel HTTPS — mo duoc TU MOI MAY, can internet):\n"
            f"     App tong : {url_main}\n"
            f"     App con  : {url_con}\n"
            "     LUU Y: URL doi MOI LAN chay lai start-local.bat public (Quick Tunnel)."
        )

    print("     Da backup .env.local -> .env.local.bak-312 (cua moi lan chay gan nhat).")
    print("     BUOC TIEP: DONG 2 cua so app (neu dang mo) + chay lai start-local.bat.")


if __name__ == "__main__":
    main()
