/**
 * Nhân sự page — clean rewrite.
 * Uses EmployeeTable + EmployeeForm components.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmployeeTable } from "@/components/employee/employee-table";
import { EmployeeForm } from "@/components/employee/employee-form";
import { centerName, isAdminRole } from "@/lib/catalog";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAppStore } from "@/lib/store";
import { deleteEmployee } from "@/routes/api/employee-crud";
import { cn } from "@/lib/utils";
import type { Employee } from "@/lib/types";

export const Route = createFileRoute("/nhan-su")({ component: NhanSuPage });

function NhanSuPage() {
  const employees = useAppStore((s) => s.employees);
  const { user } = useCurrentUserState();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [view, setView] = useState<"grid" | "table">("table");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  // Admin check
  const byEmail = user ? employees.find((e) => e.email === (user.primaryEmail ?? "")) : null;
  const byName = user ? employees.find((e) => e.name === (user.displayName ?? "")) : null;
  const currentEmployee = byEmail ?? byName ?? employees[0];
  const isAdmin = (currentEmployee ? isAdminRole(currentEmployee.role) : false)
    || user?.primaryEmail === "tcmdx2026@gmail.com"
    || user?.primaryEmail === "cuongpk.giong02@gmail.com"
    || user?.displayName === "Phạm Kiên Cường";

  // Filter
  const depts = useMemo(() => [...new Set(employees.map((e) => e.dept))].sort(), [employees]);
  const rows = employees.filter((e) => {
    if (dept !== "all" && e.dept !== dept) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      return e.name.toLowerCase().includes(s) || e.username.toLowerCase().includes(s) || e.email.toLowerCase().includes(s) || e.dept.toLowerCase().includes(s) || e.title.toLowerCase().includes(s) || centerName(e.center).toLowerCase().includes(s);
    }
    return true;
  });

  // Stats
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === "Đang làm việc" || e.status === "active").length;
    const admins = employees.filter((e) => e.role === "Admin" || e.role === "SuperAdmin").length;
    const centers = new Set(employees.map((e) => e.center)).size;
    return { total, active, admins, centers };
  }, [employees]);

  // Refresh employees from DB after CRUD
  const refreshEmployees = useCallback(() => {
    useAppStore.getState().hydrate();
  }, []);

  // Callback ref — đo chiều cao khối ghim bộ lọc, set CSS var --ns-sticky-h
  // trên chính khối ghim VÀ parentElement (cha chung) để thead (nằm ngoài khối ghim) đọc được.
  // Dùng callback ref (không phải useEffect + object ref) — pattern GĐ 63: ClientOnly/render-lầu-2
  // khiến object ref với useEffect deps [] không bao giờ chạy.
  const stickyFiltersRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const set = () => {
      const h = `${el.offsetHeight}px`;
      el.style.setProperty("--ns-sticky-h", h);
      el.parentElement?.style.setProperty("--ns-sticky-h", h);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
  }, []);

  // Handlers
  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (e: Employee) => { setEditing(e); setFormOpen(true); };
  const handleDelete = useCallback(async (e: Employee) => {
    if (!confirm(`Xác nhận xóa ${e.name}?`)) return;
    try {
      await deleteEmployee({ data: { id: e.id } });
      toast.success(`Đã xóa ${e.name}`);
      refreshEmployees();
    } catch (err: any) {
      toast.error(err?.message ?? "Lỗi xóa");
    }
  }, [refreshEmployees]);

  return (
    <div>
      <PageHeader
        eyebrow="Danh mục"
        title="Nhân sự"
        desc={`${stats.total} người đang làm việc · ${stats.admins} quản trị · ${stats.centers} đơn vị`}
      />

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Tổng nhân sự", value: stats.total, color: "text-ink" },
          { label: "Đang làm việc", value: stats.active, color: "text-ok" },
          { label: "Quản trị", value: stats.admins, color: "text-accent" },
          { label: "Đơn vị", value: stats.centers, color: "text-muted" },
        ].map((s) => (
          <Card key={s.label} className="px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">{s.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular", s.color)}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters + Add button — khối ghim: dừng ngay dưới header app khi cuộn (cả desktop + mobile) */}
      <div ref={stickyFiltersRef} className="sticky top-16 z-10 -mx-4 border-b border-line bg-bg px-4 pb-2 sm:-mx-6 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên, tài khoản, phòng ban..." className="h-11 w-full rounded-xl border border-line bg-surface/90 pr-3 pl-10 text-sm text-ink shadow-[var(--shadow-card)] placeholder:text-faint transition focus:border-accent/30 focus:ring-2 focus:ring-accent/20 focus:outline-none" />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="h-11 rounded-xl border border-line bg-surface/90 px-3 text-sm shadow-[var(--shadow-card)] sm:w-56">
          <option value="all">Mọi bộ phận ({employees.length})</option>
          {depts.map((d) => <option key={d} value={d}>{d} ({employees.filter((e) => e.dept === d).length})</option>)}
        </select>
        {isAdmin && (
          <Button size="sm" onClick={openAdd} className="shrink-0">
            <Plus className="size-4 mr-1" /> Thêm nhân sự
          </Button>
        )}
        <div className="flex rounded-lg border border-line bg-surface/90 p-0.5">
          <button type="button" onClick={() => setView("grid")} className={cn("flex size-9 items-center justify-center rounded-md transition-colors", view === "grid" ? "bg-accent text-accent-fg" : "text-muted hover:text-ink")}><LayoutGrid className="size-4" /></button>
          <button type="button" onClick={() => setView("table")} className={cn("flex size-9 items-center justify-center rounded-md transition-colors", view === "table" ? "bg-accent text-accent-fg" : "text-muted hover:text-ink")}><List className="size-4" /></button>
        </div>
      </div>
      </div>

      <p className="mb-3 text-sm text-muted">
        Hiển thị <span className="font-medium text-ink">{rows.length}</span> / {employees.length} nhân sự
      </p>

      {/* Table view */}
      {view === "table" && <EmployeeTable employees={rows} isAdmin={isAdmin} onEdit={openEdit} onDelete={handleDelete} />}

      {/* Grid view */}
      {view === "grid" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((e) => (
            <Card key={e.id} className="flex gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-card-hover)]">
              <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold", e.role === "Admin" || e.role === "SuperAdmin" ? "bg-accent text-accent-fg" : "bg-accent-soft text-accent")}>
                {e.name.split(" ").filter(Boolean).slice(-2).map((p) => p[0]).join("").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{e.name}</p>
                <p className="text-sm text-muted">{e.title} · {e.dept}</p>
                <p className="mt-1 text-xs text-faint">{e.username} · {centerName(e.center)}</p>
                {e.phone && <p className="mt-0.5 text-xs text-faint">📱 {e.phone}</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">{e.role}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">{e.status}</span>
                </div>
                {isAdmin && (
                  <div className="mt-2 flex gap-1">
                    <button type="button" onClick={() => openEdit(e)} className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:bg-surface-2">Sửa</button>
                    <button type="button" onClick={() => handleDelete(e)} className="rounded-lg border border-line px-2 py-1 text-xs text-danger hover:bg-danger/10">Xóa</button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form modal */}
      <EmployeeForm open={formOpen} editing={editing} onClose={() => { setFormOpen(false); setEditing(null); }} onSaved={refreshEmployees} />
    </div>
  );
}
