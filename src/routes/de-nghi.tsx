import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  CheckCircle2,
  ClipboardX,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  Undo2,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, todayIso } from "@/lib/format";

import { canApproveProposals } from "@/lib/permissions";
import { useAppStore } from "@/lib/store";
import type { Proposal } from "@/lib/types";

export const Route = createFileRoute("/de-nghi")({ component: DeNghiPage });

const KINDS: Proposal["kind"][] = ["Nhân sự", "Thu chi", "Nhập xuất", "Góp ý"];
const STATUSES: Proposal["status"][] = ["Chờ duyệt", "Đã duyệt", "Từ chối"];
/** Giới hạn 5 tệp/phiếu — dung lượng tối đa ~2MB/tệp sau nén */
const MAX_FILES = 5;
const MAX_FILE_MB = 2;

/** Nén ảnh client-side về ≤800KB (pattern Chấm công GĐ 25) */
async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  // File văn phòng (PDF/Word/Excel) — không nén, kiểm tra dung lượng
  if (!file.type.startsWith("image/")) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      throw new Error(`File "${file.name}" quá lớn (tối đa ${MAX_FILE_MB}MB)`);
    }
    return dataUrl;
  }
  // Ảnh — resize + nén quality
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let quality = 0.8;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > 800 * 1024 * 1.37 && quality > 0.3) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  return out;
}

/** Kiểm tra URL có phải ảnh không (ảnh Cloudinary /res.cloudinary.com/.../image/upload/) */
function isImageUrl(url: string): boolean {
  return /\/image\/upload\//.test(url) || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);
}

/** Tên file từ URL Cloudinary */
function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    return decodeURIComponent(parts[parts.length - 1]) || "Tệp đính kèm";
  } catch {
    return "Tệp đính kèm";
  }
}

/** Một hàng giá trị trong dialog chi tiết */
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs font-medium text-muted">{label}</span>
      <span className="min-w-0 text-right text-sm break-words text-ink">{value || "—"}</span>
    </div>
  );
}

function DeNghiPage() {
  const proposals = useAppStore((s) => s.proposals);
  const employees = useAppStore((s) => s.employees);
  const centers = useAppStore((s) => s.centers);
  const addProposal = useAppStore((s) => s.addProposal);
  const updateProposal = useAppStore((s) => s.updateProposal);
  const removeProposal = useAppStore((s) => s.removeProposal);
  const setProposalStatus = useAppStore((s) => s.setProposalStatus);

  // Reactive current user — pattern GĐ 16 (non-reactive getEmployeeById bug)
  const currentEmployee = useAppStore(
    (s) => s.employees.find((e) => e.id === s.currentUserId) ?? null,
  );
  const isAdmin = canApproveProposals(currentEmployee) || currentEmployee?.role === "Admin" || currentEmployee?.role === "SuperAdmin";
  const meName = currentEmployee?.name ?? useAppStore.getState().currentName();
  const meId = currentEmployee?.id ?? "";

  // ===== Dialog states =====
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<Proposal | null>(null);
  const [deleteRow, setDeleteRow] = useState<Proposal | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // ===== Form states =====
  const [kind, setKind] = useState<Proposal["kind"]>("Nhân sự");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [dept, setDept] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // ===== Filter states =====
  const [q, setQ] = useState("");
  const [fRequester, setFRequester] = useState("all");
  const [fApprover, setFApprover] = useState("all");
  const [fKind, setFKind] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [statCard, setStatCard] = useState<"all" | Proposal["status"]>("all");
  const [mine, setMine] = useState(false);

  // ===== Sticky header ref — đo chiều cao khối lọc (pattern GĐ 58/63) =====
  const stickyFiltersRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const set = () => {
      const h = `${el.offsetHeight}px`;
      el.style.setProperty("--dn-sticky-h", h);
      el.parentElement?.style.setProperty("--dn-sticky-h", h);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
  }, []);

  // ===== Danh sách người đề nghị / người duyệt (từ data thật) =====
  const requesters = useMemo(
    () => [...new Set(proposals.map((p) => p.requester).filter(Boolean))].sort(),
    [proposals],
  );
  const approvers = useMemo(
    () => [...new Set(proposals.map((p) => p.approver ?? "").filter(Boolean))].sort(),
    [proposals],
  );

  // ===== Stats =====
  const stats = useMemo(
    () => ({
      total: proposals.length,
      pending: proposals.filter((p) => p.status === "Chờ duyệt").length,
      approved: proposals.filter((p) => p.status === "Đã duyệt").length,
      rejected: proposals.filter((p) => p.status === "Từ chối").length,
    }),
    [proposals],
  );

  // ===== Filter + sort rows =====
  const rows = useMemo(() => {
    return proposals
      .filter((p) => {
        if (statCard !== "all" && p.status !== statCard) return false;
        if (fStatus !== "all" && p.status !== fStatus) return false;
        if (fKind !== "all" && p.kind !== fKind) return false;
        if (fRequester !== "all" && p.requester !== fRequester) return false;
        if (fApprover !== "all" && (p.approver ?? "") !== fApprover) return false;
        if (mine && (p.createdBy || p.requester) !== (meId || meName)) return false;
        if (q.trim()) {
          const s = q.toLowerCase();
          const hay = `${p.title} ${p.detail} ${p.kind} ${p.requester} ${p.approver ?? ""} ${p.dept}`.toLowerCase();
          if (!hay.includes(s)) return false;
        }
        if (fFrom && p.date < fFrom) return false;
        if (fTo && p.date > fTo) return false;
        return true;
      })
      .sort((a, b) => {
        // Chờ duyệt lên đầu, rồi theo ngày mới nhất
        const aP = a.status === "Chờ duyệt" ? 0 : 1;
        const bP = b.status === "Chờ duyệt" ? 0 : 1;
        if (aP !== bP) return aP - bP;
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });
  }, [proposals, statCard, fStatus, fKind, fRequester, fApprover, mine, meId, meName, q, fFrom, fTo]);

  // ===== Reset form khi đóng dialog =====
  const resetForm = useCallback(() => {
    setEditingId(null);
    setKind("Nhân sự");
    setTitle("");
    setDetail("");
    setDept("");
    setAttachments([]);
  }, []);

  const openCreate = () => {
    resetForm();
    setDept(currentEmployee?.center ?? "");
    setOpen(true);
  };

  const openEdit = (p: Proposal) => {
    resetForm();
    setEditingId(p.id);
    setKind(p.kind);
    setTitle(p.title);
    setDetail(p.detail);
    setDept(p.dept);
    setAttachments(p.attachments ?? []);
    setOpen(true);
  };

  // ===== Upload đính kèm =====
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_FILES - attachments.length;
    if (room <= 0) {
      toast.error(`Tối đa ${MAX_FILES} tệp mỗi phiếu`);
      return;
    }
    const list = Array.from(files).slice(0, room);
    setUploading(true);
    try {
      const { uploadImage } = await import("@/routes/api/upload");
      const uploaded: string[] = [];
      for (const f of list) {
        const base64 = await compressImage(f);
        const res = await uploadImage({
          data: { base64, folder: "giong-vn/proposals", fileName: f.name },
        });
        uploaded.push(res.url);
      }
      setAttachments((prev) => [...prev, ...uploaded]);
      toast.success(`Đã đính kèm ${uploaded.length} tệp`);
    } catch (err: any) {
      toast.error(err?.message ?? "Lỗi upload tệp");
    } finally {
      setUploading(false);
    }
  };

  // ===== Submit tạo/sửa =====
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (editingId) {
      updateProposal(editingId, {
        kind,
        title: title.trim(),
        detail: detail.trim(),
        dept: dept.trim(),
        attachments,
      });
      toast.success("Đã cập nhật đề nghị");
    } else {
      addProposal({
        kind,
        title: title.trim(),
        requester: meName,
        date: todayIso(),
        detail: detail.trim(),
        status: "Chờ duyệt",
        dept: dept.trim(),
        createdBy: meId,
        attachments,
      });
      toast.success("Đã gửi đề nghị");
    }
    setOpen(false);
    resetForm();
  }

  // ===== Quyền sửa/xóa: người tạo khi Chờ duyệt; Admin mọi lúc (xóa) / phiếu Chờ duyệt (sửa) =====
  const canModify = (p: Proposal) => {
    const isOwner = (p.createdBy || p.requester) === (meId || meName);
    if (p.status !== "Chờ duyệt") return isAdmin; // đã duyệt/từ chối: chỉ Admin
    return isOwner || isAdmin;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Nghiệp vụ"
        title="Đề nghị — Đề xuất"
        desc="Nhân sự, thu chi, nhập xuất, góp ý. Quản lý phê duyệt, từ chối hoặc hủy."
        actions={
          <Button onClick={openCreate}>
            <Plus />
            Tạo đề nghị
          </Button>
        }
      />

      {/* ===== 4 card tổng quan — bấm để lọc nhanh theo trạng thái ===== */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Tổng đề nghị", value: stats.total, status: "all" as const, color: "text-ink", icon: FileText },
          { label: "Chờ duyệt", value: stats.pending, status: "Chờ duyệt" as const, color: "text-warn", icon: ClipboardX },
          { label: "Đã duyệt", value: stats.approved, status: "Đã duyệt" as const, color: "text-ok", icon: CheckCircle2 },
          { label: "Từ chối", value: stats.rejected, status: "Từ chối" as const, color: "text-danger", icon: XCircle },
        ].map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setStatCard(statCard === c.status ? "all" : c.status)}
            className={`text-left ${statCard === c.status ? "ring-2 ring-accent" : ""}`}
          >
            <Card className="px-4 py-3 transition-shadow hover:shadow-[var(--shadow-card-hover)]">
              <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                <c.icon className="size-3.5" /> {c.label}
              </p>
              <p className={`mt-1 text-2xl font-semibold tabular ${c.color}`}>{c.value}</p>
            </Card>
          </button>
        ))}
      </div>

      {/* ===== Khối lọc — GHIM dưới header app khi cuộn (pattern Chấm công GĐ 55) ===== */}
      <div
        ref={stickyFiltersRef}
        className="sticky top-16 z-10 -mx-4 border-b border-line bg-bg px-4 pb-2 sm:-mx-6 sm:px-6"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tiêu đề, nội dung, người..."
              className="h-10 pl-10"
            />
          </div>
          <select
            value={fRequester}
            onChange={(e) => setFRequester(e.target.value)}
            className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
            title="Lọc người đề nghị"
          >
            <option value="all">Mọi người đề nghị</option>
            {requesters.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={fApprover}
            onChange={(e) => setFApprover(e.target.value)}
            className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
            title="Lọc người duyệt"
          >
            <option value="all">Mọi người duyệt</option>
            {approvers.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={fKind}
            onChange={(e) => setFKind(e.target.value)}
            className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
            title="Lọc loại đề nghị"
          >
            <option value="all">Mọi loại</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
            title="Lọc trạng thái"
          >
            <option value="all">Mọi trạng thái</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {/* Date range — gộp 1 dòng ngang (pattern GĐ 53) */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Calendar className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
              <Input
                type="date"
                value={fFrom}
                onChange={(e) => setFFrom(e.target.value)}
                className="h-10 w-[140px] pl-8"
                title="Từ ngày"
              />
            </div>
            <span className="text-xs text-faint">—</span>
            <Input
              type="date"
              value={fTo}
              onChange={(e) => setFTo(e.target.value)}
              className="h-10 w-[140px]"
              title="Đến ngày"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => setMine(e.target.checked)}
              className="size-4 accent-[var(--color-accent)]"
            />
            Của tôi
          </label>
        </div>
      </div>

      <p className="mb-3 mt-3 text-sm text-muted">
        Hiển thị <span className="font-medium text-ink">{rows.length}</span> / {proposals.length} đề nghị
        {statCard !== "all" ? ` · lọc: ${statCard}` : ""}
      </p>

      {/* ===== Bảng đề nghị — giống Chấm công ===== */}
      <Card className="overflow-hidden p-0 lg:overflow-visible">
        <div className="overflow-x-auto lg:overflow-x-visible">
          <table className="w-full text-sm">
            <thead className="sticky top-[calc(4rem+var(--dn-sticky-h,64px))] z-[5]">
              <tr className="border-b border-line bg-surface">
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">STT</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Người đề nghị</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Loại</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Tiêu đề</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Đơn vị</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Ngày tạo</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Người duyệt</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Trạng thái</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Đính kèm</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-muted">
                    Không có đề nghị nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                rows.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => setDetailRow(p)}
                    className="cursor-pointer border-b border-line transition-colors hover:bg-surface-2/40"
                  >
                    <td className="px-3 py-3 text-faint tabular">{idx + 1}</td>
                    <td className="px-3 py-3 font-medium whitespace-nowrap text-ink">{p.requester}</td>
                    <td className="px-3 py-3"><StatusBadge value={p.kind} /></td>
                    <td className="max-w-[280px] px-3 py-3">
                      <p className="truncate font-medium text-ink">{p.title}</p>
                      {p.detail ? <p className="truncate text-xs text-muted">{p.detail}</p> : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{p.dept || "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted tabular">{formatDate(p.date)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{p.approver || "—"}</td>
                    <td className="px-3 py-3"><StatusBadge value={p.status} /></td>
                    <td className="px-3 py-3 text-center">
                      {(p.attachments?.length ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                          <Paperclip className="size-3" /> {p.attachments!.length}
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {isAdmin && p.status === "Chờ duyệt" ? (
                          <>
                            <button
                              type="button"
                              title="Phê duyệt"
                              onClick={() => {
                                setProposalStatus(p.id, "Đã duyệt", meName);
                                toast.success("Đã phê duyệt");
                              }}
                              className="rounded-lg border border-line px-2 py-1 text-xs text-ok hover:bg-ok/10"
                            >
                              <CheckCircle2 className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Từ chối"
                              onClick={() => {
                                setProposalStatus(p.id, "Từ chối", meName);
                                toast.message("Đã từ chối");
                              }}
                              className="rounded-lg border border-line px-2 py-1 text-xs text-danger hover:bg-danger/10"
                            >
                              <XCircle className="size-3.5" />
                            </button>
                          </>
                        ) : null}
                        {/* Mở lại — Admin đưa phiếu đã xử lý về Chờ duyệt để duyệt lại (yêu cầu Đại ca 2026-09-10) */}
                        {isAdmin && p.status !== "Chờ duyệt" ? (
                          <button
                            type="button"
                            title="Mở lại — đưa về Chờ duyệt"
                            onClick={() => {
                              setProposalStatus(p.id, "Chờ duyệt");
                              toast.message("Đã mở lại — phiếu về Chờ duyệt");
                            }}
                            className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:bg-surface-2"
                          >
                            <Undo2 className="size-3.5" />
                          </button>
                        ) : null}
                        {canModify(p) ? (
                          <>
                            <button
                              type="button"
                              title="Sửa"
                              onClick={() => openEdit(p)}
                              className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:bg-surface-2"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Xóa"
                              onClick={() => setDeleteRow(p)}
                              className="rounded-lg border border-line px-2 py-1 text-xs text-danger hover:bg-danger/10"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        ) : null}
                        {!canModify(p) && !(isAdmin && p.status === "Chờ duyệt") ? (
                          <span className="text-xs text-faint">—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ===== Dialog tạo / sửa ===== */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogTitle>{editingId ? "Sửa đề nghị" : "Đề nghị mới"}</DialogTitle>
          <DialogDesc>
            {editingId ? "Cập nhật nội dung phiếu (khi còn chờ duyệt)." : "Gửi tới quản lý để phê duyệt."}
          </DialogDesc>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Loại</Label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Proposal["kind"])}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
                >
                  {KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Đơn vị</Label>
                <select
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
                >
                  <option value="">— Chọn đơn vị —</option>
                  {centers
                    .slice()
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="tt">Tiêu đề</Label>
              <Input id="tt" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" required />
            </div>
            <div>
              <Label htmlFor="dd">Chi tiết</Label>
              <Textarea id="dd" value={detail} onChange={(e) => setDetail(e.target.value)} className="mt-1" rows={4} />
            </div>
            {/* Đính kèm */}
            <div>
              <Label>Đính kèm ({attachments.length}/{MAX_FILES})</Label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {attachments.map((url) => (
                  <div key={url} className="group relative">
                    {isImageUrl(url) ? (
                      <img src={url} alt="Đính kèm" className="size-14 rounded-md border border-line object-cover" />
                    ) : (
                      <div className="flex h-14 items-center gap-1 rounded-md border border-line px-2 text-xs text-muted">
                        <FileText className="size-4" /> {fileNameFromUrl(url).slice(0, 12)}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((u) => u !== url))}
                      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-danger text-white"
                      title="Xóa đính kèm"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {attachments.length < MAX_FILES ? (
                  <label className={`flex h-14 w-14 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-line text-faint hover:bg-surface-2 ${uploading ? "pointer-events-none opacity-50" : ""}`}>
                    <Plus className="size-5" />
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                      className="hidden"
                      onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ""; }}
                      disabled={uploading}
                    />
                  </label>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-faint">Ảnh (tự nén) + PDF/Word/Excel — tối đa {MAX_FILES} tệp, {MAX_FILE_MB}MB/tệp</p>
            </div>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Đang upload..." : editingId ? "Lưu thay đổi" : "Gửi đề nghị"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog chi tiết ===== */}
      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent>
          <DialogTitle>Chi tiết đề nghị</DialogTitle>
          {detailRow ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge value={detailRow.kind} />
                <StatusBadge value={detailRow.status} />
                {(detailRow.attachments?.length ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                    <Paperclip className="size-3" /> {detailRow.attachments!.length} tệp
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-base leading-6 font-semibold text-ink">{detailRow.title}</p>
              <div className="mt-3 divide-y divide-line">
                <DetailRow label="Người đề nghị" value={detailRow.requester} />
                <DetailRow label="Đơn vị" value={detailRow.dept} />
                <DetailRow label="Ngày tạo" value={formatDate(detailRow.date)} />
                <DetailRow label="Nội dung" value={detailRow.detail} />
                <DetailRow label="Người duyệt" value={detailRow.approver} />
                <DetailRow
                  label="Ngày duyệt"
                  value={detailRow.approvedAt ? formatDate(detailRow.approvedAt.slice(0, 10)) : ""}
                />
              </div>
              {/* Đính kèm: ảnh bấm phóng to, file bấm mở tab mới */}
              {(detailRow.attachments?.length ?? 0) > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted">Tệp đính kèm</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detailRow.attachments!.map((url) =>
                      isImageUrl(url) ? (
                        <img
                          key={url}
                          src={url}
                          alt="Đính kèm"
                          title="Bấm để phóng to"
                          onClick={() => setLightbox(url)}
                          className="size-16 cursor-zoom-in rounded-md border border-line object-cover hover:opacity-90"
                        />
                      ) : (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-10 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-muted hover:bg-surface-2"
                        >
                          <FileText className="size-4" /> {fileNameFromUrl(url)}
                        </a>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
              {/* Duyệt / từ chối / mở lại ngay trong dialog chi tiết */}
              {isAdmin && detailRow.status === "Chờ duyệt" ? (
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setProposalStatus(detailRow.id, "Từ chối", meName);
                      toast.message("Đã từ chối");
                      setDetailRow(null);
                    }}
                  >
                    Từ chối
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setProposalStatus(detailRow.id, "Đã duyệt", meName);
                      toast.success("Đã phê duyệt");
                      setDetailRow(null);
                    }}
                  >
                    Phê duyệt
                  </Button>
                </div>
              ) : null}
              {isAdmin && detailRow.status !== "Chờ duyệt" ? (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setProposalStatus(detailRow.id, "Chờ duyệt");
                      toast.message("Đã mở lại — phiếu về Chờ duyệt");
                      setDetailRow(null);
                    }}
                  >
                    <Undo2 className="size-4" />
                    Mở lại
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ===== Dialog xác nhận xóa ===== */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Xóa đề nghị</DialogTitle>
          <DialogDesc>
            Chắc xóa đề nghị "{deleteRow?.title}"? Hành động này không thể hoàn tác.
          </DialogDesc>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteRow(null)}>
              Lưu lại
            </Button>
            <Button variant="danger" size="sm" onClick={() => {
                if (deleteRow) {
                  removeProposal(deleteRow.id);
                  toast.success("Đã xóa đề nghị");
                }
                setDeleteRow(null);
              }}
            >
              Chắc xóa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Lightbox ảnh — nền trắng (đồng bộ GĐ 65) ===== */}
      {lightbox ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-white/95 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-black/10 text-ink hover:bg-black/20"
          >
            <X className="size-5" />
          </button>
          <img
            src={lightbox}
            alt="Ảnh phóng to"
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
