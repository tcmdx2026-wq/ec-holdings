/**
 * Employee table component — clean rewrite.
 * Shows employee list with edit/delete for Admin.
 *
 * Sticky UX (GĐ 58, yêu cầu Đại ca 2026-09-09 — áp dụng CẢ desktop + mobile):
 * Container bảng là khối GHIM (sticky top = header app + chiều cao khối lọc --ns-sticky-h)
 * với max-height = phần viewport còn lại → bảng cuộn NỘI BỘ, thead sticky top-0
 * trong container. Khối lọc ở nhan-su.tsx ghim trên nó (top-16).
 * KHÔNG dùng Card overflow-hidden — ancestor overflow phá sticky (lesson GĐ 56).
 */
import { Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { centerName } from "@/lib/catalog";
import type { Employee } from "@/lib/types";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(-2).map((p) => p[0]).join("").toUpperCase();
}

type Props = {
  employees: Employee[];
  isAdmin: boolean;
  onEdit: (e: Employee) => void;
  onDelete: (e: Employee) => void;
};

export function EmployeeTable({ employees, isAdmin, onEdit, onDelete }: Props) {
  if (employees.length === 0) {
    return <div className="py-12 text-center text-muted">Không tìm thấy nhân sự nào</div>;
  }

  return (
    <div className="sticky top-[calc(4rem+var(--ns-sticky-h,64px))] z-[5] max-h-[calc(100dvh-10.5rem-var(--ns-sticky-h,64px))] overflow-auto rounded-xl bg-surface shadow-[var(--shadow-card)] lg:max-h-[calc(100dvh-6rem-var(--ns-sticky-h,64px))]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-[5]">
          <tr className="border-b border-line bg-surface-2">
              <th className="px-4 py-3 text-left font-medium text-muted">#</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Họ tên</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Chức danh</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Bộ phận</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Đơn vị</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Tài khoản</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Liên hệ</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Quyền</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Trạng thái</th>
              {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {employees.map((e, i) => (
              <tr key={e.id} className="border-b border-line transition-colors hover:bg-surface-2/30">
                <td className="px-4 py-3 text-faint tabular">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      e.role === "Admin" || e.role === "SuperAdmin" ? "bg-accent text-accent-fg" : "bg-accent-soft text-accent",
                    )}>{initials(e.name)}</span>
                    <span className="font-medium text-ink">{e.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{e.title}</td>
                <td className="px-4 py-3 text-muted">{e.dept}</td>
                <td className="px-4 py-3 text-muted">{centerName(e.center)}</td>
                <td className="px-4 py-3 text-xs text-faint">{e.username}</td>
                <td className="px-4 py-3 text-xs text-faint">
                  {e.phone && <div>📱 {e.phone}</div>}
                  {e.email && <div className="truncate max-w-[180px]">✉️ {e.email}</div>}
                </td>
                <td className="px-4 py-3"><StatusBadge value={e.role} /></td>
                <td className="px-4 py-3"><StatusBadge value={e.status} /></td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => onEdit(e)} className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:bg-surface-2">
                        <Pencil className="inline size-3" />
                      </button>
                      <button type="button" onClick={() => onDelete(e)} className="rounded-lg border border-line px-2 py-1 text-xs text-danger hover:bg-danger/10">
                        <Trash2 className="inline size-3" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
