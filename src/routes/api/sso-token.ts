/**
 * GĐ B hệ sinh thái (2026-09-14) — SSO JWT handoff sang app con
 *
 * App tổng ký JWT 60 giây chứa thông tin employee, app con verify bằng
 * APP_JWT_SECRET chung (set trên cả 2 project Vercel) rồi tự tạo phiên riêng.
 * 2 app KHÔNG chia sẻ cookie/domain — chỉ chia sẻ bí mật ký token.
 */

import { createServerFn } from "@tanstack/react-start";
import { SignJWT } from "jose";
import { getSql } from "@/lib/db";

export type SsoPayload = {
  /** employee id (bảng employees của app tổng) */
  empId: string;
  /** tên hiển thị */
  name: string;
  /** email Better Auth */
  email: string;
  /** vai trò (role) của employee */
  role: string;
  /** mã trung tâm */
  center: string;
};

export const createSsoToken = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ ok: boolean; token?: string; url?: string; error?: string }> => {
    try {
      // Session Better Auth — pattern GĐ 19 (bypass authConfigured)
      const { getRequest } = await import("@tanstack/react-start/server");
      const { auth } = await import("@/lib/auth/server");
      const request = getRequest();
      if (!request) return { ok: false, error: "Không tìm thấy request" };
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user) return { ok: false, error: "Vui lòng đăng nhập" };

      // Map auth user → employee (cùng logic app-shell.tsx: email trước, tên sau)
      const sql = await getSql();
      const email = session.user.email ?? "";
      const userName = session.user.name ?? "";
      const rows = await sql<{ id: string; name: string; role: string; center: string }>`
        SELECT id, name, COALESCE(role, 'User') as role, COALESCE(center, '') as center
        FROM employees
        WHERE lower(email) = lower(${email})
           OR (email = '' AND name = ${userName})
        ORDER BY CASE WHEN lower(email) = lower(${email}) THEN 0 ELSE 1 END, id
        LIMIT 1
      `;
      const emp = rows[0];
      if (!emp) return { ok: false, error: "Không tìm thấy nhân sự ứng với tài khoản" };

      const secret = process.env.APP_JWT_SECRET;
      if (!secret) {
        // Chưa set secret → báo lỗi rõ (nút sidebar sẽ fallback mở link thẳng)
        return { ok: false, error: "APP_JWT_SECRET chưa cấu hình" };
      }

      // GĐ 142 — nhét quyền nhóm Bán hàng vào payload: app con đọc `mods` từ
      // phiên (không cần DB riêng / đồng bộ 2 chiều). Nguồn sự thật = bảng
      // module_access DB dùng chung — đọc TRỰC TIẾP tại đây (KHÔNG dùng
      // getEmployeeById/getBanhangGroups — hàm đó đọc store phía client, luôn
      // rỗng trong server function).
      // GĐ 199 — mở rộng CHI TIẾT: 8 nhóm + TỪNG LÁ ("bh-leaf-<route>") từ
      // BH_GROUPS (banhang-catalog.ts) — nguồn cây duy nhất, nhóm/báo cáo mới
      // thêm vào catalog tự đi kèm JWT. JWT chỉ là FALLBACK — app con đọc LIVE
      // từ module_access chính là nguồn này (getBanhangDetailAccess cùng logic).
      const { BH_GROUPS, getBanhangDetailAccess } = await import("@/lib/banhang-catalog");
      const GROUP_KEYS = BH_GROUPS.map((g) => g.key);
      let mods: string[] = [];
      const isAdminRole = emp.role === "SuperAdmin" || emp.role === "Admin";
      if (isAdminRole) {
        mods = [...GROUP_KEYS];
        for (const g of BH_GROUPS) for (const l of g.leaves) mods.push(`bh-leaf-${l.to}`);
      } else {
        const accessRows = await sql<{ modules: Record<string, boolean> | null }>`
          SELECT modules FROM module_access WHERE employee_id = ${emp.id} LIMIT 1
        `;
        const modules = (accessRows[0]?.modules ?? {}) as Record<string, unknown>;
        if (modules.banhang === true) {
          const detail = getBanhangDetailAccess(emp.role, modules);
          mods = Object.entries(detail.groups).filter(([, ok]) => ok).map(([k]) => k);
          mods.push(...Object.entries(detail.leaves).filter(([, ok]) => ok).map(([k]) => k));
        }
      }

      const key = new TextEncoder().encode(secret);
      const token = await new SignJWT({
        empId: emp.id,
        name: emp.name,
        email,
        role: emp.role,
        center: emp.center,
        mods,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("60s") // handoff 60s — dư thời gian mở app con
        .setIssuer("giong-vn-v6")
        .setAudience("giong-banhang")
        .setSubject(emp.id)
        .sign(key);

      // PHẢI trỏ vào ROUTE xử lý SSO (verify + set cookie + redirect), không phải
      // trang chủ — trang chủ không đọc ?sso (bug phát hiện qua E2E 2026-09-14)
      // GĐ 228a (25/09 — test local theo quy tắc GĐ 228): URL app con theo env —
      // local .env.local ghi APP_CON_URL=http://localhost:3100 → nút Bán hàng mở
      // SSO local; production env Vercel ghi URL production → KHÔNG ĐỔI GÌ.
      const appConBase =
        (process.env.APP_CON_URL ?? "").trim() || "https://giong-banhang.vercel.app";
      const url = `${appConBase}/api/auth/sso?sso=${encodeURIComponent(token)}`;
      return { ok: true, token, url };
    } catch (err) {
      console.error("[createSsoToken]", err);
      return { ok: false, error: err instanceof Error ? err.message : "Lỗi không xác định" };
    }
  });
