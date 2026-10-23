#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""shared-doc.py — GĐ 495: CỔNG AN TOÀN cho FILE DÙNG CHUNG (AGENTS.md,
AGENT_REGISTRY.md, AGENTS_ARCHIVE.md) khi có NHIỀU PHIÊN AI làm song song.

VẤN ĐỀ (2 tai nạn thật: GĐ 470 và GĐ 494 ngày 21/10/2026):
  1. Phiên A `git add AGENTS.md` khi file đang chứa BÀI DỞ của phiên B → commit của A
     NUỐT bài của B (nội dung không mất nhưng gán nhầm commit, B hoang mang).
  2. Bản trong máy của phiên B LỆCH (thiếu entry phiên A đã commit) → B commit nguyên
     file → XOÁ bài của A.

CÁCH CHỐNG: mọi commit vào file dùng chung đi qua script này. Script KHÔNG lấy nguyên
file worktree — nó ghép **chỉ những entry/dòng registry mình khai** lên trên bản HEAD
(bản đã có đủ bài mọi phiên), rồi TRẢ LẠI nguyên vẹn bài dở của phiên khác trong máy.
Kèm hook pre-commit (cài bằng install-hooks.py) chặn commit trực tiếp + chặn mọi hành
vi XOÁ entry/registry + snapshot tự động.

DÙNG:
  python scripts/agents/shared-doc.py check                     # tình trạng 2 đầu (HEAD ↔ máy)
  python scripts/agents/shared-doc.py list                      # entry mới chưa commit
  python scripts/agents/shared-doc.py commit --entry "GĐ 495" --registry "GĐ 495" -m "..."
  python scripts/agents/shared-doc.py commit --all-new -m "..."  # chỉ entry mới của mình
  python scripts/agents/shared-doc.py commit --block "TEN-KHOI" --after "<dòng neo>" -m "..."
  python scripts/agents/shared-doc.py restore --file AGENTS.md
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SHARED_FILES = ["AGENTS.md", "AGENT_REGISTRY.md", "AGENTS_ARCHIVE.md"]
CR = "\r"
CRLF = "\r\n"
LF = "\n"
ENTRY_HEAD = re.compile(r"^###\s+((?:GĐ|C\.)\s*\d+)", re.IGNORECASE)
ROW_HEAD = re.compile(r"^\|\s*((?:GĐ|C\.)\s*\d+)", re.IGNORECASE)
BLOCK_RE = re.compile(r"<!--\s*SHARED-BLOCK:(.+?)\s+START\s*-->(.*?)"
                      r"<!--\s*SHARED-BLOCK:\1\s+END\s*-->", re.S)


# ---------------------------------------------------------------- tiện ích git
def git(*args, check=True):
    p = subprocess.run(["git", *args], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if check and p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} error: {(p.stderr or p.stdout)[:300]}")
    return (p.stdout or "").strip()


def head_text(path: str) -> str:
    """Bản HEAD dạng CHUỖI GIỮ NGUYÊN kiểu xuống dòng — đọc BYTES rồi tự decode
    (KHÔNG dùng text=True vì Python đổi CRLF thành LF → mất CRLF → diff toàn file)."""
    p = subprocess.run(["git", "show", f"HEAD:{path}"], capture_output=True)
    return p.stdout.decode("utf-8", "replace") if p.returncode == 0 else ""


def read(path: str) -> str:
    try:
        return open(path, encoding="utf-8", newline="").read()
    except FileNotFoundError:
        return ""


def to_lf(t: str) -> str:
    return t.replace(CRLF, LF).replace(CR, LF)


def uses_crlf(t: str) -> bool:
    """Bản này dùng CRLF? (repo lưu AGENTS.md dạng CRLF, registry dạng LF — phải giữ
    nguyên kiểu của TỪNG FILE, nếu không git báo diff TOÀN FILE — bài học GĐ 491/495)."""
    return CRLF in t


def write_like(path: str, text_raw: str, like: str):
    """Ghi nguyên văn `text_raw` — KHÔNG đổi kiểu xuống dòng của các dòng cũ.
    (Repo có file TRỘN CRLF+LF: đổi hết sang một kiểu làm git báo diff hàng trăm dòng
    tưởng như bị sửa — bài học GĐ 491/495. Phần MỚI nối vào dùng eol_of().)"""
    open(path, "w", encoding="utf-8", newline="").write(text_raw)


def eol_of(text: str) -> str:
    """Kiểu xuống dòng dùng cho phần MỚI nối vào — theo dòng cuối của bản gốc."""
    if text.endswith(CRLF):
        return CRLF
    if text.endswith(CR):
        return CR
    if text.endswith(LF):
        # file trộn: chọn kiểu xuất hiện nhiều hơn
        return CRLF if text.count(CRLF) >= (text.count(LF) - text.count(CRLF)) else LF
    return LF


# ------------------------------------------------------------------ phân tích
def entries(text: str) -> dict:
    """{key: block} — key = 'GĐ 495' / 'C.316'; entry = từ '### <key>' tới trước '### ' kế."""
    out, cur_key, cur = {}, None, []
    for line in to_lf(text).splitlines():
        m = ENTRY_HEAD.match(line)
        if line.startswith("### "):
            if cur_key:
                out[cur_key] = LF.join(cur).rstrip(LF)
            cur_key, cur = (m.group(1).strip() if m else None), [line]
        elif cur_key is not None:
            cur.append(line)
    if cur_key:
        out[cur_key] = LF.join(cur).rstrip(LF)
    return out


def rows(text: str) -> dict:
    """{key: row_text} — dòng bảng registry bắt đầu bằng '| GĐ …' / '| C.…'."""
    out = {}
    for line in to_lf(text).splitlines():
        m = ROW_HEAD.match(line)
        if m and line.rstrip().endswith("|"):
            out.setdefault(m.group(1).strip(), line)
    return out


def block_of(text: str, name: str) -> str:
    for m in BLOCK_RE.finditer(to_lf(text)):
        if m.group(1).strip() == name:
            return m.group(0).strip()
    return ""


def apply_block(base: str, wt: str, name: str, after: str):
    """Chèn/thay KHỐI QUY TẮC <!-- SHARED-BLOCK:name START/END -->.
    Có sẵn trong base -> thay tại chỗ; chưa có -> chèn ngay SAU dòng chứa `after`.
    Giữ NGUYÊN BYTE mọi dòng cũ (chỉ cắt/ghép tại đúng vị trí chèn)."""
    blk = block_of(wt, name)
    if not blk:
        return base, False
    nl = eol_of(base)
    blk_raw = to_lf(blk).replace(LF, nl)
    if block_of(base, name):
        # ĐÃ có khối trong bản gốc -> THAY tại chỗ, PHẢI qua replace_in_raw: bản gốc
        # TRỘN CRLF+LF nên so chuỗi thẳng không khớp -> im lặng không sửa (lỗi thật
        # gặp 21/10: cập nhật khối quy tắc mà git báo 'nothing to commit').
        return replace_in_raw(base, block_of(base, name), to_lf(blk))
    idx = base.find(after) if after else -1
    if idx < 0:
        return base, False
    eol = base.find(nl, idx)
    if eol < 0:
        return base, False
    at = eol + len(nl)
    return base[:at] + nl + blk_raw + nl + base[at:], True


def lf_index_map(raw: str):
    """Bảng ánh xạ vị trí ký tự bản LF-normalized -> vị trí trong bản RAW.
    (file repo TRỘN CRLF+LF nên không thể replace thẳng trên bản raw)."""
    idxs, i, n = [], 0, len(raw)
    while i < n:
        idxs.append(i)
        if raw[i] == "\r" and i + 1 < n and raw[i + 1] == "\n":
            i += 2
        else:
            i += 1
    idxs.append(n)
    return idxs


def replace_in_raw(raw: str, old_lf: str, new_lf: str):
    """Thay đúng MỘT đoạn văn bản (cho theo dạng LF) trong bản RAW, GIỮ NGUYÊN BYTE
    của mọi phần khác. Trả (text_mới, ok)."""
    old_n = to_lf(old_lf)
    lf = to_lf(raw)
    pos = lf.find(old_n)
    if pos < 0:
        return raw, False
    mp = lf_index_map(raw)
    a, b = mp[pos], mp[pos + len(old_n)]
    nl = eol_of(raw)
    return raw[:a] + to_lf(new_lf).replace(LF, nl) + raw[b:], True


def find_key(store: dict, want: str):
    w = re.sub(r"\s+", " ", want.strip()).upper()
    for k in store:
        kk = re.sub(r"\s+", " ", k.strip()).upper()
        if kk == w or kk.startswith(w) or w.startswith(kk):
            return k
    return None


# ---------------------------------------------------------------------- lệnh
def cmd_check(_a):
    print("=" * 76)
    print(f"CỔNG FILE DÙNG CHUNG — {Path.cwd()}")
    dirty = git("status", "--porcelain")
    for f in SHARED_FILES:
        h, w = head_text(f), read(f)
        if not h and not w:
            continue
        he, we = entries(h), entries(w)
        only_head = [k for k in he if k not in we]
        only_wt = [k for k in we if k not in he]
        print(f"\n• {f}")
        print(f"   entry: HEAD {len(he)} · máy {len(we)} · CHƯA commit {len(only_wt)} {only_wt[:6]}")
        if only_head:
            print(f"   ⚠️ có ở HEAD mà THIẾU trong máy ({len(only_head)}): {only_head[:6]}"
                  " -> commit nguyên file sẽ XOÁ (hook sẽ chặn)")
        if f == "AGENT_REGISTRY.md":
            hr, wr = rows(h), rows(w)
            miss = [k for k in hr if k not in wr]
            if miss:
                print(f"   ⚠️ dòng registry có ở HEAD mà thiếu trong máy: {miss[:6]}")
        if f in dirty:
            print("   (đang có thay đổi chưa commit trong máy)")
    print('\n-> Commit an toàn: python scripts/agents/shared-doc.py commit --entry "GĐ xxx" -m "..."')
    return 0


def cmd_list(_a):
    for f in SHARED_FILES:
        h, w = head_text(f), read(f)
        if not w:
            continue
        new = [k for k in entries(w) if k not in entries(h)]
        newr = [k for k in rows(w) if k not in rows(h)] if "REGISTRY" in f else []
        if new or newr:
            print(f"{f}: entry CHƯA commit = {new} · dòng registry mới = {newr}")
    return 0


def snapshot(path: str) -> str:
    """Lưu bản trong máy (có bài dở của MỌI phiên) để khôi phục — không bao giờ mất bài."""
    common = Path(git("rev-parse", "--git-common-dir"))
    if not common.is_absolute():
        common = Path.cwd() / common
    d = common / "giong-shared-wip"
    d.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe = path.replace("/", "_")
    dst = d / f"{safe}.{ts}.bak"
    shutil.copy2(path, dst)
    for old in sorted(d.glob(f"{safe}.*.bak"))[:-50]:
        old.unlink(missing_ok=True)
    return str(dst)


def restore_from_backup(common: Path, path: str):
    safe = path.replace("/", "_")
    snaps = sorted((common / "giong-shared-wip").glob(f"{safe}.*.bak"))
    if snaps:
        shutil.copy2(snaps[-1], path)
        return snaps[-1].name
    return ""


def cmd_commit(a):
    keys = [k.strip() for k in (a.entry or [])]
    reg_keys = [k.strip() for k in (a.registry or [])] or keys
    rep_old = getattr(a, "replace_old", None)
    rep_new = getattr(a, "replace_new", None)
    rep_file = getattr(a, "file", None) or "AGENTS.md"
    if not keys and not a.all_new and not a.block and not rep_old:
        print('❌ Thiếu --entry "GĐ xxx" (hoặc --all-new / --block / --replace-old) — xem docstring.')
        return 2

    common = Path(git("rev-parse", "--git-common-dir"))
    if not common.is_absolute():
        common = Path.cwd() / common

    changed, backups = [], {}
    for f in SHARED_FILES:
        w = read(f)
        if not w:
            continue
        h = head_text(f)
        we, he = entries(w), entries(h)
        add_blocks, add_rows, merged_blk = [], [], None

        if f == "AGENT_REGISTRY.md":
            wr, hr = rows(w), rows(h)
            for k in reg_keys:
                kk = find_key(wr, k) or k
                if kk in wr and kk not in hr:
                    add_rows.append(wr[kk])
        else:
            want = ([k for k in we if k not in he] if a.all_new
                    else [find_key(we, k) or k for k in keys])
            for k in want:
                if k in we and k not in he:
                    add_blocks.append(we[k])
            if a.block:
                merged_blk, ok = apply_block(h, w, a.block, a.after or "")
                if not ok:
                    print(f"   ⚠️ {f}: không thấy khối '{a.block}' trong máy hoặc thiếu điểm neo — bỏ qua khối")
                    merged_blk = None

        if rep_old and f == rep_file:          # áp cho MỌI file (kể cả AGENT_REGISTRY.md)
            src = merged_blk if merged_blk is not None else h
            fixed, ok = replace_in_raw(src, rep_old, rep_new or "")
            if ok:
                merged_blk = fixed
                print(f"   ✏️ {f}: đã thay 1 đoạn văn bản (giữ nguyên byte phần còn lại)")
            else:
                print(f"   ⚠️ {f}: KHÔNG tìm thấy đoạn cần thay — bỏ qua (không sửa gì)")

        if not add_blocks and not add_rows and merged_blk is None:
            continue

        backups[f] = snapshot(f)                     # bảo hiểm bài dở phiên khác
        merged = merged_blk if merged_blk is not None else h
        nl = eol_of(merged)
        for b in add_blocks:
            merged = merged.rstrip(LF + CR) + nl + nl + to_lf(b).replace(LF, nl) + nl
        for r in add_rows:
            merged = merged.rstrip(LF + CR) + nl + to_lf(r).replace(LF, nl) + nl
        write_like(f, merged, h if h else w)         # KHÔNG đổi kiểu xuống dòng dòng cũ
        print(f"   🔀 {f}: ghép {len(add_blocks)} entry + {len(add_rows)} dòng registry"
              f"{' + 1 khối quy tắc' if merged_blk is not None else ''} lên bản HEAD"
              f" (backup bài dở phiên khác: {Path(backups[f]).name})")
        changed.append(f)

    if not changed:
        print("ℹ️ Không có gì để ghép (entry/registry đã nằm trong HEAD?).")
        return 0

    msg = a.msg or f"docs: {', '.join(keys) or 'entry mới'}"
    git("add", *changed)
    env = {**os.environ, "GIONG_SHARED_OK": "1"}
    p = subprocess.run(["git", "commit", "-m", msg, "--", *changed],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
    out = (p.stdout or "").strip() or (p.stderr or "").strip()
    print(out[:800])
    if p.returncode != 0:
        for f in backups:                            # commit fail -> trả lại bản cũ ngay
            nm = restore_from_backup(common, f)
            print(f"   ↩️ khôi phục {f} từ {nm}")
        return p.returncode

    for f in changed:                                # TRẢ LẠI bài dở phiên khác trong máy
        nm = restore_from_backup(common, f)
        print(f"   ↩️ trả lại {f} = bản bài dở của phiên khác (giữ nguyên): {nm}")
    print("\n✅ ĐÃ COMMIT qua cổng an toàn. Push khi Đại Ca cho lệnh.")
    return 0


def cmd_restore(a):
    common = Path(git("rev-parse", "--git-common-dir"))
    if not common.is_absolute():
        common = Path.cwd() / common
    d = common / "giong-shared-wip"
    snaps = sorted(d.glob("*.bak")) if d.exists() else []
    if not snaps:
        print("ℹ️ Không có bản backup nào.")
        return 0
    print("Bản backup gần nhất (.git/giong-shared-wip):")
    for s in snaps[-10:]:
        print(f"   {s.name}  ({s.stat().st_size} bytes)")
    if getattr(a, "file", None):
        nm = restore_from_backup(common, a.file)
        print(f"✅ đã khôi phục {a.file} từ {nm}" if nm else f"❌ không có backup cho {a.file}")
    else:
        print("\nKhôi phục: python scripts/agents/shared-doc.py restore --file AGENTS.md")
    return 0


def main():
    ap = argparse.ArgumentParser(description="Cổng an toàn cho file dùng chung (GĐ 495)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check").set_defaults(fn=cmd_check)
    sub.add_parser("list").set_defaults(fn=cmd_list)
    pr = sub.add_parser("restore")
    pr.add_argument("--file", help="file cần khôi phục từ backup gần nhất")
    pr.set_defaults(fn=cmd_restore)
    pc = sub.add_parser("commit")
    pc.add_argument("--entry", action="append", help='số entry cần commit (VD "GĐ 495") - lặp lại được')
    pc.add_argument("--registry", action="append", help="số dòng registry cần ghép (mặc định = --entry)")
    pc.add_argument("--all-new", action="store_true", help="ghép MỌI entry mới của file")
    pc.add_argument("--block", help="tên KHỐI QUY TẮC cần chèn/thay (dấu SHARED-BLOCK)")
    pc.add_argument("--replace-old", help="đoạn văn bản (nhiều dòng OK) cần sửa trong bản HEAD")
    pc.add_argument("--replace-new", help="nội dung thay thế")
    pc.add_argument("--file", help="file áp --replace (mặc định AGENTS.md)")
    pc.add_argument("--after", help="điểm neo: chèn khối ngay SAU dòng chứa chuỗi này")
    pc.add_argument("-m", "--msg", help="commit message")
    pc.set_defaults(fn=cmd_commit)
    a = ap.parse_args()
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
