import { Link, Navigate, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  ShoppingCart,
  StickyNote,
  Timer,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createSsoToken } from "@/routes/api/sso-token";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { ClientOnly } from "@/components/client-only";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { isAdminRole } from "@/lib/catalog";
import { getAllowedNavItems, getEffectiveModuleAccess, setAllModuleAccessFromServer } from "@/lib/permissions";
import { applyOsBadge, subscribePush } from "@/lib/push-client";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { UserButton } from "@/lib/auth/gates";
import { useAppStore, totalUnreadCount } from "@/lib/store";
import { formatLongDate, greetingVi } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; group?: string };

const VERSION_STORAGE_KEY = "giong-vina-version";
const DEFAULT_VERSION = "1.2.0";

/** Get app version from Vite env (injected from package.json version during build).
 * Falls back to localStorage-saved version if VITE_APP_VERSION is not set (old builds).
 * On first load with VITE_APP_VERSION, saves to localStorage for consistency.
 */
function getAppVersion() {
  if (typeof window === "undefined") {
    // Server-side / build time: use env var or default
    return import.meta.env.VITE_APP_VERSION ?? DEFAULT_VERSION;
  }

  // Client-side:
  const envVersion = import.meta.env.VITE_APP_VERSION;
  const saved = window.localStorage.getItem(VERSION_STORAGE_KEY);

  // If env version is set (new build), use it and sync to localStorage
  if (envVersion && envVersion !== saved) {
    window.localStorage.setItem(VERSION_STORAGE_KEY, envVersion);
    return envVersion;
  }

  // Fallback to saved version or default
  if (saved) {
    const parts = saved.split(".").map(Number);
    if (parts.length === 3 && !parts.some(Number.isNaN)) {
      return saved;
    }
  }

  return DEFAULT_VERSION;
}

const NAV: NavItem[] = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard, group: "Điều hành" },
  { to: "/cham-cong", label: "Chấm công", icon: Timer, group: "Vận hành" },
  { to: "/check-in", label: "Check-in", icon: MapPin, group: "Vận hành" },
  { to: "/nhiem-vu", label: "Nhiệm vụ", icon: ClipboardList, group: "Vận hành" },

  { to: "/de-nghi", label: "Đề nghị", icon: FileText, group: "Nghiệp vụ" },
  { to: "/nhan-su", label: "Nhân sự", icon: Users, group: "Danh mục" },
  { to: "/trung-tam", label: "Trung tâm", icon: Building2, group: "Danh mục" },
  { to: "/ho-so", label: "Hồ sơ", icon: FolderOpen, group: "Danh mục" },
  { to: "/bien-ban-hop", label: "Biên bản họp", icon: NotebookPen, group: "DỰ ÁN" },
  { to: "/zalo", label: "Zalo", icon: MessagesSquare, group: "DỰ ÁN" },
  { to: "/admin/approvals", label: "Duyệt đăng ký", icon: ShieldCheck, group: "Quản trị" },
  { to: "/admin/permissions", label: "Phân quyền", icon: ShieldCheck, group: "Quản trị" },
  { to: "/bao-cao", label: "Báo cáo", icon: BarChart3, group: "Hệ thống" },
  { to: "/ghi-chu", label: "Ghi chú", icon: StickyNote, group: "Hệ thống" },
  { to: "/chat", label: "Chat", icon: MessageSquare, group: "Hệ thống" },
  { to: "/huong-dan", label: "Hướng dẫn", icon: BookOpen, group: "Hệ thống" },
  { to: "/preview", label: "Preview Mobile", icon: Smartphone, group: "Hệ thống" },
];

const MOBILE_PRIMARY = ["/cham-cong", "/check-in", "/", "/chat", "/nhiem-vu"];

function NavLink({
  item,
  active,
  onClick,
  dark,
  collapsed = false,
  mobile = false,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
  dark?: boolean;
  collapsed?: boolean;
  mobile?: boolean;
}) {
  const Icon = item.icon;
  const navigate = useNavigate();
  // GĐ 74: badge tin nhắn chưa đọc trên icon Chat (sidebar + hamburger).
  // Selector đọc messages + currentUserId; _chatReadTick bump cũng chạy lại selector
  // (state change) → count cập nhật ngay sau markConversationRead.
  // Fix badge kẹt (2026-09-10): chỉ đếm hội thoại mở được trong UI — cần chatGroups
  // (nhóm mình là member) + employees (peer 1-1 còn tồn tại).
  const employees = useAppStore((s) => s.employees);
  const employeeIds = useMemo(() => new Set(employees.map((e) => e.id)), [employees]);
  const unreadBadge = useAppStore(
    (s) => (item.to === "/chat" ? totalUnreadCount(s.messages, s.currentUserId, s.chatGroups, employeeIds) : 0),
  );
  // GĐ B hệ sinh thái (2026-09-14): link NGOÀI (app con) — render <a> mở tab mới,
  // KHÔNG dùng <Link> nội bộ của router. Style khớp NavLink nhánh dark; không badge, không active.
  // SSO: bấm → lấy JWT 60s từ app tổng rồi mới mở ?sso=<token>; lỗi thì fallback
  // mở link thẳng (không chặn — app con vẫn vào được bằng đăng nhập riêng).
  const [ssoLoading, setSsoLoading] = useState(false);
  if (item.to.startsWith("http")) {
    const openWithSso = async () => {
      if (ssoLoading) return; // chặn double-click
      setSsoLoading(true);
      try {
        const res = await createSsoToken();
        window.open(res.ok && res.url ? res.url : item.to, "_blank", "noopener,noreferrer");
        if (!res.ok) toast.info("Mở app con trực tiếp (SSO chưa sẵn sàng: " + (res.error ?? "") + ")");
      } catch {
        window.open(item.to, "_blank", "noopener,noreferrer");
        toast.info("Mở app con trực tiếp (không lấy được token SSO)");
      } finally {
        setSsoLoading(false);
      }
    };
    return (
      <a
        href={item.to}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault(); // chặn mở href gốc — đi qua openWithSso
          void openWithSso();
          onClick?.();
        }}
        className={cn(
          "flex h-9 items-center rounded-lg font-medium transition-all duration-200",
          mobile ? "text-[16px]" : "text-[13px]",
          collapsed
            ? "w-full justify-center gap-0 px-0 group-hover:justify-start group-hover:gap-2.5 group-hover:px-2.5"
            : "justify-start gap-2.5 px-2.5",
          dark
            ? "bg-transparent text-forest-muted hover:bg-forest-fg/5 hover:text-forest-fg"
            : "text-muted hover:bg-surface-2 hover:text-ink",
        )}
      >
        <span className="relative shrink-0">
          <Icon className={cn("size-4", dark && active && "text-white", ssoLoading && "animate-pulse")} />
        </span>
        <span
          className={cn(
            "whitespace-nowrap transition-all duration-200",
            collapsed ? "w-0 overflow-hidden opacity-0 group-hover:w-auto group-hover:opacity-100" : "w-auto opacity-100",
          )}
        >
          {item.label}
        </span>
      </a>
    );
  }
  return (
    <Link
      to={item.to}
      onClick={(e) => {
        if (mobile) {
          e.preventDefault();
          const target = item.to;
          onClick?.();
          // Delay navigate to avoid Radix Dialog close animation interference
          requestAnimationFrame(() => navigate({ to: target }));
        } else {
          onClick?.();
        }
      }}
      className={cn(
        "flex h-9 items-center rounded-lg font-medium transition-all duration-200",
        mobile ? "text-[16px]" : "text-[13px]",
        // Thu hẹp: nút full vùng 32px + căn giữa → icon vào đúng giữa cột 44px;
        // hover mở rộng: trở lại căn trái + gap như cũ (yêu cầu Đại ca 2026-09-10)
        collapsed
          ? "w-full justify-center gap-0 px-0 group-hover:justify-start group-hover:gap-2.5 group-hover:px-2.5"
          : "justify-start gap-2.5 px-2.5",
        // Nền xanh accent CHỈ khi ACTIVE — module đang mở nền sáng + icon trắng (GĐ 64);
        // nút không hoạt động về nền trong suốt như ban đầu (Đại ca yêu cầu 2026-09-10)
        dark
          ? active
            ? "bg-accent text-white shadow-sm shadow-accent/40"
            : "bg-transparent text-forest-muted hover:bg-forest-fg/5 hover:text-forest-fg"
          : active
            ? "bg-accent-soft text-accent"
            : "text-muted hover:bg-surface-2 hover:text-ink",
      )}
    >
      <span className="relative shrink-0">
        <Icon className={cn("size-4", dark && active && "text-white")} />
        {unreadBadge > 0 && (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {/* Cap 6/6+ theo yêu cầu (2026-09-10) — trước đây 99+ */}
            {unreadBadge > 6 ? "6+" : unreadBadge}
          </span>
        )}
      </span>
      <span
        className={cn(
          "whitespace-nowrap transition-all duration-200",
          collapsed ? "w-0 overflow-hidden opacity-0 group-hover:w-auto group-hover:opacity-100" : "w-auto opacity-100",
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

function SidebarNav({ pathname, onNavigate, dark, collapsed = false, mobile = false, items = NAV }: { pathname: string; onNavigate?: () => void; dark?: boolean; collapsed?: boolean; mobile?: boolean; items?: NavItem[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of items) {
      const g = item.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    }
    return [...map.entries()];
  }, [items]);
  return (
    <nav className="flex flex-col gap-3 px-1.5 pb-6">
      {groups.map(([group, items]) => (
        <div key={group}>
          {group ? (
            <p
              className={cn(
                "mb-1 px-2 text-[10px] font-semibold tracking-[0.16em] uppercase text-left transition-all duration-200",
                dark ? "text-forest-muted/80" : "text-faint",
                collapsed ? "hidden" : "block",
              )}
            >
              {group}
            </p>
          ) : null}
          <div className="flex flex-col gap-0.5">
            {items.map((item) => (
              <NavLink
                key={item.to}
                item={item}
                active={item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)}
                onClick={onNavigate}
                dark={dark}
                collapsed={collapsed}
                mobile={mobile}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const hydrate = useAppStore((s) => s.hydrate);
  const setCurrentUserId = useAppStore((s) => s.setCurrentUserId);
  const userId = useAppStore((s) => s.currentUserId);
  const pending = useAppStore((s) => s.proposals.filter((p) => p.status === "Chờ duyệt").length);
  const { user: authUser, isPending } = useCurrentUserState();
  const [appVersion, setAppVersion] = useState(DEFAULT_VERSION);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Tăng lên khi overrides phân quyền từ DB về — buộc allowedPaths recompute.
  // `ready` chặn redirect sớm: chưa load xong phân quyền thì chưa kết luận.
  const [moduleAccessVersion, setModuleAccessVersion] = useState(0);
  const [moduleAccessReady, setModuleAccessReady] = useState(false);
  useEffect(() => {
    setAppVersion(getAppVersion());
  }, []);
  const employees = useAppStore((s) => s.employees);
  // GĐ 74: tổng tin nhắn chưa đọc — badge đỏ trên icon Chat bottom bar mobile.
  // _chatReadTick trong selector: markConversationRead bump counter → tính lại ngay.
  // Fix badge kẹt (2026-09-10): truyền chatGroups + employeeIds — chỉ đếm hội thoại
  // mở được trong UI (kênh đã xóa / nhóm giải tán / peer đã xóa không đếm).
  const mobileChatUnread = useAppStore((s) =>
    totalUnreadCount(s.messages, s.currentUserId, s.chatGroups, new Set(s.employees.map((e) => e.id))) +
      (s._chatReadTick ?? 0) - (s._chatReadTick ?? 0),
  );
  // GĐ 130: khối chào trong header cần đếm trung tâm (dòng "Điều hành chuỗi N trung tâm…")
  const centers = useAppStore((s) => s.centers);
  // Resolve current employee: ALWAYS use store userId (stable across server/client)
  // to avoid hydration mismatch. Auth email/name may differ between SSR and client.
  const byId = employees.find((e) => e.id === userId) ?? employees[0];
  const currentUserEmployee = byId;
  // isAdmin based ONLY on employee role (stable across server/client).
  // Removed authUser email fallback to prevent hydration mismatch.
  const isAdmin = isAdminRole(currentUserEmployee?.role);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // GĐ 100: badge icon màn hình chính — tổng (tin chat chưa đọc + đề nghị chờ duyệt),
  // cap 6 (badge OS không hiện được "6+"). Chạy khi app ĐANG mở; khi app đóng
  // service worker set badge từ Web Push (public/sw.js push handler).
  const osBadgeTotal = mobileChatUnread + pending;
  useEffect(() => {
    applyOsBadge(osBadgeTotal);
  }, [osBadgeTotal]);

  // GĐ 100: xin quyền thông báo + đăng ký push subscription 1 lần sau login
  // (badge + notification cả khi app đóng). Idempotent; no-op khi env chưa cấu hình.
  useEffect(() => {
    if (!authEnabled || !authUser || isPending) return;
    void subscribePush();
  }, [authEnabled, authUser, isPending]);

  // Phân quyền chia sẻ (module_access) — load từ DB để grant của Admin áp dụng
  // trên mọi thiết bị. Load riêng, fail không chặn app (giữ bản local mirror).
  // Sau khi server data về, recompute allowedPaths ở dưới sẽ phản ánh quyền mới.
  useEffect(() => {
    import("@/routes/api/employee-crud")
      .then(({ loadAllModuleAccess }) => loadAllModuleAccess())
      .then((rows) => {
        setAllModuleAccessFromServer(
          Object.fromEntries(
            (rows as Array<{ employee_id: string; modules: Record<string, boolean> }>).map(
              (r) => [r.employee_id, r.modules ?? {}],
            ),
          ),
        );
        setModuleAccessVersion((v) => v + 1);
        setModuleAccessReady(true);
      })
      .catch(() => {
        // Migration 0017 chưa chạy / DB lỗi — giữ bản local mirror.
        setModuleAccessReady(true);
      });
  }, []);

  // iOS standalone PWA doesn't support pull-to-refresh.
  // Re-hydrate data when app returns to foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setIsRefreshing(true);
        hydrate();
        setTimeout(() => setIsRefreshing(false), 1500);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    // Also handle iOS bfcache (pageshow)
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [hydrate]);

  useEffect(() => {
    if (!authEnabled || !authUser) return;
    // Find employees matching email — prefer Admin role when duplicates exist
    const emailMatches = employees.filter((e) => e.email === (authUser.primaryEmail ?? ""));
    const nameMatches = emailMatches.length === 0
      ? employees.filter((e) => e.name === (authUser.displayName ?? ""))
      : [];
    const candidates = [...emailMatches, ...nameMatches];
    // Prefer admin role, then any match
    const mapped = candidates.find((e) => isAdminRole(e.role)) ?? candidates[0];
    if (mapped) setCurrentUserId(mapped.id);
  }, [authUser, setCurrentUserId, employees]);

  const allowedPaths = useMemo(
    () => getAllowedNavItems(currentUserEmployee),
    // moduleAccessVersion: overrides từ DB về là lúc nav cần tính lại.
    [currentUserEmployee, moduleAccessVersion],
  );

  // GĐ B hệ sinh thái: nút app con (link http) hiện theo quyền module riêng
  // ('banhang' — default TẮT, anh bật từng người trong Phân quyền; Admin luôn thấy)
  const hasBanhang = useAppStore((s) => {
    const emp = s.employees.find((e) => e.id === s.currentUserId) ?? null;
    return isAdminRole(emp?.role) || getEffectiveModuleAccess(emp, "banhang");
  });
  // GĐ 315: 2 module DỰ ÁN nội bộ mới — route nội bộ, CHỈ Admin thấy
  // (không thuộc hệ thống phân quyền module — gộp điều kiện isAdmin như Bán hàng).
  const PROJECT_INTERNAL_PATHS = ["/bien-ban-hop", "/zalo"];
  const visibleNav = useMemo(
    () =>
      NAV.filter(
        (item) =>
          allowedPaths.includes(item.to) ||
          item.to === "/preview" ||
          (item.to.startsWith("http") && hasBanhang) ||
          (isAdmin && PROJECT_INTERNAL_PATHS.includes(item.to)),
      ),
    [allowedPaths, hasBanhang, isAdmin],
  );

  const PUBLIC_ROUTES = ["/login", "/forgot-password"];
  // Phân quyền module (Báo cáo, Ghi chú…) điều khiển NAV + route access qua
  // getAllowedNavItems — không còn danh sách admin-only cứng nào ở đây.
  // /preview tự chặn non-admin bên trong trang (hiện thông báo, không redirect).
  const isRouteAllowed =
    PUBLIC_ROUTES.includes(pathname) ||
    pathname === "/api/auth/$" ||
    !authEnabled ||
    !authUser ||
    isAdmin ||
    pathname === "/" ||
    pathname === "/preview" ||
    // Mọi user đã đăng nhập đều được đổi mật khẩu riêng — route này không thuộc nav module
    pathname === "/change-password" ||
    // Chưa load xong phân quyền chia sẻ thì chưa redirect (tránh nháy về "/").
    !moduleAccessReady ||
    allowedPaths.includes(pathname) ||
    // Cho phép sub-route của module được cấp (vd /bao-cao/bang-cham-cong).
    allowedPaths.some((p) => p !== "/" && pathname.startsWith(p + "/"));

  if (authEnabled && !isPending && !authUser && !PUBLIC_ROUTES.includes(pathname)) {
    return <Navigate to="/login" replace />;
  }

  if (authEnabled && !isPending && authUser && !isRouteAllowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(28,107,88,0.08),_transparent_35%),var(--color-bg)]">
      {/* GĐ 140: class sidebar-desktop + app-content (sibling kế nhau) — CSS styles.css
          đẩy nội dung sang phải khi hover (mép dính mép, không che nội dung) */}
      <aside className="sidebar-desktop group fixed inset-y-0 left-0 z-30 hidden w-11 flex-col overflow-hidden bg-[linear-gradient(180deg,#12211c_0%,#1b2d26_100%)] text-forest-fg shadow-[12px_0_30px_-18px_rgba(18,33,28,0.9)] transition-all duration-300 ease-out hover:w-44 lg:flex">
        <div className="flex h-14 items-center border-b border-forest-fg/10 px-2 transition-all duration-300 group-hover:px-3">
          <Link to="/" className="text-forest-fg">
            <Logo compact className="group-hover:[&>span:last-child]:opacity-100" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <SidebarNav items={visibleNav} pathname={pathname} dark collapsed />
        </div>
        {/* Khối user — nền xanh accent đậm đồng nhất; w-fit + mx-auto để avatar
            VÀO GIỮA cột sidebar khi thu hẹp (44px = 12 + 8 + 24 khít), mở rộng thì full + chữ hiện */}
        <div className="border-t border-forest-fg/10 p-1.5 transition-all duration-300 group-hover:p-3">
          <div className="mx-auto flex w-fit items-center justify-center gap-1.5 rounded-xl bg-accent p-1 transition-all duration-300 group-hover:w-full group-hover:justify-start group-hover:p-1.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-[9px] font-semibold text-white shadow-sm shadow-black/20">
              {currentUserEmployee?.name
                .split(" ")
                .slice(-2)
                .map((p) => p[0])
                .join("")}
            </span>
            <div className="min-w-0 w-0 overflow-hidden transition-all duration-200 group-hover:w-auto group-hover:overflow-visible">
              <p className="truncate text-xs font-medium text-white">{currentUserEmployee?.name}</p>
              <p className="truncate text-[10px] text-white/70">{currentUserEmployee?.title}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-forest-fg/10 px-2 pb-3 pt-2 text-center text-[9px] tracking-[0.18em] text-forest-muted/85">
          VERSION {appVersion}
        </div>
      </aside>

      <div className="app-content lg:pl-11">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line/80 bg-bg/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface-2 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface-2 lg:hidden"
            onClick={() => {
              setIsRefreshing(true);
              hydrate();
              setTimeout(() => setIsRefreshing(false), 1500);
            }}
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw className={`size-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
          {/* GĐ 130 (chốt Đại ca 15/09/2026): khối chào Dashboard VÀO TRONG header —
              bên trái, cùng hàng với nút Đổi mật khẩu/Đăng xuất bên phải.
              GĐ 135 (yêu cầu 16/09): hiện ở MỌI trang — đồng nhất kiểu Tổng quan
              trên toàn app (đồng bộ GĐ C.15b app con).
              GĐ 195 (yêu cầu 21/09): ẨN trên MOBILE (<640px) — khoảng trống không đủ,
              chữ chèn đè nhau. Div cha giữ flex-1 làm spacer → nút phải vẫn canh phải. */}
          <div className="min-w-0 flex-1">
            <div className="hidden items-end justify-between gap-3 sm:flex">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase leading-none tracking-[0.16em] text-accent">Dashboard</p>
                  <h1 className="truncate text-lg font-semibold leading-tight tracking-tight text-ink sm:text-xl" suppressHydrationWarning>
                    {greetingVi()}, {currentUserEmployee?.name.split(" ").slice(-1)[0] ?? ""}
                  </h1>
                  <p className="hidden truncate text-xs leading-tight text-muted sm:block">
                    Điều hành Công ty EC-HOLDINGS.
                  </p>
                </div>
                <p className="hidden shrink-0 text-xs text-faint tabular sm:block" suppressHydrationWarning>
                  {formatLongDate()}
                </p>
              </div>
          </div>

          {authEnabled ? (
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-xl border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted sm:flex">
                <ShieldCheck className="size-3.5" />
                {isAdmin ? "Quản trị" : "Nhân sự"}
              </div>
              <ClientOnly fallback={<span className="h-8 w-8 rounded-full bg-black/10" />}>
                <UserButton />
              </ClientOnly>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden h-11 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-medium text-accent-fg shadow-sm shadow-accent/25 transition hover:bg-accent-hover sm:inline-flex"
            >
              <LogOut className="size-4" />
              Đăng nhập
            </Link>
          )}

          <Link
            to="/de-nghi"
            className="relative flex size-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface-2"
            aria-label="Thông báo"
          >
            <Bell className="size-5" />
            {pending > 0 ? (
              <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-danger-fg tabular">
                {pending}
              </span>
            ) : null}
          </Link>
        </header>

        <main className="px-4 pt-6 pb-28 sm:px-6 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        {visibleNav.filter((n) => MOBILE_PRIMARY.includes(n.to)).sort((a, b) => MOBILE_PRIMARY.indexOf(a.to) - MOBILE_PRIMARY.indexOf(b.to)).map((item) => {
          const Icon = item.icon;
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          // GĐ 74: badge chat — giá trị tính 1 lần ở AppShell body (hooks không được gọi trong map)
          const unreadBadge = item.to === "/chat" ? mobileChatUnread : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] font-medium",
                active ? "text-accent" : "text-muted",
              )}
            >
              <span className="relative">
                <Icon className="size-6" />
                {unreadBadge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                    {/* Cap 6/6+ theo yêu cầu (2026-09-10) — trước đây 99+ */}
                    {unreadBadge > 6 ? "6+" : unreadBadge}
                  </span>
                )}
              </span>
              {/* Chỉ nút đang mở mới hiện chữ — nút kia chỉ còn icon (yêu cầu Đại ca 2026-09-09) */}
              {active ? item.label : null}
            </Link>
          );
        })}
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="bg-forest p-0 text-forest-fg">
          <div className="flex h-16 items-center justify-between px-4">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Logo className="text-forest-fg" />
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-md text-forest-fg"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
            >
              <X className="size-5" />
            </button>
          </div>
          <SidebarNav items={visibleNav} pathname={pathname} onNavigate={() => setOpen(false)} dark mobile />
          {/* GĐ 101: VERSION cuối menu mobile — giống hệt khối VERSION sidebar desktop */}
          <div className="border-t border-forest-fg/10 px-2 pb-3 pt-2 text-center text-[9px] tracking-[0.18em] text-forest-muted/85">
            VERSION {appVersion}
          </div>
        </SheetContent>
      </Sheet>

      <ClientOnly fallback={null}>
        <Toaster position="top-center" richColors closeButton />
      </ClientOnly>
    </div>
  );
}
