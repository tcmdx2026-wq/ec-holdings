# -*- coding: utf-8 -*-
"""GĐ 500 — đính chính 2 entry sau khi chuỗi Task_02 chạy lại xnkt: TIÊN DU vẫn thiếu
(18/19) qua 4 lần chạy 4 phiên browser — nghi lỗi phía SMED/TT đó, không phải timing."""
import subprocess

APPTONG = [
    ("Đẫ placeholder", ""),
]

OLD_APP = ("**xnkt 21/10 = 18 file + ETL 1.118 dòng ✅** (TIÊN DU bị bỏ im lặng — đã fix retry, chuỗi Task_02 23:00 chạy lại full)")
NEW_APP = ("**xnkt 21/10 = 18 file + ETL 1.118 dòng ✅** (TIÊN DU bị bỏ im lặng — đã fix retry; chuỗi Task_02 chạy lại full 00:14:37 VẪN 18/19: nút THỐNG KÊ chưa hiện BỀN BỈ với riêng TT TIÊN DU qua 4 lần chạy 4 phiên browser, TT khác ăn ngay lần 1 → nghi lỗi phía SMED/TT đó, cần soi tay web SMED)")

OLD_APP_TC = ("> **Tiêu chí kiểm chứng:** (1) báo cáo XNKT/BKX 21/10 đủ 19 TT (sau khi chuỗi chạy lại xnkt);")
NEW_APP_TC = ("> **Tiêu chí kiểm chứng:** (1) báo cáo XNKT/BKX 21/10 đủ 18/19 TT (TT TIÊN DU chờ soi tay SMED);")

OLD_REPO = ("**xnkt 21/10 = 18 file + ETL 1.118 dòng ✅** (TIÊN DU bị bỏ im lặng — đã fix retry, chuỗi Task_02 23:00 chạy lại full)")
NEW_REPO = ("**xnkt 21/10 = 18 file + ETL 1.118 dòng ✅** (TIÊN DU bị bỏ im lặng — đã fix retry; chuỗi Task_02 chạy lại full 00:14:37 VẪN 18/19: nút THỐNG KÊ chưa hiện BỀN BỈ với riêng TT TIÊN DU qua 4 lần chạy 4 phiên browser, TT khác ăn ngay lần 1 → nghi lỗi phía SMED/TT đó, cần soi tay web SMED)")

OLD_REPO_TC = ("> **Tiêu chí kiểm chứng:** (1) báo cáo XNKT/BKX 21/10 đủ 19 TT (sau khi chuỗi chạy lại xnkt);")
NEW_REPO_TC = ("> **Tiêu chí kiểm chứng:** (1) báo cáo XNKT/BKX 21/10 đủ 18/19 TT (TT TIÊN DU chờ soi tay SMED);")


def gate(reps, msg, cwd, file_="AGENTS.md"):
    cmd = ["python", r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/scripts/agents/shared-doc.py", "commit", "-m", msg]
    for old, new in reps:
        cmd += ["--replace-old", old, "--replace-new", new]
    cmd += ["--file", file_]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=cwd)
    print((p.stdout or p.stderr)[-700:])
    print("exit:", p.returncode, "=" * 60)


REPO = r"D:/DuLieuChung/CUONG_2026/giong-vn-v6/giong-apps"
# repo con — entry trong giong-apps/AGENTS.md
gate([(OLD_REPO, NEW_REPO)], "fix(docs): C.320 (Trợ lý Freebuff) — đính chính verify xnkt: chuỗi chạy lại vẫn 18/19, TIÊN DU lỗi bền bỉ 4 lần (nghi phía SMED) — không phải timing", REPO)
gate([(OLD_REPO_TC, NEW_REPO_TC)], "fix(docs): C.320 (Trợ lý Freebuff) — đính chính tiêu chí kiểm chứng xnkt 18/19 TT", REPO)

