/**
 * Phân quyền chi tiết cho từng chức năng theo role, bộ phận và quyền override của admin.
 *
 * Quy tắc mới:
 *   - Mọi nhân sự đều có quyền truy cập mặc định vào Chấm công, Check-in và Nhiệm vụ.
 *   - Các module còn lại được cấp theo nhóm liên quan / bộ phận.
 *   - Admin có thể ghi đè quyền cho từng user theo module bằng bảng quản lý phân quyền.
 */
import type { Employee } from "./types";
import { isAdminRole, getEmployeeById } from "./catalog";
import { BH_GROUPS, BH_GROUP_KEYS, getBanhangDetailAccess } from "./banhang-catalog";

export type Permission =
  | "dashboard:view"
  | "attendance:view_own"
  | "attendance:view_all"
  | "attendance:view_center"
  | "attendance:clock_in"
  | "attendance:clock_out"
  | "attendance:approve"
  | "tasks:view_own"
  | "tasks:view_all"
  | "tasks:create_own"
  | "tasks:create_any"
  | "tasks:edit_own"
  | "tasks:edit_any"
  | "tasks:delete"
  | "tasks:change_status"
  | "proposals:view_own"
  | "proposals:view_all"
  | "proposals:create"
  | "proposals:approve"
  | "proposals:reject"
  | "hr:view"
  | "hr:edit"
  | "centers:view"
  | "centers:edit"
  | "docs:view"
  | "reports:view"
  | "notes:view"
  | "notes:create"
  | "chat:view"
  | "chat:send"
  | "checkin:view_own"
  | "checkin:view_all"
  | "checkin:create";

export type ModuleKey =
  | "dashboard"
  | "attendance"
  | "checkin"
  | "tasks"
  | "proposals"
  | "hr"
  | "centers"
  | "documents"
  | "reports"
  | "notes"
  | "chat"
  | "guide"
  | "admin"
  | "preview"
  | "banhang" // GĐ B hệ sinh thái — app con Bán hàng (SSO handoff), default TẮT (chốt 2026-09-14)
  | "bienbanhop" // GĐ 315 — Biên bản họp (DỰ ÁN NỘI BỘ)
  | "zalo" // GĐ 315 — Zalo (DỰ ÁN NỘI BỘ)
  // GĐ 142 (16/09/2026) — phân quyền CHI TIẾT app Bán hàng theo nhóm bộ phận
  // (yêu cầu Đại ca: Kế toán/Kho/Marketing chỉ thấy nhóm của mình). Quyền chi tiết
  // đi kèm JWT SSO (mods) → app con đọc là có, KHÔNG cần DB riêng ở app con.
  | "banhang-misa" // nhóm MISA meInvoice (bảng kê hóa đơn đã sử dụng)
  | "banhang-banhang" // nhóm SMED - BÁN HÀNG (HĐĐT, DT đối tượng, DT chuỗi, BKCCN, BLTH)
  | "banhang-kho" // nhóm SMED - KHO (nhập kho, xuất kho, NXT kế toán)
  | "banhang-marketing"; // nhóm SMED - MARKETING (chiết khấu, lịch hẹn tiêm, gói tiêm đặt trước)
  // GĐ 199 (22/09/2026) — mở rộng phân quyền ĐẾN TỪNG LÁ (yêu cầu Đại ca: phân
  // quyền cho nhóm BÁO CÁO + UPLOAD - MISA AMIS, chi tiết đến bậc cuối; nhóm mới
  // thêm sau tự áp dụng qua BH_GROUPS trong banhang-catalog.ts). 4 nhóm mới dùng
  // prefix "bh-" (4 key cũ giữ nguyên — không vỡ quyền đang chạy). Quyền lá =
  // "bh-leaf-<route>" (key động, không khai báo ở union này).

export const MODULE_DEFINITIONS = [
  { key: "dashboard", label: "Tổng quan", paths: ["/"], group: "Điều hành" },
  { key: "attendance", label: "Chấm công", paths: ["/cham-cong"], group: "Vận hành" },
  { key: "checkin", label: "Check-in", paths: ["/check-in"], group: "Vận hành" },
  { key: "tasks", label: "Nhiệm vụ", paths: ["/nhiem-vu"], group: "Vận hành" },

  { key: "proposals", label: "Đề nghị", paths: ["/de-nghi"], group: "Nghiệp vụ" },
  { key: "hr", label: "Nhân sự", paths: ["/nhan-su"], group: "Danh mục" },
  { key: "centers", label: "Trung tâm", paths: ["/trung-tam"], group: "Danh mục" },
  { key: "documents", label: "Hồ sơ", paths: ["/ho-so"], group: "Danh mục" },
  { key: "reports", label: "Báo cáo", paths: ["/bao-cao"], group: "Hệ thống" },
  { key: "notes", label: "Ghi chú", paths: ["/ghi-chu"], group: "Hệ thống" },
  { key: "chat", label: "Chat", paths: ["/chat"], group: "Hệ thống" },
  { key: "guide", label: "Hướng dẫn", paths: ["/huong-dan"], group: "Hệ thống" },
  { key: "preview", label: "Preview Mobile", paths: ["/preview"], group: "Hệ thống" },
  { key: "admin", label: "Quản trị", paths: ["/admin/approvals", "/admin/permissions"], group: "Quản trị" },
  // GĐ B hệ sinh thái — app con KHÔNG có path nội bộ (link ngoài, bắt đầu http) →
  // getAllowedNavItems/route guard tự bỏ qua; Sidebar tự lọc qua getEffectiveModuleAccess("banhang")
  { key: "banhang", label: "Bán hàng (Dự án)", paths: [], group: "DỰ ÁN" },
  { key: "bienbanhop", label: "Biên bản họp", paths: ["/bien-ban-hop"], group: "DỰ ÁN" },
  { key: "zalo", label: "Zalo", paths: ["/zalo"], group: "DỰ ÁN" },
] as const;

/**
 * GĐ 142 — 4 quyền CHI TIẾT của app Bán hàng (KHÔNG nằm trong MODULE_DEFINITIONS:
 * không có path nội bộ, không thuộc route guard app tổng — chỉ dùng để (1) toggle
 * riêng trên trang Phân quyền, (2) nhét vào JWT SSO cho app con lọc menu/job).
 * Quyền nhóm nào BẬT → user thấy đúng nhóm module đó trong app con.
 */
export const BANHANG_GROUP_KEYS = [
  "banhang-misa",
  "banhang-banhang",
  "banhang-kho",
  "banhang-marketing",
] as const;

export type BanhangGroupKey = (typeof BANHANG_GROUP_KEYS)[number];

export const BANHANG_GROUP_LABELS: Record<BanhangGroupKey, string> = {
  "banhang-misa": "BH — MISA meInvoice",
  "banhang-banhang": "BH — SMED Bán hàng",
  "banhang-kho": "BH — SMED Kho",
  "banhang-marketing": "BH — SMED Marketing",
};

/**
 * GĐ 142 — quyền nhóm BÁN HÀNG hiệu lực của 1 employee:
 * Admin/SuperAdmin = đủ 4 nhóm; user thường = override trong module_access
 * (default TẤT CẢ 4 nhóm khi ĐÃ bật "banhang" — backward-compatible: ai đang
 * dùng app con không bị mất quyền; khi chưa bật banhang → không nhóm nào).
 */
export function getBanhangGroups(employee: Employee | null): Record<BanhangGroupKey, boolean> {
  const none = { "banhang-misa": false, "banhang-banhang": false, "banhang-kho": false, "banhang-marketing": false };
  if (!employee) return none;
  if (isAdminRole(employee.role)) {
    return { "banhang-misa": true, "banhang-banhang": true, "banhang-kho": true, "banhang-marketing": true };
  }
  const hasBanhang = getEffectiveModuleAccess(employee, "banhang");
  if (!hasBanhang) return none;
  const explicit = getUserModuleAccess(employee.id);
  // ĐÃ bật banhang mà chưa cấu hình nhóm nào → đủ 4 (backward-compatible GĐ 108)
  const anyConfigured = BANHANG_GROUP_KEYS.some((k) => k in explicit);
  if (!anyConfigured) {
    return { "banhang-misa": true, "banhang-banhang": true, "banhang-kho": true, "banhang-marketing": true };
  }
  return {
    "banhang-misa": explicit["banhang-misa"] === true,
    "banhang-banhang": explicit["banhang-banhang"] === true,
    "banhang-kho": explicit["banhang-kho"] === true,
    "banhang-marketing": explicit["banhang-marketing"] === true,
  };
}

export const MODULE_LABELS: Record<ModuleKey, string> = Object.fromEntries(
  MODULE_DEFINITIONS.map((module) => [module.key, module.label]),
) as Record<ModuleKey, string>;

/**
 * Phân quyền theo user — ĐỒNG BỘ GIỮA CÁC THIẾT BỊ.
 *
 * Nguồn sự thật là bảng `module_access` trên DB (migrations/0017), đọc qua
 * `loadAllModuleAccess()` khi store hydrate. Trước đây grant của Admin chỉ nằm
 * trong localStorage máy Admin → user ở máy khác không bao giờ nhận được.
 * `dbModuleAccess` giữ bản mirror của server trong memory; localStorage chỉ là
 * bản cuối cùng (offline fallback giữa các lần hydrate).
 */
const MODULE_ACCESS_STORAGE_KEY = "giong-vn-module-access";

type ModuleAccessMap = Partial<Record<ModuleKey, boolean>>;

let dbModuleAccess: Record<string, ModuleAccessMap> = {};
let dbModuleAccessSeeded = false;

function readMirror(): Record<string, ModuleAccessMap> {
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) return {};

  try {
    const raw = globalThis.localStorage.getItem(MODULE_ACCESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ModuleAccessMap>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMirror(value: Record<string, ModuleAccessMap>) {
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) return;

  try {
    globalThis.localStorage.setItem(MODULE_ACCESS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

function ensureSeeded() {
  if (dbModuleAccessSeeded) return;
  dbModuleAccessSeeded = true;
  // Đầu phiên: dùng bản server cuối cùng (offline fallback).
  for (const [id, map] of Object.entries(readMirror())) {
    dbModuleAccess[id] = map ?? {};
  }
}

/** Thay toàn bộ overrides bằng dữ liệu từ server (`loadAllModuleAccess`). */
export function setAllModuleAccessFromServer(map: Record<string, ModuleAccessMap>) {
  dbModuleAccess = {};
  for (const [id, modules] of Object.entries(map)) {
    dbModuleAccess[id] = modules ?? {};
  }
  dbModuleAccessSeeded = true;
  writeMirror(dbModuleAccess);
}

export function getUserModuleAccess(employeeId: string): ModuleAccessMap {
  if (!employeeId) return {};
  ensureSeeded();
  return dbModuleAccess[employeeId] ?? {};
}

/** Optimistic update tại máy — trang Phân quyền tự lưu DB qua `saveModuleAccess`.
 *  GĐ 199: nhận thêm key lá "bh-leaf-*" (string) — key động sinh từ BH_GROUPS. */
export function setUserModuleAccess(employeeId: string, moduleKey: ModuleKey | BanhangGroupKey | string, enabled: boolean) {
  if (!employeeId) return;
  ensureSeeded();
  const current = dbModuleAccess[employeeId] ?? {};
  dbModuleAccess[employeeId] = { ...current, [moduleKey]: enabled } as ModuleAccessMap;
  writeMirror(dbModuleAccess);
}

/** Xóa overrides (về mặc định) tại máy — trang Phân quyền tự lưu DB qua `clearModuleAccess`. */
export function resetUserModuleAccess(employeeId: string) {
  if (!employeeId) return;
  ensureSeeded();
  delete dbModuleAccess[employeeId];
  writeMirror(dbModuleAccess);
}/**
 * Quyền mặc định khi thêm nhân sự mới (GĐ 71 — chốt của Đại ca):
 * FULL QUYỀN mọi module trong bảng Phân quyền, TRỪ "Preview Mobile" (chỉ Admin).
 * "Phân quyền" + "Duyệt đăng ký" (nhóm admin) không nằm trong bảng này — mặc định
 * chỉ Admin role (xem getEffectiveModuleAccess + getAllowedNavItems).
 */
export function getDefaultModuleAccess(employee: Employee | null): ModuleAccessMap {
  const defaultMap: ModuleAccessMap = {
    dashboard: true,
    attendance: true,
    checkin: true,
    tasks: true,
    proposals: true,
    hr: true,
    centers: true,
    documents: true,
    reports: true,
    notes: true,
    chat: true,
    guide: true,
    preview: false, // Preview Mobile — chỉ Admin (chốt GĐ 71)
    banhang: false, // GĐ B hệ sinh thái — default TẮT, anh bật từng người trong Phân quyền (chốt 2026-09-14)
    bienbanhop: false, // GĐ 315 — default TẮT, bật từng người trong Phân quyền
    zalo: false, // GĐ 315 — default TẮT, bật từng người trong Phân quyền
  };

  if (!employee) return defaultMap;

  const isAdmin = isAdminRole(employee.role);

  if (isAdmin) {
    return {
      dashboard: true,
      attendance: true,
      checkin: true,
      tasks: true,	    proposals: true,
    hr: true,
      centers: true,
      documents: true,
      reports: true,
      notes: true,
      chat: true,
      guide: true,
      admin: true,
      preview: true,
      banhang: true,
      bienbanhop: true,
      zalo: true,
    };
  }

  return defaultMap;
}

export function getEffectiveModuleAccess(employee: Employee | null, moduleKey: ModuleKey): boolean {
  if (!employee) return false;
  if (isAdminRole(employee.role)) return true;

  const defaultMap = getDefaultModuleAccess(employee);
  const explicitMap = getUserModuleAccess(employee.id);
  return explicitMap[moduleKey] ?? defaultMap[moduleKey] ?? false;
}

export function getAllModuleAccess(employee: Employee | null): ModuleAccessMap {
  if (!employee) return {};
  const base = getDefaultModuleAccess(employee);
  const explicit = getUserModuleAccess(employee.id);
  const merged: ModuleAccessMap = { ...base };

  for (const key of Object.keys(explicit) as ModuleKey[]) {
    merged[key] = explicit[key] ?? merged[key];
  }

  return merged;
}

export function getPermissions(employee: Employee | null): Permission[] {
  if (!employee) return [];

  const effectiveModules = getAllModuleAccess(employee);
  const mappedPermissions: Permission[] = [];

  if (employee && isAdminRole(employee.role)) {
    return [
      "dashboard:view",
      "attendance:view_own",
      "attendance:view_all",
      "attendance:view_center",
      "attendance:clock_in",
      "attendance:clock_out",
      "attendance:approve",
      "tasks:view_own",
      "tasks:view_all",
      "tasks:create_own",
      "tasks:create_any",
      "tasks:edit_own",
      "tasks:edit_any",
      "tasks:delete",
      "tasks:change_status",
      "proposals:view_own",
      "proposals:view_all",
      "proposals:create",
      "proposals:approve",
      "proposals:reject",
      "hr:view",
      "hr:edit",
      "centers:view",
      "centers:edit",
      "docs:view",
      "reports:view",
      "notes:view",
      "notes:create",
      "chat:view",
      "chat:send",
      "checkin:view_own",
      "checkin:view_all",
      "checkin:create",
    ];
  }

  if (effectiveModules.dashboard) mappedPermissions.push("dashboard:view");
  if (effectiveModules.attendance) {
    mappedPermissions.push(
      "attendance:view_own",
      "attendance:view_center",
      "attendance:clock_in",
      "attendance:clock_out",
    );
  }
  if (effectiveModules.checkin) {
    mappedPermissions.push("checkin:view_own", "checkin:create");
  }
  if (effectiveModules.tasks) {
    mappedPermissions.push(
      "tasks:view_own",
      "tasks:create_own",
      "tasks:edit_own",
      "tasks:change_status",
    );
  }
  if (effectiveModules.proposals) {
    mappedPermissions.push("proposals:view_own", "proposals:create");
  }
  if (effectiveModules.hr) mappedPermissions.push("hr:view");
  if (effectiveModules.centers) mappedPermissions.push("centers:view");
  if (effectiveModules.documents) mappedPermissions.push("docs:view");
  if (effectiveModules.reports) mappedPermissions.push("reports:view");
  if (effectiveModules.notes) mappedPermissions.push("notes:view", "notes:create");
  if (effectiveModules.chat) mappedPermissions.push("chat:view", "chat:send");
  if (effectiveModules.guide) mappedPermissions.push("docs:view");

  return [...new Set(mappedPermissions)];
}

export function hasPermission(employee: Employee | null, permission: Permission): boolean {
  if (!employee) return false;
  const perms = getPermissions(employee);
  return perms.includes(permission);
}

export function canAccessEmployeeData(actor: Employee | null, targetId: string): boolean {
  if (!actor) return false;
  if (isAdminRole(actor.role)) return true;
  if (actor.id === targetId) return true;
  const target = getEmployeeById(targetId);
  if (target && target.center === actor.center) return true;
  return false;
}

export function canApproveProposals(employee: Employee | null): boolean {
  return hasPermission(employee, "proposals:approve");
}

export function canCreateTaskForOthers(employee: Employee | null): boolean {
  return hasPermission(employee, "tasks:create_any");
}

export function canEditTask(employee: Employee | null, taskCreatedBy: string): boolean {
  if (!employee) return false;
  if (isAdminRole(employee.role)) return true;
  if (employee.name === taskCreatedBy) return true;
  return false;
}

export function getAllowedNavItems(employee: Employee | null): string[] {
  if (!employee) return [];

  if (isAdminRole(employee.role)) {
    return Array.from(new Set(MODULE_DEFINITIONS.flatMap((module) => module.paths)));
  }

  const allowed = new Set<string>();
  for (const module of MODULE_DEFINITIONS) {
    if (module.key === "admin") continue;
    if (getEffectiveModuleAccess(employee, module.key)) {
      for (const path of module.paths) allowed.add(path);
    }
  }

  return [...allowed];
}

export function getPermissionLabel(permission: Permission): string {
  const labels: Record<Permission, string> = {
    "dashboard:view": "Xem tổng quan",
    "attendance:view_own": "Xem chấm công cá nhân",
    "attendance:view_all": "Xem chấm công toàn hệ thống",
    "attendance:view_center": "Xem chấm công trung tâm",
    "attendance:clock_in": "Điểm danh vào ca",
    "attendance:clock_out": "Điểm danh tan ca",
    "attendance:approve": "Duyệt chấm công",
    "tasks:view_own": "Xem nhiệm vụ cá nhân",
    "tasks:view_all": "Xem tất cả nhiệm vụ",
    "tasks:create_own": "Tạo nhiệm vụ cho bản thân",
    "tasks:create_any": "Tạo nhiệm vụ cho người khác",
    "tasks:edit_own": "Sửa nhiệm vụ cá nhân",
    "tasks:edit_any": "Sửa bất kỳ nhiệm vụ nào",
    "tasks:delete": "Xóa nhiệm vụ",
    "tasks:change_status": "Đổi trạng thái nhiệm vụ",
    "proposals:view_own": "Xem đề nghị cá nhân",
    "proposals:view_all": "Xem tất cả đề nghị",
    "proposals:create": "Tạo đề nghị",
    "proposals:approve": "Duyệt đề nghị",
    "proposals:reject": "Từ chối đề nghị",
    "hr:view": "Xem nhân sự",
    "hr:edit": "Sửa nhân sự",
    "centers:view": "Xem trung tâm",
    "centers:edit": "Sửa trung tâm",
    "docs:view": "Xem hồ sơ",
    "reports:view": "Xem báo cáo",
    "notes:view": "Xem ghi chú",
    "notes:create": "Tạo ghi chú",
    "chat:view": "Xem chat",
    "chat:send": "Gửi tin nhắn",
    "checkin:view_own": "Xem check-in cá nhân",
    "checkin:view_all": "Xem check-in toàn hệ thống",
    "checkin:create": "Tạo check-in",
  };
  return labels[permission] ?? permission;
}

// ============================================================
// GĐ 199 (2026-09-22) — QUYỀN CHI TIẾT app con: NHÓM + TỪNG LÁ
// Nguồn cây = BH_GROUPS (banhang-catalog.ts). Dùng ở app tổng:
// (1) trang Phân quyền render toggle 8 nhóm + chip từng lá;
// (2) sso-token ký thêm leafs vào JWT. App con đọc cùng bảng module_access.
// ============================================================

export type BanhangDetailAccess = ReturnType<typeof getBanhangDetailAccess>;

/** Quyền CHI TIẾT app con của employee (nhóm + lá) — phía app tổng (client).
 *  Logic backward-compat nằm trong getBanhangDetailAccess (catalog). */
export function getBanhangDetailForEmployee(employee: Employee | null): BanhangDetailAccess {
  if (!employee) return { groups: {}, leaves: {} };
  // getUserModuleAccess trả ModuleAccessMap (type chặt) — cast sang Record<string,
  // unknown> vì map trong DB chứa cả key lá "bh-leaf-*" không nằm trong ModuleKey.
  const modules = getUserModuleAccess(employee.id) as Record<string, unknown>;
  return getBanhangDetailAccess(employee.role, modules);
}

/** Danh sách nhóm + lá để render trang Phân quyền (nguồn = BH_GROUPS catalog).
 *  Nhóm/báo cáo MỚI thêm vào BH_GROUPS → tự xuất hiện trong trang Phân quyền. */
export function getBanhangCatalog() {
  return BH_GROUPS;
}

/** Mọi key nhóm (8) — dùng khi ký JWT SSO + đếm cấu hình. */
export function getBanhangAllGroupKeys(): string[] {
  return [...BH_GROUP_KEYS];
}
