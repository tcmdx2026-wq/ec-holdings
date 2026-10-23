#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""install-hooks.py — GĐ 495: cài CỔNG COMMIT FILE DÙNG CHUNG cho repo hiện tại.

Hook đặt ở `$(git rev-parse --git-common-dir)/hooks/pre-commit` → **mọi worktree**
của cùng repo DÙNG CHUNG hook này (worktrees chia sẻ thư mục hooks), nên cài 1 lần
là mọi phiên/agent trên máy đều được bảo vệ. Cài lại sau khi `git clone` mới.

Chạy: python scripts/agents/install-hooks.py            (repo hiện tại)
      python scripts/agents/install-hooks.py --check    (chỉ kiểm tra đã cài chưa)
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

MARK = "GIONG VN — CỔNG COMMIT FILE DÙNG CHUNG"


def common_dir() -> Path:
    out = subprocess.run(["git", "rev-parse", "--git-common-dir"], capture_output=True,
                         text=True, encoding="utf-8").stdout.strip()
    p = Path(out) if out else Path(".git")
    return p if p.is_absolute() else (Path.cwd() / p).resolve()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()

    src = Path(__file__).with_name("pre-commit")
    dst = common_dir() / "hooks" / "pre-commit"
    if a.check:
        ok = dst.exists() and MARK in dst.read_text(encoding="utf-8", errors="replace")
        print(f"{'✅ đã cài' if ok else '❌ CHƯA cài'}: {dst}")
        return 0 if ok else 1

    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and MARK not in dst.read_text(encoding="utf-8", errors="replace"):
        bak = dst.with_suffix(".pre495.bak")
        shutil.copy2(dst, bak)
        print(f"ℹ️ hook cũ đã backup: {bak.name}")
    shutil.copyfile(src, dst)
    try:
        dst.chmod(0o755)
    except Exception:
        pass
    print(f"✅ ĐÃ CÀI cổng file dùng chung: {dst}")
    print("   → Mọi worktree của repo này dùng chung hook (bài dở các phiên được bảo vệ).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
