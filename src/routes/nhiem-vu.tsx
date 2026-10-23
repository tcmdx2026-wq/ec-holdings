import { createFileRoute } from "@tanstack/react-router";
import { Camera, Edit, MapPin, Plus, Trash2, ChevronDown, X } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EMPLOYEES, isAdminRole } from "@/lib/catalog";
import { canCreateTaskForOthers, canEditTask } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/nhiem-vu")({ component: TasksPage });

const COLS = ["Việc cần làm", "Quá hạn", "Đã xong"] as const;

type TaskStatus = (typeof COLS)[number];

function TasksPage() {
  // Desktop (lg+): đo chiều cao khối ghim (tiêu đề + bộ lọc + toggle view) để ghim theo
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stickyHeaderRef.current;
    if (!el) return;
    const update = () => {
      const h = `${Math.ceil(el.getBoundingClientRect().height)}px`;
      el.style.setProperty("--nv-sticky-h", h);
      // Đặt trên cha chung để tiêu đề cột (nằm NGOÀI khối ghim) cũng đọc được var
      el.parentElement?.style.setProperty("--nv-sticky-h", h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tasks = useAppStore((s) => s.tasks);
  const addTask = useAppStore((s) => s.addTask);
  const setTaskStatus = useAppStore((s) => s.setTaskStatus);
  const updateTask = useAppStore((s) => s.updateTask);
  const removeTask = useAppStore((s) => s.removeTask);
  const me = useAppStore((s) => s.currentName());
  const currentUserName = useAppStore((s) => s.currentUserId ?? "");
  // Reactive: subscribe to employees so this re-renders when DB data loads
  const currentEmployee = useAppStore((s) => s.employees.find((e) => e.id === s.currentUserId) ?? null);
  const currentUser = currentEmployee ?? EMPLOYEES[0];
  const canCreateForOthers = canCreateTaskForOthers(currentEmployee);
  // Người giao nhiệm vụ mặc định = user đang login
  const defaultAssigner = currentUser.name;
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterAssigner, setFilterAssigner] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setTitle("");
      setAssignee(currentUser.username);
      setDue("");
      setSupportList([]);
      setBlocker("");
      setPhoto(null);
      setLocation("");
    }
  }, [open, currentUser.username]);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(currentUser.username);
  const [due, setDue] = useState("");
  const [supportList, setSupportList] = useState<string[]>([]);
  const [blocker, setBlocker] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const photoRef = useRef<HTMLInputElement>(null);

  const isAdmin = isAdminRole(currentEmployee?.role);
  // Reactive: subscribe to employees list so dropdown updates after DB load
  const allEmployees = useAppStore((s) => s.employees);
  // Dropdown: only "Văn phòng" center employees (guard khi store chưa sẵn)
  const vpEmployees = useMemo(() => {
    try {
      if (!allEmployees) return [];
      return allEmployees.filter((e) => e.center === "VP" || e.center === "Văn phòng");
    } catch {
      return [];
    }
  }, [allEmployees]);

  // Check if task is overdue: due date < now and status is "Việc cần làm"
  function isOverdue(t: Task): boolean {
    if (t.status !== "Việc cần làm" || !t.due) return false;
    const dueDate = new Date(t.due);
    const now = new Date();
    return dueDate.getTime() < now.getTime();
  }

  // Get effective column for task (auto-detect overdue)
  function colOf(t: Task): TaskStatus {
    if (t.status === "Đã xong") return "Đã xong";
    if (isOverdue(t)) return "Quá hạn";
    return "Việc cần làm";
  }

  const filtered = useMemo(() => {
    const currentUserName = currentUser.username.toLowerCase();
    return tasks.filter((t) => {
      // Non-admin users can only see their own tasks
      if (!isAdmin) {
        const assigneeMatches = t.assignee.toLowerCase() === currentUserName;
        const createdByMatches = t.createdBy.toLowerCase() === me.toLowerCase();
        if (!assigneeMatches && !createdByMatches) return false;
      } else if (mine) {
        // Admin can toggle "mine" filter
        const assigneeMatches = t.assignee.toLowerCase() === currentUserName;
        const createdByMatches = t.createdBy.toLowerCase() === me.toLowerCase();
        if (!assigneeMatches && !createdByMatches) return false;
      }
      // Filter by assignee (dropdown)
      if (filterAssignee && t.assignee !== filterAssignee) return false;
      if (filterAssigner && t.assigner !== filterAssigner) return false;
      // Filter by creation date range
      if (dateFrom) {
        const taskDate = t.created.slice(0, 10);
        if (taskDate < dateFrom) return false;
      }
      if (dateTo) {
        const taskDate = t.created.slice(0, 10);
        if (taskDate > dateTo) return false;
      }
      // Search by title or assignee
      if (q.trim()) {
        const s = q.toLowerCase();
        return t.title.toLowerCase().includes(s) || t.assignee.toLowerCase().includes(s);
      }
      return true;
    });
  }, [tasks, q, mine, filterAssignee, filterAssigner, dateFrom, dateTo, currentUser.username, me, isAdmin]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (editingId) {
      updateTask(editingId, {
        assignee,
        title: title.trim(),
        due: due ? `${due} 18:00` : "",
        support: supportList.join(", "),
        blocker,
        photo: photo ?? undefined,
        location,
      });
      toast.success("Đã cập nhật nhiệm vụ");
    } else {
      addTask({
        assignee,
        title: title.trim(),
        due: due ? `${due} 18:00` : "",
        status: "Việc cần làm",
        support: supportList.join(", "),
        blocker,
        createdBy: me,
        assigner: defaultAssigner,
        photo: photo ?? undefined,
        location,
      });
      toast.success("Đã tạo nhiệm vụ");
    }
    setOpen(false);
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function requestLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setLocation(`${lat}, ${lng}`);
      },
      () => setLocation(""),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div>
      {/* Desktop (lg+): ghim tiêu đề + bộ lọc + toggle view khi cuộn. Mobile: cuộn bình thường. */}
      <div ref={stickyHeaderRef} className="lg:sticky lg:top-16 lg:z-10 lg:bg-bg lg:pb-2">
      <PageHeader
        eyebrow="Vận hành"
        title="Nhiệm vụ"
        desc="Kế hoạch tuần — tháng. Nhân viên lập, quản lý theo dõi tiến độ."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Nhiệm vụ mới
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm việc, người phụ trách…" className="sm:max-w-sm lg:max-w-[220px]" />
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)] sm:max-w-[200px] lg:max-w-[170px]"
        >
          <option value="">Tất cả phụ trách</option>
          {vpEmployees.map((e) => (
            <option key={e.id} value={e.username}>{e.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)] lg:w-[135px]"
          />
          <span className="text-muted">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)] lg:w-[135px]"
          />
        </div>
        <select
          value={filterAssigner}
          onChange={(e) => setFilterAssigner(e.target.value)}
          className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)] sm:max-w-[200px] lg:max-w-[170px]"
        >
          <option value="">Tất cả người giao</option>
          {vpEmployees.map((e) => (
            <option key={e.id} value={e.name}>{e.name}</option>
          ))}
        </select>
        <label className="flex h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isAdmin ? mine : true} onChange={(e) => isAdmin && setMine(e.target.checked)} disabled={!isAdmin} className="size-4 accent-accent" />
          {currentUser.name} {!isAdmin && "(chỉ của bạn)"}
        </label>
        <div className="ml-auto flex rounded-md bg-surface p-1 shadow-[var(--shadow-card)]">
          <button type="button" onClick={() => setView("board")} className={`h-9 rounded-sm px-3 text-sm ${view === "board" ? "bg-forest text-forest-fg" : "text-muted"}`}>
            Khối
          </button>
          <button type="button" onClick={() => setView("list")} className={`h-9 rounded-sm px-3 text-sm ${view === "list" ? "bg-forest text-forest-fg" : "text-muted"}`}>
            Danh sách
          </button>
        </div>
      </div>
      </div>

      {view === "board" ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {COLS.map((col) => {
            const items = filtered.filter((t) => colOf(t) === col).sort((a, b) => {
              if (col === "Việc cần làm") return (b.created || "").localeCompare(a.created || "");
              if (col === "Quá hạn") return (b.due || "").localeCompare(a.due || "");
              if (col === "Đã xong") return (b.updated || "").localeCompare(a.updated || "");
              return 0;
            });
            return (
              <section key={col} className="rounded-xl bg-surface-2/70 p-3">
                <div className="mb-2 flex items-center justify-between px-1 lg:sticky lg:top-[calc(4rem+var(--nv-sticky-h,160px))] lg:z-[5] lg:bg-surface-2">
                  <h2 className={`text-sm font-semibold ${col === "Đã xong" ? "text-green-700" : "text-ink"}`}>{col}</h2>
                  <span className="text-xs tabular text-muted">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.slice(0, 24).map((t) => {
                    const overdue = isOverdue(t);
                    return (
                      <article key={t.id} className={`rounded-lg bg-surface p-3 shadow-[var(--shadow-card)] ${overdue ? "border-l-2 border-red-300" : col === "Đã xong" ? "border-l-2 border-green-500" : ""}`}>
                        <p className={`text-sm font-medium ${overdue ? "text-red-400" : col === "Đã xong" ? "text-green-700" : "text-ink"}`}>{t.title}</p>
                        <p className={`mt-2 text-xs ${overdue ? "text-red-300" : col === "Đã xong" ? "text-green-600" : "text-muted"}`}>
                          {t.assignee || "Chưa gán"}: {formatDate(t.created)} - {formatDate(t.due)}
                        </p>
                        {t.assigner ? <p className="mt-1 text-xs text-muted">Người giao: {t.assigner}</p> : null}
                        {t.support ? <p className="mt-1 text-xs text-muted">Hỗ trợ: {t.support}</p> : null}
                        {t.blocker ? <p className="mt-2 line-clamp-2 text-xs text-warn">⚠ {t.blocker}</p> : null}
                        {t.photo ? <img src={t.photo} alt="Ảnh" className="mt-2 h-12 w-12 rounded object-cover" /> : null}
                        {t.location ? <p className="mt-1 text-[10px] text-faint">📍 {t.location}</p> : null}
                        {canEditTask(currentEmployee, t.createdBy) ? (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {COLS.filter((c) => c !== col && c !== "Quá hạn").map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setTaskStatus(t.id, c)}
                                className="h-8 rounded-sm bg-surface-2 px-2 text-[11px] font-medium text-muted hover:text-ink"
                              >
                                {c}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(t.id);
                                setTitle(t.title);
                                setAssignee(t.assignee);
                                setDue(t.due ? t.due.split(" ")[0] : "");
                                setSupportList(t.support ? t.support.split(", ").filter(Boolean) : []);
                                setBlocker(t.blocker);
                                setPhoto(t.photo ?? null);
                                setLocation(t.location ?? "");
                                setOpen(true);
                              }}
                              className="h-8 rounded-sm bg-surface-2 px-2 text-[11px] font-medium text-muted hover:text-ink flex items-center gap-1"
                            >
                              <Edit className="size-3" />
                              Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(t.id)}
                              className="h-8 rounded-sm bg-surface-2 px-2 text-[11px] font-medium text-red-400 hover:text-red-500 hover:bg-red-50 flex items-center gap-1"
                            >
                              <Trash2 className="size-3" />
                              Xóa
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                  {items.length === 0 ? <p className="px-1 py-6 text-center text-sm text-faint">Trống</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Không có nhiệm vụ" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.slice(0, 60).sort((a, b) => {
                // Sắp xếp theo ngày khởi tạo (mới nhất lên trên)
                return (b.created || "").localeCompare(a.created || "");
              }).map((t) => {
                const col = colOf(t);
                const overdue = col === "Quá hạn";
                return (
                  <li key={t.id} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${overdue ? "bg-red-50/50" : t.status === "Đã xong" ? "bg-green-100/50" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${overdue ? "text-red-400" : t.status === "Đã xong" ? "text-green-700" : "text-ink"}`}>{t.title}</p>
                      <p className={`text-sm ${overdue ? "text-red-300" : t.status === "Đã xong" ? "text-green-600" : "text-muted"}`}>
                        {t.assignee}: {formatDate(t.created)} - {formatDate(t.due)}
                      </p>
                      {t.assigner ? <p className="text-xs text-muted">Người giao: {t.assigner}</p> : null}
                      {t.support ? <p className="text-xs text-muted">Hỗ trợ: {t.support}</p> : null}
                      {t.blocker ? <p className="text-xs text-warn">⚠ {t.blocker}</p> : null}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {t.photo ? <img src={t.photo} alt="Ảnh" className="h-10 w-10 rounded object-cover" /> : null}
                      {/* Cột trạng thái rộng hơn, không xuống dòng */}
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap min-w-[90px] justify-center
                        ${overdue ? "bg-red-100 text-red-700" : col === "Đã xong" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {col}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogTitle>{editingId ? "Chỉnh sửa nhiệm vụ" : "Nhiệm vụ mới"}</DialogTitle>
          <DialogDesc>{editingId ? "Cập nhật thông tin nhiệm vụ." : "Ghi việc cần làm trong tuần hoặc tháng."}</DialogDesc>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <div>
              <Label htmlFor="t">Nội dung</Label>
              <Textarea id="t" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" required />
            </div>
            <div>
              <Label htmlFor="a">Phụ trách</Label>
              <select
                id="a"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="mt-1 h-11 w-full rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)]"
                disabled={!canCreateForOthers && !!editingId}
              >
                {canCreateForOthers ? (
                  vpEmployees.map((e) => (
                    <option key={e.id} value={e.username}>
                      {e.name} ({e.username})
                    </option>
                  ))
                ) : (
                  <option value={currentUser.username}>
                    {currentUser.name} (chỉ tạo cho bản thân)
                  </option>
                )}
              </select>
            </div>
            <div>
              <Label>Người hỗ trợ</Label>
              {/* GĐ 82: modal={true} — Popover lồng trong Dialog modal bị chặn wheel
                  (react-remove-scroll của Dialog chặn mọi target ngoài DialogContent,
                  portal Popover nằm ngoài) → lăn chuột không chạy, phải kéo scrollbar.
                  modal=true tạo lớp scroll-lock riêng — wheel TRÊN danh sách được phép. */}
              <Popover.Root modal={true}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className="mt-1 flex h-11 w-full items-center justify-between rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)] hover:bg-surface-2"
                  >
                    <span className={supportList.length === 0 ? "text-muted" : "text-ink"}>
                      {supportList.length === 0
                        ? "Chọn người hỗ trợ…"
                        : `${supportList.length} người đã chọn`}
                    </span>
                    <ChevronDown className="size-4 text-muted" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="z-50 max-h-64 w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-lg border bg-white p-2 shadow-lg"
                    sideOffset={4}
                    align="start"
                  >
                    <div className="flex flex-col gap-0.5">
                      {vpEmployees.map((e) => (
                        <label
                          key={e.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2 ${supportList.includes(e.name) ? "bg-surface-2" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={supportList.includes(e.name)}
                            onChange={() => {
                              const next = supportList.includes(e.name)
                                ? supportList.filter((n) => n !== e.name)
                                : [...supportList, e.name];
                              setSupportList(next);
                            }}
                            className="size-4 accent-accent"
                          />
                          <span className="text-ink">{e.name} ({e.username})</span>
                        </label>
                      ))}
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
              {supportList.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {supportList.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => setSupportList(supportList.filter((n) => n !== name))}
                        className="rounded-full p-0.5 hover:bg-accent/20"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="d">Ngày đến hạn</Label>
              <Input id="d" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="b">Khó khăn khi triển khai</Label>
              <Textarea id="b" value={blocker} onChange={(e) => setBlocker(e.target.value)} placeholder="Cản trở, khó khăn (nếu có)" className="mt-1" rows={2} />
            </div>
            <div>
              <Label>Ảnh xác nhận</Label>
              <div className="mt-1 flex items-center gap-2">
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()}>
                  <Camera className="size-4 mr-1" />
                  Chọn ảnh
                </Button>
                {photo && (
                  <div className="relative">
                    <img src={photo} alt="Preview" className="h-16 w-16 rounded-lg object-cover" />
                    <button type="button" onClick={() => setPhoto(null)} className="absolute -top-1 -right-1 size-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">×</button>
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label>Vị trí khởi tạo</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Tọa độ GPS hoặc địa chỉ" className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={requestLocation} title="Lấy vị trí hiện tại">
                  <MapPin className="size-4" />
                </Button>
              </div>
            </div>
            <Button type="submit">{editingId ? "Cập nhật" : "Lưu nhiệm vụ"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Xóa nhiệm vụ</DialogTitle>
          <DialogDesc>Bạn có muốn xóa không?</DialogDesc>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>Lưu lại</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deletingId) {
                  removeTask(deletingId);
                  toast.success("Đã xóa nhiệm vụ");
                  setDeletingId(null);
                }
              }}
            >
              Chắc xóa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
