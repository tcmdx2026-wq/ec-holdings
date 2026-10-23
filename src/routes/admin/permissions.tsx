import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDesc } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { isAdminRole } from "@/lib/catalog";
import { getDefaultModuleAccess, getUserModuleAccess, ModuleKey, MODULE_DEFINITIONS, setUserModuleAccess, resetUserModuleAccess, getBanhangGroups, getBanhangCatalog, getBanhangDetailForEmployee } from "@/lib/permissions";
import { saveModuleAccess, clearModuleAccess } from "@/routes/api/employee-crud";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/admin/permissions")({
  component: AdminPermissionsPage,
});

type ModulePermissionRow = {
  key: ModuleKey;
  label: string;
  defaultEnabled: boolean;
  userEnabled: boolean;
};

/** GĐ 142 — 4 toggle con của quyền "Bán hàng (Dự án)" (nhóm bộ phận app con)
 *  GĐ 199 — mở rộng thành 8 NHÓM (catalog) + TỪNG LÁ (chip trong nhóm) */
type BanhangGroupRow = {
  key: string; // BanhangGroupKey cũ + 4 key mới "bh-*" — nguồn: BH_GROUPS catalog
  label: string;
  enabled: boolean;
  /** Lá trong nhóm (route + nhãn) — chip toggle chi tiết đến bậc cuối */
  leaves: Array<{ to: string; label: string; enabled: boolean }>;
};

function AdminPermissionsPage() {
  const { user, isPending } = useCurrentUserState();
  const employees = useAppStore((s) => s.employees);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [moduleRows, setModuleRows] = useState<ModulePermissionRow[]>([]);
  const [banhangRows, setBanhangRows] = useState<BanhangGroupRow[]>([]);

  const byEmail = user ? employees.find((e) => e.email === (user.primaryEmail ?? "")) : null;
  const byName = user ? employees.find((e) => e.name === (user.displayName ?? "")) : null;
  const byId = employees.find((e) => e.id === currentUserId) ?? employees[0];
  const employee = byEmail ?? byName ?? byId;
  const isAdmin = (employee ? isAdminRole(employee.role) : false)
    // Fallback: known admin emails always pass even if employee lookup fails
    || user?.primaryEmail === "tcmdx2026@gmail.com"
    || user?.primaryEmail === "cuongpk.giong02@gmail.com";

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((person) => {
      const haystack = `${person.name} ${person.username} ${person.email} ${person.dept}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [search, employees]);

  useEffect(() => {
    if (!selectedEmployeeId && filteredEmployees[0]) {
      setSelectedEmployeeId(filteredEmployees[0].id);
    }
  }, [filteredEmployees, selectedEmployeeId]);

  useEffect(() => {
    const selected = employees.find((person) => person.id === selectedEmployeeId) ?? filteredEmployees[0];
    if (!selected) return;

    const defaultMap = getDefaultModuleAccess(selected);
    const overrideMap = getUserModuleAccess(selected.id);
    const nextRows: ModulePermissionRow[] = MODULE_DEFINITIONS.filter((module) => module.key !== "admin").map((module) => ({
      key: module.key,
      label: module.label,
      defaultEnabled: Boolean(defaultMap[module.key]),
      userEnabled: Boolean(overrideMap[module.key] ?? defaultMap[module.key]),
    }));

    setModuleRows(nextRows);

    // GĐ 142 — quyền nhóm Bán hàng của user được chọn (Admin = đủ 4; user thường
    // theo override; đã bật "banhang" mà chưa cấu hình nhóm nào → đủ 4)
    // GĐ 199 — nguồn cây = BH_GROUPS catalog: 8 nhóm (4 DOWNLOAD cũ + BÁO CÁO
    // KẾ TOÁN/KHO/MARKETING + UPLOAD - MISA AMIS) + TỪNG LÁ (chip chi tiết).
    const detail = getBanhangDetailForEmployee(selected);
    setBanhangRows(getBanhangCatalog().map((g) => ({
      key: g.key,
      label: g.label,
      enabled: detail.groups[g.key] === true,
      leaves: g.leaves.map((l) => ({
        to: l.to,
        label: l.label,
        enabled: detail.leaves[`bh-leaf-${l.to}`] === true,
      })),
    })));
  }, [selectedEmployeeId, employees, filteredEmployees]);

  // Wait for session to resolve
  if (isPending) return null;

  if (!user || !isAdmin) {
    return (
      <main className="container mx-auto py-6 px-4">
        <Card className="p-8 text-center">
          <p className="text-lg font-semibold text-ink">Bạn không phải là Admin nên không có quyền truy cập</p>
        </Card>
      </main>
    );
  }

  const selectedEmployee = employees.find((person) => person.id === selectedEmployeeId) ?? filteredEmployees[0];
  // GĐ 198 fix BUG GĐ 143 — khung 4 nhóm con của app Bán hàng chỉ hiện khi USER
  // ĐANG ĐƯỢC CHỌN là user thường (Admin/SuperAdmin luôn đủ 4 nhóm, không cần
  // cấu hình). Trước đây check !isAdmin (vai trò NGƯỜI ĐĂNG NHẬP) — trang này
  // chỉ Admin vào được → điều kiện luôn false → khung KHÔNG BAO GIỜ hiện →
  // Admin chưa bao giờ cấp được nhóm bộ phận qua UI (mọi user cấp "Bán hàng"
  // đều rơi nhánh đủ 4 nhóm). Test E2E user thường 22/09 bắt được.
  const selectedIsAdmin = selectedEmployee ? isAdminRole(selectedEmployee.role) : false;

  const updateModule = (moduleKey: ModuleKey, enabled: boolean) => {
    if (!selectedEmployee) return;

    // Optimistic update tại máy + LƯU XUỐNG DB để user ở thiết bị khác nhận được.
    setUserModuleAccess(selectedEmployee.id, moduleKey, enabled);
    setModuleRows((rows) =>
      rows.map((row) => (row.key === moduleKey ? { ...row, userEnabled: enabled } : row)),
    );
    const next = { ...getUserModuleAccess(selectedEmployee.id), [moduleKey]: enabled };
    saveModuleAccess(
      { data: { employeeId: selectedEmployee.id, modules: next as Record<string, boolean> } },
    )
      .then(() =>
        toast.success(`${selectedEmployee.name}: ${enabled ? "đã bật" : "đã tắt"} quyền ${MODULE_DEFINITIONS.find((item) => item.key === moduleKey)?.label ?? moduleKey}`),
      )
      .catch(() =>
        toast.error("Lưu phân quyền thất bại — kiểm tra mạng và thử lại"),
      );
  };

  // GĐ 199 — cập nhật NHÓM: bật nhóm = bật cả nhóm + XÓA mọi config lá của nhóm
  // (lá về "theo nhóm"); tắt nhóm = tắt nhóm + mọi lá theo nhóm (giữ config lá
  // trong DB để bật lại không mất). Bật nhóm con tự bật "banhang" (cửa vào app con).
  const updateBanhangGroup = (groupKey: string, enabled: boolean) => {
    if (!selectedEmployee) return;
    if (selectedIsAdmin) return; // user đang chọn là Admin/SuperAdmin → luôn đủ mọi nhóm, toggle vô nghĩa
    setUserModuleAccess(selectedEmployee.id, groupKey, enabled);
    setBanhangRows((rows) =>
      rows.map((r) =>
        r.key === groupKey
          ? { ...r, enabled, leaves: r.leaves.map((l) => ({ ...l, enabled })) }
          : r,
      ),
    );
    const current = { ...getUserModuleAccess(selectedEmployee.id) } as Record<string, boolean>;
    const group = getBanhangCatalog().find((g) => g.key === groupKey);
    const next: Record<string, boolean> = { ...current, [groupKey]: enabled, banhang: true };
    if (group) {
      for (const l of group.leaves) delete next[`bh-leaf-${l.to}`]; // lá về theo nhóm
    }
    saveModuleAccess(
      { data: { employeeId: selectedEmployee.id, modules: next as Record<string, boolean> } },
    )
      .then(() => toast.success(`${selectedEmployee.name}: ${enabled ? "đã bật" : "đã tắt"} nhóm ${group?.label ?? groupKey} (bao gồm ${group?.leaves.length ?? 0} module)`))
      .catch(() => toast.error("Lưu phân quyền thất bại — kiểm tra mạng và thử lại"));
  };

  // GĐ 199 — cập nhật TỪNG LÁ: bật 1 lá tự bật nhóm chứa nó (nhóm tắt → lá bật
  // không có tác dụng); tắt lá KHÔNG tắt nhóm (các lá khác trong nhóm vẫn bật).
  const updateBanhangLeaf = (groupKey: string, leafTo: string, enabled: boolean) => {
    if (!selectedEmployee) return;
    if (selectedIsAdmin) return;
    const leafKey = `bh-leaf-${leafTo}`;
    setUserModuleAccess(selectedEmployee.id, leafKey, enabled);
    setBanhangRows((rows) =>
      rows.map((r) => {
        if (r.key !== groupKey) return r;
        const leaves = r.leaves.map((l) => (l.to === leafTo ? { ...l, enabled } : l));
        // Bật lá khi nhóm đang tắt → nhóm tự bật (consistency)
        const groupOn = enabled ? true : r.enabled;
        return { ...r, enabled: groupOn, leaves };
      }),
    );
    const current = { ...getUserModuleAccess(selectedEmployee.id) } as Record<string, boolean>;
    const next: Record<string, boolean> = { ...current, [leafKey]: enabled, banhang: true };
    if (enabled) next[groupKey] = true; // bật lá → nhóm chứa nó phải bật
    saveModuleAccess(
      { data: { employeeId: selectedEmployee.id, modules: next as Record<string, boolean> } },
    )
      .then(() => {
        const group = getBanhangCatalog().find((g) => g.key === groupKey);
        const leafLabel = group?.leaves.find((l) => l.to === leafTo)?.label ?? leafTo;
        toast.success(`${selectedEmployee.name}: ${enabled ? "đã bật" : "đã tắt"} ${leafLabel}`);
      })
      .catch(() => toast.error("Lưu phân quyền thất bại — kiểm tra mạng và thử lại"));
  };

  const resetModules = () => {
    if (!selectedEmployee) return;
    resetUserModuleAccess(selectedEmployee.id);
    const defaultMap = getDefaultModuleAccess(selectedEmployee);
    setModuleRows((rows) =>
      rows.map((row) => ({
        ...row,
        userEnabled: Boolean(defaultMap[row.key]),
      })),
    );
    // GĐ 142: reset cả quyền nhóm Bán hàng (đi theo default của getBanhangGroups)
    const resetGroups = getBanhangGroups(selectedEmployee);
    // GĐ 199: reset cả quyền chi tiết 8 nhóm + lá (theo getBanhangDetailForEmployee)
    const resetDetail = getBanhangDetailForEmployee(selectedEmployee);
    setBanhangRows(getBanhangCatalog().map((g) => ({
      key: g.key,
      label: g.label,
      enabled: resetDetail.groups[g.key] === true,
      leaves: g.leaves.map((l) => ({
        to: l.to,
        label: l.label,
        enabled: resetDetail.leaves[`bh-leaf-${l.to}`] === true,
      })),
    })));
    clearModuleAccess({ data: { employeeId: selectedEmployee.id } })
      .then(() =>
        toast.success(`Đã reset quyền mặc định cho ${selectedEmployee.name}`),
      )
      .catch(() =>
        toast.error("Lưu phân quyền thất bại — kiểm tra mạng và thử lại"),
      );
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-ink">Phân quyền người dùng</h1>
        <p className="text-muted">Quản lý module truy cập cho từng nhân sự. Mọi người đều có quyền chấm công, check-in và nhiệm vụ.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Nhân sự</CardTitle>
            <CardDesc>Chọn người cần điều chỉnh quyền</CardDesc>
          </CardHeader>
          <div className="space-y-3 px-4 pb-4">
            <div>
              <Label htmlFor="search-user">Tìm nhân sự</Label>
              <Input
                id="search-user"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tên, email, bộ phận..."
                className="mt-2"
              />
            </div>
            <div className="max-h-[480px] space-y-1 overflow-y-auto pr-1">
              {filteredEmployees.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setSelectedEmployeeId(person.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                    selectedEmployee?.id === person.id
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-surface hover:border-accent/30"
                  }`}
                >
                  <div>
                    <div className="font-medium text-ink">{person.name}</div>
                    <div className="text-xs text-muted">{person.dept}</div>
                  </div>
                  <span className="rounded-full bg-surface-2 px-2 py-1 text-[10px] font-medium text-muted">
                    {person.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>{selectedEmployee?.name ?? "Chưa chọn"}</CardTitle>
              <CardDesc>
                {selectedEmployee?.dept ?? "-"} • {selectedEmployee?.center ?? "-"}
              </CardDesc>
            </div>
            <Button variant="outline" size="sm" onClick={resetModules}>
              Reset mặc định
            </Button>
          </CardHeader>

          <div className="space-y-3 px-4 pb-4">
            {moduleRows.map((row) => (
              <div key={row.key}>
                <div
                  className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-3 py-3"
                >
                  <div>
                    <div className="font-medium text-ink">{row.label}</div>
                    <div className="text-xs text-muted">
                      Mặc định: {row.defaultEnabled ? "Có" : "Không"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateModule(row.key, !row.userEnabled)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                      row.userEnabled ? "bg-accent" : "bg-slate-300"
                    }`}
                    aria-label={`Bật/tắt quyền ${row.label}`}
                  >
                    <span
                      className={`inline-block size-5 rounded-full bg-white shadow transition ${
                        row.userEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {/* GĐ 142 — 4 nhóm bộ phận của app Bán hàng (chỉ hiện khi "Bán hàng" bật
                    và user KHÔNG phải Admin — Admin luôn đủ mọi nhóm). Bật nhóm con tự
                    bật "banhang" (cửa vào app con). */}
                {/* GĐ 199 — mở rộng thành 8 NHÓM từ BH_GROUPS catalog + TỪNG LÁ
                    (chip chi tiết đến bậc cuối): nhóm bật → mọi lá trong nhóm bật;
                    bật/tắt lá riêng để thu hẹp trong nhóm; nhóm/báo cáo MỚI thêm vào
                    catalog tự xuất hiện ở đây. */}
                {row.key === "banhang" && row.userEnabled && !selectedIsAdmin ? (
                  <div className="mt-1.5 space-y-2 rounded-xl border border-dashed border-accent/30 bg-accent-soft/40 p-2">
                    <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Nhóm bộ phận trong app Bán hàng — bật nhóm = bật cả nhóm; bật/tắt từng module bên trong
                    </p>
                    {banhangRows.map((bh) => (
                      <div key={bh.key} className="rounded-lg bg-surface px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-ink">{bh.label}</span>
                          <button
                            type="button"
                            onClick={() => updateBanhangGroup(bh.key, !bh.enabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                              bh.enabled ? "bg-accent" : "bg-slate-300"
                            }`}
                            aria-label={`Bật/tắt nhóm ${bh.label}`}
                          >
                            <span
                              className={`inline-block size-4 rounded-full bg-white shadow transition ${
                                bh.enabled ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                        {/* Chip TỪNG LÁ — chi tiết đến bậc cuối (GĐ 199) */}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {bh.leaves.map((leaf) => (
                            <button
                              key={leaf.to}
                              type="button"
                              onClick={() => updateBanhangLeaf(bh.key, leaf.to, !leaf.enabled)}
                              className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                                leaf.enabled
                                  ? "border-accent/40 bg-accent/10 text-ink"
                                  : "border-line bg-surface-2 text-muted line-through decoration-slate-400/50"
                              }`}
                              title={`${leaf.enabled ? "Bấm để TẮT" : "Bấm để BẬT"}: ${leaf.label}`}
                            >
                              {leaf.enabled ? "✓ " : "✕ "}{leaf.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
