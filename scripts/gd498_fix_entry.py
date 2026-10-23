# GĐ 498 — sửa đoạn entry bị đứt do lỗi quote shell (gọi cổng shared-doc qua subprocess args-list)
import re
import subprocess
import sys

PY = sys.executable
GATE = "scripts/agents/shared-doc.py"

def head_text(path: str) -> str:
    p = subprocess.run(["git", "show", f"HEAD:{path}"], capture_output=True)
    return p.stdout.decode("utf-8", "replace")

head = head_text("AGENTS.md")
i = head.find("> ⚠️ **2 phát hiện vận hành")
assert i != -1, "không thấy khối '2 phát hiện'"
# đoạn hỏng kết thúc ở cuối câu Ctrl+Shift+R (đoạn (2) của lần đính chính 1)
j = head.find("Ctrl+Shift+R 1 lần là sạch.", i)
assert j != -1, "không thấy mốc kết thúc Ctrl+Shift+R"
old = head[i : j + len("Ctrl+Shift+R 1 lần là sạch.")]

new = (
    "> ⚠️ **2 phát hiện vận hành — ĐÍNH CHÍNH LẦN 2 (23:15 probe lại):** (1) webhook\n"
    "> GitHub→Vercel **SỐNG — chỉ TRỄ 3-17 phút** (queue 1 concurrent build/team — Hobby):\n"
    "> bằng chứng 4/4 commit push đều có deployment git READY — 59acace → 22:50:36 (trễ\n"
    "> 17 phút do 2 lần deploy thủ công của em 22:43-22:44 chiếm chỗ) · ec447a2 → 22:53:40\n"
    "> (trễ 15 phút) · 8d63ca7 → 23:12:19 (trễ 3 phút). KHÔNG cần ĐH vào dashboard; probe\n"
    "> lúc 22:43 thấy 'không có deployment' là QUÁ SỚM. Quy trình lần sau: push → chờ\n"
    "> 5-15 phút → kiểm `python scripts/gd498_probe_deploy.py` (in 5 deployment gần nhất\n"
    "> state/sha) · cần gấp → `npx vercel --prod` từ ROOT repo (Root Directory apps/banhang\n"
    "> — chạy từ apps/banhang sẽ lỗi Root Directory) + .vercelignore TẠM chặn agent/\n"
    "> (Chrome CDP khóa cookie → EBUSY), xong xóa ignore tạm; trigger qua API gitSource\n"
    "> cũng được (repoId: app tổng 1347487202 · repo con 1368782303); (2) browser đã load\n"
    "> app con trong khung giờ lệch (khi domain ghim deployment cũ) dính **cache 404 âm**\n"
    "> của asset → tab đó \"Chưa đăng nhập\" mãi dù cookie OK (fetch no-store = 200 cùng\n"
    "> URL) — Ctrl+Shift+R 1 lần là sạch."
)

r = subprocess.run(
    [PY, GATE, "commit", "--replace-old", old, "--replace-new", new,
     "--file", "AGENTS.md",
     "-m", "docs: GĐ 498 sửa văn bản đứt do lỗi quote shell (thay khối '2 phát hiện' bằng bản đầy đủ)"],
    capture_output=True, text=True, encoding="utf-8", errors="replace",
)
print(r.stdout[-600:])
print(r.stderr[-300:] if r.returncode != 0 else "")
sys.exit(r.returncode)
