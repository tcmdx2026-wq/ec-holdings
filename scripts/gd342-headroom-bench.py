"""GD 342 — Benchmark Headroom compress() trên dữ liệu thật của giong-vn-v6.

Chạy bằng python của tool env headroom-ai:
    uv run --from "headroom-ai[all]" python scripts/gd342-headroom-bench.py

Mục đích: đo % token tiết kiệm nếu tool output / file được nén trước khi vào
context của agent (bài toán tràn context GD 319). Chạy local, không gửi đâu.
"""

import json
import sys
from pathlib import Path

from headroom import compress

ROOT = Path(r"D:\DuLieuChung\CUONG_2026\giong-vn-v6")
MODEL = "gpt-4o"  # tokenizer chuẩn của Headroom cho cả 3 mẫu (so sánh công bằng)

# Mẫu 3: log dev thật (gộp các file LOG/*.log + dev-main*.log gốc)
def load_logs() -> str:
    chunks = []
    for pat in ("LOG/*.log", "dev-main*.log"):
        for f in sorted(ROOT.glob(pat)):
            if f.is_file():
                try:
                    chunks.append(f.read_text("utf-8", errors="replace"))
                except OSError:
                    pass
    return "\n".join(chunks)


# Mẫu 4: MÔ PHỎNG cấu trúc sheet tk-goi bccn (36 trang x 1000 dòng) —
# JSON lặp cao đại diện cho tool output bảng lớn mà agent từng phải đọc.
def synth_bccn(n=35_864) -> list[dict]:
    rows = []
    tts = ["VP", "BH", "TD", "GL", "PN", "BĐ", "QT", "NH"]
    for i in range(1, n + 1):
        tt = tts[i % len(tts)]
        rows.append({
            "STT": i, "Trung tâm": tt,
            "Mã khách": f"10{6000000 + i}",
            "Số gói còn nợ": (i * 7) % 40 + 1,
            "Số mũi trong gói còn nợ": (i * 3) % 120 + 1,
            "Số mũi đặt trước còn nợ": (i * 5) % 60 + 1,
            "Tổng số mũi còn nợ": (i * 8) % 180 + 2,
            "Tổng tiền": (i * 1_045_000) % 90_000_000,
        })
    return rows


def bench(label: str, text: str, json_rows=None):
    # Headroom 0.40 CHI nén tool output (thư user được bảo vệ) — mô phỏng đúng
    # dạng hội thoại khi agent đọc kết quả tool lớn (read_files / query bảng).
    content = json.dumps(json_rows, ensure_ascii=False) if json_rows is not None else text
    messages = [
        {"role": "user", "content": "Đọc dữ liệu này và tổng hợp giúp tôi"},
        {"role": "assistant", "content": None, "tool_calls": [
            {"id": "call_1", "type": "function",
             "function": {"name": "load_data", "arguments": "{}"}}]},
        {"role": "tool", "tool_call_id": "call_1", "content": content},
    ]
    result = compress(messages, model=MODEL)
    before = result.tokens_before
    after = result.tokens_after
    saved = result.tokens_saved
    ratio = result.compression_ratio
    transforms = ",".join(t for t in result.transforms_applied if "protected" not in t) or "(không nén)"
    print(f"{label:<46} {before:>9} -> {after:>9} token | tiết kiệm {ratio:>4.0%} | {transforms}")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(f"Headroom benchmark — model tokenizer: {MODEL}")
    print("=" * 100)

    # 1. AGENTS_ARCHIVE.md — 'bộ nhớ' 894KB gây tràn context GD 319
    p = ROOT / "AGENTS_ARCHIVE.md"
    bench(f"{p.name} ({p.stat().st_size/1024:.0f} KB — prose)", p.read_text("utf-8", errors="replace")[:400_000])

    # 2. JSON backup thật của app (558KB — dạng tool output data)
    p2 = ROOT / "attachments" / "giong-vn-backup-2026-09-14-0252.json"
    bench(f"{p2.name} ({p2.stat().st_size/1024:.0f} KB — JSON)", p2.read_text("utf-8", errors="replace")[:400_000])

    # 3. Log dev thật
    logs = load_logs()
    bench(f"LOG dev gộp ({len(logs)/1024:.0f} KB — log)", logs)

    # 4. Mô phỏng sheet tk-goi 35.864 dòng (tool output lặp cao)
    bench(f"Mô phỏng tk-goi 35.864 dòng (JSON)", None, json_rows=synth_bccn())
    return 0


if __name__ == "__main__":
    sys.exit(main())
