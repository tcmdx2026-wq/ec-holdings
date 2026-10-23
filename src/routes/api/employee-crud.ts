/**
 * Server functions for Employee & Center CRUD.
 * Single source of truth — replaces catalog-data.ts.
 */
import { getSql } from "@/lib/db";
import { createServerFn } from "@tanstack/react-start";

// ── Types ────────────────────────────────────────────────────────────────────

export type DbEmployee = {
  id: string;
  center_id: string;
  department: string;
  role: string;
  title: string;
  gender: string;
  phone: string;
  hire_date: string;
  status: string;
  catalog_id: string;
  name: string;
  email: string;
  username: string;
  center: string;
  auth_user_id: string | null;
};

export type DbCenter = {
  id: string;
  code: string;
  name: string;
  short_name: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  manager: string;
  note: string;
  status: string;
};

type EmployeeInput = {
  name: string;
  username: string;
  gender: string;
  phone: string;
  email: string;
  department: string;
  role: string;
  title: string;
  center: string;
};

// ── Catalog Queries (READ) ───────────────────────────────────────────────────

/** Load all active employees with center info. */
export const loadEmployees = createServerFn({ method: "GET" }).handler(
  async () => {
    const sql = await getSql();
    return sql<DbEmployee>`
      SELECT
        e.id,
        e.center_id,
        e.department,
        COALESCE(e.role, 'User') as role,
        e.title,
        e.gender,
        COALESCE(e.phone, '') as phone,
        COALESCE(e.hire_date::text, '') as hire_date,
        e.status,
        COALESCE(e.catalog_id, '') as catalog_id,
        COALESCE(e.name, '') as name,
        COALESCE(e.email, '') as email,
        COALESCE(e.username, '') as username,
        COALESCE(e.center, '') as center,
        e.auth_user_id
      FROM employees e
      WHERE e.status = 'active'
      ORDER BY e.department, e.name
    `;
  },
);

/** Load all active centers. */
export const loadCenters = createServerFn({ method: "GET" }).handler(
  async () => {
    const sql = await getSql();
    return sql<DbCenter>`
      SELECT
        id,
        code,
        name,
        short_name,
        city,
        COALESCE(district, '') as district,
        COALESCE(address, '') as address,
        COALESCE(phone, '') as phone,
        COALESCE(manager, '') as manager,
        COALESCE(note, '') as note,
        status
      FROM centers
      WHERE status = 'active'
      ORDER BY code
    `;
  },
);

// ── Employee CRUD (WRITE) ────────────────────────────────────────────────────

/** Insert a new employee. */
export const insertEmployee = createServerFn({ method: "POST" })
  .validator((data: EmployeeInput) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    // Resolve center code -> center UUID. center_id is NOT NULL FK to centers.
    const centers = await sql<{ id: string }>`
      SELECT id FROM centers WHERE code = ${data.center} LIMIT 1
    `;
    const centerId = centers[0]?.id ?? "33333333-3333-3333-3333-333333333331";
    await sql`
      INSERT INTO employees (id, center_id, name, username, gender, phone, email, department, role, title, center, status, hire_date)
      VALUES (${id}, ${centerId}, ${data.name}, ${data.username}, ${data.gender}, ${data.phone}, ${data.email}, ${data.department}, ${data.role}, ${data.title}, ${data.center}, 'active', CURRENT_DATE)
    `;
    return { id, ...data, status: "active" };
  });

/** Update an existing employee. */
export const updateEmployee = createServerFn({ method: "POST" })
  .validator((data: { id: string } & EmployeeInput) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    // Resolve center code -> center UUID so center_id stays consistent.
    const centers = await sql<{ id: string }>`
      SELECT id FROM centers WHERE code = ${data.center} LIMIT 1
    `;
    const centerId = centers[0]?.id ?? "33333333-3333-3333-3333-333333333331";
    await sql`
      UPDATE employees
      SET name = ${data.name}, username = ${data.username}, gender = ${data.gender},
          phone = ${data.phone}, email = ${data.email}, department = ${data.department},
          role = ${data.role}, title = ${data.title}, center = ${data.center}, center_id = ${centerId}
      WHERE id = ${data.id}
    `;
    return { success: true };
  });

/** Update a center's display + contact info (phone/manager/note — cột mới GĐ 87). */
export const updateCenter = createServerFn({ method: "POST" })
  .validator((data: { code: string; name: string; short_name: string; city: string; district: string; address: string; phone: string; manager: string; note: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      UPDATE centers
      SET name = ${data.name}, short_name = ${data.short_name}, city = ${data.city},
          district = ${data.district}, address = ${data.address},
          phone = ${data.phone}, manager = ${data.manager}, note = ${data.note}, updated_at = now()
      WHERE code = ${data.code}
    `;
    return { success: true };
  });

/** Soft-delete an employee. */
export const deleteEmployee = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`UPDATE employees SET status = 'inactive' WHERE id = ${data.id}`;
    return { success: true };
  });

/** Reset employee password via Better Auth. */
export const resetEmployeePassword = createServerFn({ method: "POST" })
  .validator((data: { email: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    // Find user in Better Auth tables
    const users = await sql<{ id: string }>`
      SELECT id FROM "user" WHERE email = ${data.email} LIMIT 1
    `;
    if (users.length === 0) {
      return { success: false, error: "User not found in auth" };
    }
    const userId = users[0].id;
    // Hash new password
    const { hashPassword } = await import("better-auth/crypto");
    const hashed = await hashPassword(data.newPassword);
    // Update or insert account
    const accounts = await sql<{ id: string }>`
      SELECT id FROM "account" WHERE "userId" = ${userId} AND "providerId" = 'email' LIMIT 1
    `;
    if (accounts.length > 0) {
      await sql`
        UPDATE "account" SET password = ${typeof hashed === 'string' ? hashed : JSON.stringify(hashed)}, "updatedAt" = NOW()
        WHERE id = ${accounts[0].id}
      `;
    } else {
      await sql`
        INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
        VALUES (${crypto.randomUUID()}, ${userId}, ${data.email}, 'email', ${typeof hashed === 'string' ? hashed : JSON.stringify(hashed)}, NOW(), NOW())
      `;
    }
    return { success: true };
  });

/** Sync all approved registrations → employees table + ensure Better Auth accounts. */
export const syncApprovedToEmployees = createServerFn({ method: "POST" })
  .handler(async () => {
    const sql = await getSql();
    // Get approved registrations with password for auth creation
    const approved = await sql<{ id: string; name: string; email: string; password: string }>`
      SELECT id, name, email, password FROM registration_requests WHERE status = 'approved'
    `;
    let created = 0;
    for (const reg of approved) {
      // 1. Create employee if not exists
      const existing = await sql<{ id: string }>`
        SELECT id FROM employees WHERE LOWER(email) = LOWER(${reg.email}) LIMIT 1
      `;
      if (existing.length === 0) {
        const empId = crypto.randomUUID();
        const username = reg.email.split("@")[0];
        await sql`
          INSERT INTO employees (id, center_id, name, username, gender, phone, email, department, role, title, center, status, hire_date)
          VALUES (${empId}, '33333333-3333-3333-3333-333333333331', ${reg.name}, ${username}, 'Nam', '', ${reg.email}, 'Chưa phân bộ', 'User', 'Nhân viên', 'VP', 'active', CURRENT_DATE)
        `;
        created++;
      }
      // 2. Ensure Better Auth account exists via signUpEmail
      try {
        const { auth } = await import("@/lib/auth/server");
        await auth.api.signUpEmail({
          body: { name: reg.name, email: reg.email, password: reg.password },
        });
        console.log(`[sync] Created Better Auth user: ${reg.email}`);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        // "already exists" is expected — user was already created
        if (msg.includes("already") || msg.includes("exist")) {
          console.log(`[sync] Auth user already exists: ${reg.email}`);
        } else {
          console.warn(`[sync] signUpEmail for ${reg.email}: ${msg}`);
        }
      }
    }
    return { total: approved.length, created };
  });

// ── Module Access (Phân quyền per-user overrides) ─────────────────────────────

/** Load every user's module overrides — shared across ALL devices. */
export const loadAllModuleAccess = createServerFn({ method: "GET" }).handler(
  async () => {
    const sql = await getSql();
    const rows = await sql<{ employee_id: string; modules: unknown }>`
      SELECT employee_id, modules FROM module_access
    `;
    // GĐ 197: sau GĐ 164 (GiondDB SQL Server), cột modules là NVARCHAR → trả về
    // CHUỖI (Neon/pg trước đây tự parse jsonb). Chuỗi đưa về client bị spread
    // thành key "0","1"... → ghi rác ngược DB. Chuẩn hóa ngay tại server.
    const parseModules = (raw: unknown): Record<string, boolean> => {
      let cur: unknown = raw;
      for (let i = 0; i < 3; i++) {
        if (typeof cur !== "string") break;
        try {
          cur = JSON.parse(cur);
        } catch {
          return {};
        }
      }
      return cur && typeof cur === "object" && !Array.isArray(cur)
        ? (cur as Record<string, boolean>)
        : {};
    };
    return rows.map((r) => ({ employee_id: r.employee_id, modules: parseModules(r.modules) }));
  },
);

/** Upsert one user's module overrides (Admin Phân quyền page). */
export const saveModuleAccess = createServerFn({ method: "POST" })
  .validator((data: { employeeId: string; modules: Record<string, boolean> }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    // GĐ 197: dọn rác key số ("0","1"...) sinh từ spread chuỗi — chỉ giữ boolean thật.
    const clean: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(data.modules)) {
      if (!/^\d+$/.test(k) && typeof v === "boolean") clean[k] = v;
    }
    await sql`
      INSERT INTO module_access (employee_id, modules, updated_at)
      VALUES (${data.employeeId}, ${JSON.stringify(clean)}::jsonb, now())
      ON CONFLICT (employee_id) DO UPDATE SET
        modules = EXCLUDED.modules,
        updated_at = now()
    `;
    return { success: true };
  });

/** Delete one user's overrides — back to role/department defaults. */
export const clearModuleAccess = createServerFn({ method: "POST" })
  .validator((data: { employeeId: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`DELETE FROM module_access WHERE employee_id = ${data.employeeId}`;
    return { success: true };
  });
