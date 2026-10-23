/**
 * Catalog module — employee/center lookups now delegate to the Zustand store
 * (which loads from DB via server functions). Static reference data (guides,
 * reports, docs) stays here.
 */
import type { Employee } from "./types";
import { useAppStore } from "./store";
import { isAdminRole as _isAdminRole, isApprovedEmployeeEmail as _isApprovedEmployeeEmail } from "./employee-data";

// Re-export pure functions (no store dependency)
export const isAdminRole = _isAdminRole;
export const isApprovedEmployeeEmail = _isApprovedEmployeeEmail;

export const APP_NAME = "EC-HOLDINGS";
export const APP_TAGLINE = "Hệ thống điều hành EC-HOLDINGS";
export const COMPANY = "Công ty EC-HOLDINGS";
export const SUPPORT_PHONE = "0975 109 612";
export const SUPPORT_ALT = "0948 80 96 96";

export const ORGANIZATION = {
  id: "11111111-1111-1111-1111-111111111111",
  name: APP_NAME,
  legalName: COMPANY,
  slug: "giong-vn",
  country: "VN",
  status: "active",
} as const;

export const ROLE_DEFINITIONS = [
  { key: "super_admin", label: "Super Admin", description: "Toàn quyền quản trị hệ thống" },
  { key: "admin", label: "Admin", description: "Quản trị cấp doanh nghiệp" },
  { key: "regional_manager", label: "Regional Manager", description: "Quản lý khu vực / đa trung tâm" },
  { key: "center_manager", label: "Center Manager", description: "Quản lý trung tâm" },
  { key: "hr", label: "HR", description: "Nhân sự" },
  { key: "accountant", label: "Accountant", description: "Kế toán" },
  { key: "staff", label: "Staff", description: "Nhân viên vận hành" },
] as const;

// ── Employee lookups (delegate to store) ──────────────────────────────────────

/** Get all employees from store. */
export function getEmployees(): Employee[] {
  return useAppStore.getState().employees;
}

/** Live reference to employees array from store. */
export const EMPLOYEES: Employee[] = new Proxy([] as Employee[], {
  get(_, prop) {
    const emps = useAppStore.getState().employees;
    if (prop === Symbol.iterator) return emps[Symbol.iterator].bind(emps);
    if (typeof prop === "string" && !Number.isNaN(Number(prop))) return emps[Number(prop)];
    return (emps as any)[prop];
  },
});

/** Lookup employee by ID (UUID). */
export function getEmployeeById(id: string): Employee | null {
  return useAppStore.getState().employees.find((e) => e.id === id) ?? null;
}

/** Lookup employee by username. */
export function getEmployeeByUsername(username: string): Employee | null {
  const value = username.trim().toLowerCase();
  return useAppStore.getState().employees.find((e) => e.username.toLowerCase() === value) ?? null;
}

/** Lookup employee by name. */
export function getEmployeeByName(name: string): Employee | null {
  const value = name.trim().toLowerCase();
  return useAppStore.getState().employees.find((e) => e.name.toLowerCase() === value) ?? null;
}

/** Lookup employee by email (falls back to username match). */
export function getEmployeeByEmail(email: string): Employee | null {
  const value = (email ?? "").trim().toLowerCase();
  if (!value) return null;
  const emps = useAppStore.getState().employees;
  return (
    emps.find((e) => (e.email ?? "").trim().toLowerCase() === value) ??
    emps.find((e) => (e.username ?? "").trim().toLowerCase() === value) ??
    null
  );
}



/** Normalize text for fuzzy matching (remove diacritics, lowercase). */
export function normalizePersonKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Fuzzy employee lookup by name/username/email. */
export function findEmployeeByLooseText(value: string): Employee | null {
  const raw = value ?? "";
  const key = normalizePersonKey(raw);
  if (!key) return null;

  const emps = useAppStore.getState().employees;
  return (
    emps.find((e) => normalizePersonKey(e.name) === key) ??
    emps.find((e) => normalizePersonKey(e.username) === key) ??
    emps.find((e) => normalizePersonKey(e.email) === key) ??
    emps.find((e) => normalizePersonKey(e.name).includes(key) || key.includes(normalizePersonKey(e.name))) ??
    emps.find((e) => normalizePersonKey(e.username).includes(key) || key.includes(normalizePersonKey(e.username))) ??
    null
  );
}



/** Can actor view target's records? */
export function canViewEmployeeRecords(actor: Employee | null, target: Employee | null): boolean {
  if (!actor || !target) return false;
  if (isAdminRole(actor.role)) return true;
  if (actor.id === target.id) return true;
  return actor.center === target.center;
}

/** Get center codes the actor can see. */
export function getVisibleCenterCodes(actor: Employee | null): string[] {
  if (!actor) return [];
  if (isAdminRole(actor.role)) {
    return useAppStore.getState().centers.map((c) => c.code);
  }
  return [actor.center];
}

// ── Center lookups (delegate to store) ────────────────────────────────────────

/** Get all centers from store. */
export function getCenters() {
  return useAppStore.getState().centers;
}

/** Live reference to centers array from store. */
export const CENTERS = new Proxy([] as { code: string; name: string; short: string; city: string; kind: "Trung tâm" | "Văn phòng" }[], {
  get(_, prop) {
    const ctrs = useAppStore.getState().centers;
    if (prop === Symbol.iterator) return ctrs[Symbol.iterator].bind(ctrs);
    if (typeof prop === "string" && !Number.isNaN(Number(prop))) return ctrs[Number(prop)];
    return (ctrs as any)[prop];
  },
  // Array.prototype.filter/reduce/every... use HasProperty on each index.
  // Without a 'has' trap the proxy falls back to the EMPTY array target,
  // so every index looks like a hole → filter() returns [] (dropdown trống).
  has(_, prop) {
    return prop in useAppStore.getState().centers;
  },
});

/** Center code → display name. */
export function centerName(code: string): string {
  const ctrs = useAppStore.getState().centers;
  return ctrs.find((c) => c.code === code)?.short ?? code;
}

/** Lookup center by code. */
export function getCenterByCode(code: string) {
  return useAppStore.getState().centers.find((c) => c.code === code) ?? null;
}

/** Staff count per center. */
export function getStaffByCenter(): Record<string, number> {
  const emps = useAppStore.getState().employees;
  const result: Record<string, number> = {};
  for (const e of emps) {
    result[e.center] = (result[e.center] ?? 0) + 1;
  }
  return result;
}

/** Live staff count per center from store. */
export const STAFF_BY_CENTER = new Proxy({} as Record<string, number>, {
  get(_, prop) {
    if (typeof prop === "string") return getStaffByCenter()[prop] ?? 0;
    return undefined;
  },
});

// ── Static reference data (unchanged) ────────────────────────────────────────

export const CURRENT_USER_ID = "e0000000-0000-0000-0000-000000000003"; // Phạm Kiên Cường UUID

export const PROPOSAL_SEED: import("./types").Proposal[] = [];

export const CHAT_SEED: import("./types").ChatMessage[] = [];

export const GUIDES = [
  {
    id: "GT001",
    title: "Giới thiệu phần mềm",
    body: "EC-HOLDINGS là hệ thống điều hành Công ty EC-HOLDINGS — dùng được trên máy tính, trình duyệt, iPhone và Android. Ứng dụng gom chấm công, nhiệm vụ và đề nghị về một dashboard.",
  },
  {
    id: "GT003",
    title: "Đăng ký và phân quyền",
    body: "Nhân sự mới nhận link hoặc mã QR, chọn máy tính hoặc điện thoại rồi đăng ký. Nhân sự cũ dùng tài khoản đã cấp. SuperAdmin quản trị hệ thống, Admin là ban giám đốc, User là các phòng ban: kế toán, tài chính, kinh doanh, pháp chế, HCNS, marketing.",
  },
  {
    id: "GT004",
    title: "Chấm công hàng ngày",
    body: "Vào ca lúc bắt đầu làm việc, tan ca khi xong việc. Cần ảnh chân dung và định vị. Mỗi ngày chỉ hai lần: vào và ra. Nghỉ, đi muộn, về sớm, tăng ca ngày thường / cuối tuần / lễ phải được Admin duyệt qua đề nghị nhân sự mới tính lương.",
  },
  {
    id: "GT005",
    title: "Thông báo",
    body: "Admin lập thông báo triển khai công việc tới từng bộ phận. User chỉ đọc, không thêm-sửa-xóa.",
  },
  {
    id: "GT006",
    title: "Chat nội bộ",
    body: "Trao đổi cùng cấp, theo nhóm hoặc toàn hệ thống. Dữ liệu lưu lại để Admin đối chứng khi cần.",
  },
  {
    id: "GT007",
    title: "Hồ sơ — tài liệu",
    body: "Thêm và tra cứu hồ sơ công ty, phân theo đơn vị và bộ phận. Chỉ thêm mới và xem — không sửa, không xóa.",
  },
  {
    id: "GT008",
    title: "Thêm mới theo quyền",
    body: "Hệ thống lập kế hoạch tuần/tháng. Đề nghị nhân sự, thu chi, nhập xuất do nhân viên lập — quản lý phê duyệt, từ chối hoặc hủy. Ghi chú mở cho mọi người thêm, không sửa xóa.",
  },
  {
    id: "GT009",
    title: "Việc làm mỗi ngày",
    body: "1. Chấm công. 2. Kiểm tra kế hoạch cũ, lập kế hoạch mới. 3. Vào module nghiệp vụ theo chức danh. 4. Góp ý và ghi chú. Hỗ trợ Zalo/điện thoại 0975 109 612 hoặc 0948 80 96 96.",
  },
];

export const REPORTS = [
  { id: "bc1", name: "Bảng chấm công", desc: "Công vào/tan ca theo ngày, người, trung tâm", href: "/bao-cao/bang-cham-cong" },
  { id: "bc7", name: "Bảng Check-in", desc: "Lượt check-in vị trí theo ngày, người, trung tâm + bản đồ", href: "/bao-cao/bang-check-in" },
  { id: "bc2", name: "Báo cáo nhiệm vụ", desc: "Tiến độ kế hoạch theo người phụ trách", href: "/bao-cao/bang-nhiem-vu" },

  { id: "bc6", name: "Đề nghị — Đề xuất", desc: "Tổng hợp đề nghị theo người, loại, trạng thái, thời gian + xuất CSV", href: "/bao-cao/bang-de-nghi" },
  { id: "bc8", name: "Hồ sơ tài liệu", desc: "Tổng hợp hồ sơ theo loại, phòng ban, người tạo, thời gian + xuất CSV", href: "/bao-cao/bang-ho-so" },
];

export const DOCS = [
  { id: "hs1", name: "Quy chế chấm công & lương", dept: "HCNS", updated: "2026-07-12" },
  { id: "hs3", name: "Hồ sơ vay vốn VietinBank", dept: "Tài chính", updated: "2026-02-11" },

  { id: "hs5", name: "Nội quy Công ty EC-HOLDINGS", dept: "Ban giám đốc", updated: "2026-04-18" },
  { id: "hs6", name: "Hướng dẫn thu ngân tại điểm", dept: "Kế toán", updated: "2026-03-10" },
];
