import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  FileText,
  FolderOpen,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, todayIso } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { DOC_CATEGORIES, type Document } from "@/lib/types";

export const Route = createFileRoute("/ho-so")({ component: HoSoPage });

const MAX_FILES = 5;
const MAX_FILE_MB = 2;

/** Nén ảnh client-side ≤800KB (pattern Đề nghị GĐ 59) */
async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  if (!file.type.startsWith("image/")) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      throw new Error(`File "${file.name}" quá lớn (tối đa ${MAX_FILE_MB}MB)`);
    }
    return dataUrl;
  }
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

function isImageUrl(url: string): boolean {
  return /\/image\/upload\//.test(url) || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);
}

function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    return decodeURIComponent(parts[parts.length - 1]) || "Tệp đính kèm";
  } catch {
    return "Tệp đính kèm";
  }
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs font-medium text-muted">{label}</span>
      <span className="min-w-0 text-right text-sm break-words text-ink">{value || "—"}</span>
    </div>
  );
}

function HoSoPage() {
  const documents = useAppStore((s) => s.documents);
  const centers = useAppStore((s) => s.centers);
  const addDocument = useAppStore((s) => s.addDocument);
  const updateDocument = useAppStore((s) => s.updateDocument);
  const removeDocument = useAppStore((s) => s.removeDocument);

  // Reactive current user (pattern GĐ 16)
  const currentEmployee = useAppStore(
    (s) => s.employees.find((e) => e.id === s.currentUserId) ?? null,
  );
  const isAdmin =
    currentEmployee?.role === "Admin" ||
    currentEmployee?.role === "SuperAdmin" ||
    currentEmployee?.title?.includes("Quản trị");
  const meName = currentEmployee?.name ?? useAppStore.getState().currentName();
  const meId = currentEmployee?.id ?? "";

  // ===== Dialog states =====
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<Document | null>(null);
  const [deleteRow, setDeleteRow] = useState<Document | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // ===== Form states =====
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Khác");
  const [dept, setDept] = useState("");
  const [center, setCenter] = useState("");
  const [summary, setSummary] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // ===== Filters =====
  const [q, setQ] = useState("");
  const [fCategory, setFCategory] = useState("all");
  const [fDept, setFDept] = useState("all");
  const [fCenter, setFCenter] = useState("all");
  const [fCreator, setFCreator] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [mine, setMine] = useState(false);

  // ===== Sticky header ref (pattern GĐ 58/63) =====
  const stickyFiltersRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const set = () => {
      const h = `${el.offsetHeight}px`;
      el.style.setProperty("--hs-sticky-h", h);
      el.parentElement?.style.setProperty("--hs-sticky-h", h);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
  }, []);

  // ===== Danh sách lựa chọn từ data thật =====
  const depts = useMemo(
    () => [...new Set(documents.map((d) => d.dept).filter(Boolean))].sort(),
    [documents],
  );
  const creators = useMemo(
    () => [...new Set(documents.map((d) => d.creator).filter(Boolean))].sort(),
    [documents],
  );

  // ===== Stats =====
  const stats = useMemo(
    () => ({
      total: documents.length,
      categories: new Set(documents.map((d) => d.category)).size,
      depts: new Set(documents.map((d) => d.dept).filter(Boolean)).size,
      mine: documents.filter((d) => (d.createdBy || d.creator) === (meId || meName)).length,
    }),
    [documents, meId, meName],
  );

  // ===== Filter + sort rows =====
  const rows = useMemo(() => {
    return documents
      .filter((d) => {
        if (fCategory !== "all" && d.category !== fCategory) return false;
        if (fDept !== "all" && d.dept !== fDept) return false;
        if (fCenter !== "all" && d.center !== fCenter) return false;
        if (fCreator !== "all" && d.creator !== fCreator) return false;
        if (mine && (d.createdBy || d.creator) !== (meId || meName)) return false;
        if (q.trim()) {
          const s = q.toLowerCase();
          const hay = `${d.title} ${d.summary} ${d.category} ${d.dept} ${d.creator}`.toLowerCase();
          if (!hay.includes(s)) return false;
        }
        if (fFrom && d.date < fFrom) return false;
        if (fTo && d.date > fTo) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [documents, fCategory, fDept, fCenter, fCreator, mine, meId, meName, q, fFrom, fTo]);

  // ===== Reset form =====
  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle("");
    setCategory("Khác");
    setDept("");
    setCenter("");
    setSummary("");
    setAttachments([]);
  }, []);

  const openCreate = () => {
    resetForm();
    setDept(currentEmployee?.dept ?? "");
    setCenter(currentEmployee?.center ?? "");
    setOpen(true);
  };

  const openEdit = (d: Document) => {
    resetForm();
    setEditingId(d.id);
    setTitle(d.title);
    setCategory(d.category);
    setDept(d.dept);
    setCenter(d.center);
    setSummary(d.summary);
    setAttachments(d.attachments ?? []);
    setOpen(true);
  };

  // ===== Upload =====
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_FILES - attachments.length;
    if (room <= 0) {
      toast.error(`Tối đa ${MAX_FILES} tệp mỗi hồ sơ`);
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
          data: { base64, folder: "giong-vn/documents", fileName: f.name },
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

  // ===== Submit =====
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (editingId) {
      updateDocument(editingId, {
        title: title.trim(),
        category,
        dept: dept.trim(),
        center: center.trim(),
        summary: summary.trim(),
        attachments,
      });
      toast.success("Đã cập nhật hồ sơ");
    } else {
      addDocument({
        title: title.trim(),
        category,
        dept: dept.trim(),
        center: center.trim(),
        summary: summary.trim(),
        creator: meName,
        createdBy: meId,
        date: todayIso(),
        attachments,
      });
      toast.success("Đã thêm hồ sơ");
    }
    setOpen(false);
    resetForm();
  }

  // ===== Quyền: người tạo sửa/xóa hồ sơ của mình; Admin toàn quyền =====
  const canModify = (d: Document) => {
    const isOwner = (d.createdBy || d.creator) === (meId || meName);
    return isOwner || isAdmin;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Danh mục"
        title="Hồ sơ tài liệu"
        desc="Thêm mới, tra cứu hồ sơ tài liệu công ty với tệp đính kèm."
        actions={
          <Button onClick={openCreate}>
            <Plus />
            Thêm hồ sơ
          </Button>
        }
      />

      {/* ===== 4 card thống kê ===== */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Tổng hồ sơ", value: stats.total, color: "text-ink", icon: FolderOpen },
          { label: "Loại hồ sơ", value: stats.categories, color: "text-accent", icon: FileText },
          { label: "Phòng ban", value: stats.depts, color: "text-muted", icon: FileText },
          { label: "Của tôi", value: stats.mine, color: "text-ok", icon: FileText },
        ].map((c) => (
          <Card key={c.label} className="px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
              <c.icon className="size-3.5" /> {c.label}
            </p>
            <p className={`mt-1 text-2xl font-semibold tabular ${c.color}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      {/* ===== Khối lọc — GHIM (pattern Chấm công GĐ 55) ===== */}
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
              placeholder="Tìm tên, mô tả, người tạo..."
              className="h-10 pl-10"
            />
          </div>
          <select
            value={fCategory}
            onChange={(e) => setFCategory(e.target.value)}
            className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
            title="Lọc loại hồ sơ"
          >
            <option value="all">Mọi loại</option>
            {DOC_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={fDept}
            onChange={(e) => setFDept(e.target.value)}
            className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
            title="Lọc phòng ban"
          >
            <option value="all">Mọi phòng ban</option>
            {depts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={fCenter}
            onChange={(e) => setFCenter(e.target.value)}
            className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
            title="Lọc đơn vị"
          >
            <option value="all">Mọi đơn vị</option>
            {centers
              .slice()
              .sort((a, b) => a.code.localeCompare(b.code))
              .map((c) => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
          </select>
          <select
            value={fCreator}
            onChange={(e) => setFCreator(e.target.value)}
            className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
            title="Lọc người tạo"
          >
            <option value="all">Mọi người tạo</option>
            {creators.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
        Hiển thị <span className="font-medium text-ink">{rows.length}</span> / {documents.length} hồ sơ
      </p>

      {/* ===== Bảng hồ sơ — giống Chấm công/Đề nghị ===== */}
      <Card className="overflow-hidden p-0 lg:overflow-visible">
        <div className="overflow-x-auto lg:overflow-x-visible">
          <table className="w-full text-sm">
            <thead className="sticky top-[calc(4rem+var(--hs-sticky-h,64px))] z-[5]">
              <tr className="border-b border-line bg-surface">
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">STT</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Tên hồ sơ</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Loại</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Phòng ban</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Đơn vị</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Người tạo</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Ngày</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Đính kèm</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted">
                    Không có hồ sơ nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                rows.map((d, idx) => (
                  <tr
                    key={d.id}
                    onClick={() => setDetailRow(d)}
                    className="cursor-pointer border-b border-line transition-colors hover:bg-surface-2/40"
                  >
                    <td className="px-3 py-3 text-faint tabular">{idx + 1}</td>
                    <td className="max-w-[280px] px-3 py-3">
                      <p className="truncate font-medium text-ink">{d.title}</p>
                      {d.summary ? <p className="truncate text-xs text-muted">{d.summary}</p> : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                        {d.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{d.dept || "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{d.center || "—"}</td>
                    <td className="px-3 py-3 font-medium whitespace-nowrap text-ink">{d.creator || "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted tabular">{formatDate(d.date)}</td>
                    <td className="px-3 py-3 text-center">
                      {(d.attachments?.length ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                          <Paperclip className="size-3" /> {d.attachments!.length}
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      {canModify(d) ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            title="Sửa"
                            onClick={() => openEdit(d)}
                            className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:bg-surface-2"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Xóa"
                            onClick={() => setDeleteRow(d)}
                            className="rounded-lg border border-line px-2 py-1 text-xs text-danger hover:bg-danger/10"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-faint">—</span>
                      )}
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
          <DialogTitle>{editingId ? "Sửa hồ sơ" : "Thêm hồ sơ mới"}</DialogTitle>
          <DialogDesc>
            {editingId ? "Cập nhật thông tin hồ sơ tài liệu." : "Thêm hồ sơ tài liệu vào kho lưu trữ công ty."}
          </DialogDesc>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <div>
              <Label htmlFor="ht">Tên hồ sơ</Label>
              <Input id="ht" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" required />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Loại hồ sơ</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
                >
                  {DOC_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Phòng ban</Label>
                <Input value={dept} onChange={(e) => setDept(e.target.value)} className="mt-1" placeholder="VD: HCNS" />
              </div>
              <div>
                <Label>Đơn vị</Label>
                <select
                  value={center}
                  onChange={(e) => setCenter(e.target.value)}
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
              <Label htmlFor="hm">Mô tả</Label>
              <Textarea id="hm" value={summary} onChange={(e) => setSummary(e.target.value)} className="mt-1" rows={3} />
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
              {uploading ? "Đang upload..." : editingId ? "Lưu thay đổi" : "Thêm hồ sơ"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog chi tiết ===== */}
      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent>
          <DialogTitle>Chi tiết hồ sơ</DialogTitle>
          {detailRow ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                  {detailRow.category}
                </span>
                {(detailRow.attachments?.length ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                    <Paperclip className="size-3" /> {detailRow.attachments!.length} tệp
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-base leading-6 font-semibold text-ink">{detailRow.title}</p>
              <div className="mt-3 divide-y divide-line">
                <DetailRow label="Phòng ban" value={detailRow.dept} />
                <DetailRow label="Đơn vị" value={detailRow.center} />
                <DetailRow label="Người tạo" value={detailRow.creator} />
                <DetailRow label="Ngày tạo" value={formatDate(detailRow.date)} />
                <DetailRow label="Mô tả" value={detailRow.summary} />
              </div>
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
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ===== Dialog xác nhận xóa ===== */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Xóa hồ sơ</DialogTitle>
          <DialogDesc>
            Chắc xóa hồ sơ "{deleteRow?.title}"? Hành động này không thể hoàn tác.
          </DialogDesc>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteRow(null)}>
              Lưu lại
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (deleteRow) {
                  removeDocument(deleteRow.id);
                  toast.success("Đã xóa hồ sơ");
                }
                setDeleteRow(null);
              }}
            >
              Chắc xóa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Lightbox ảnh — nền trắng ===== */}
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
