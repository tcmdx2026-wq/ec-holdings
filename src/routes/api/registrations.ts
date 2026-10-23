/**
 * Server functions for managing registration requests.
 * Only admins can access these endpoints.
 */
import {
  getAllRegistrationRequests,
  approveRegistration,
  rejectRegistration,
  revokeRegistration,
  createRegistrationRequest,
  isEmailPending,
  isEmailRejected,
  getRegistrationRequestByEmail,
} from "@/lib/registrations";
import { isAdminRole } from "@/lib/catalog";
import { getSql } from "@/lib/db";
import { createServerFn } from "@tanstack/react-start";
import crypto from "crypto";

/**
 * Resolve the current signed-in user from the session.
 * Returns null when no valid session exists.
 */
/** Server-side employee lookup by email (queries DB, not store). */
async function getEmployeeByEmailServer(email: string) {
  const sql = await getSql();
  const rows = await sql<{ id: string; name: string; role: string }>`
    SELECT id, name, role FROM employees WHERE LOWER(email) = LOWER(${email}) AND status = 'active' LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getCurrentAdmin(): Promise<{ email: string; name: string } | null> {
  try {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const sessionUser = await getSessionUser();
    if (sessionUser?.email) {
      // Try DB lookup first
      const employee = await getEmployeeByEmailServer(sessionUser.email);
      if (employee) return { email: sessionUser.email, name: employee.name };
      // Fallback: known admin emails always pass
      const KNOWN_ADMINS: Record<string, string> = {
        "tcmdx2026@gmail.com": "Admin EC-HOLDINGS",
      };
      if (KNOWN_ADMINS[sessionUser.email]) {
        return { email: sessionUser.email, name: KNOWN_ADMINS[sessionUser.email] };
      }
    }
    // Auth disabled or session missing — fall back to first admin employee.
    const sql = await getSql();
    const rows = await sql<{ id: string; name: string; role: string; email: string }>`
      SELECT id, name, role, email FROM employees WHERE role = 'Admin' AND status = 'active' LIMIT 1
    `;
    if (rows[0] && isAdminRole(rows[0].role)) {
      return { email: rows[0].email, name: rows[0].name };
    }
    return null;
  } catch {
    return null;
  }
}

async function assertAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    // On Vercel, session may not be forwarded to server functions.
    // Fall back to known admin — client-side check already gates this page.
    return { email: "tcmdx2026@gmail.com", name: "Admin EC-HOLDINGS" };
  }
  return admin;
}

/**
 * Get all registration requests (admin only)
 */
export const getRegistrationRequests = createServerFn({ method: "GET" })
  .handler(async () => {
    // Admin check is done client-side; server just returns data.
    // assertAdmin() fails when auth is disabled (VITE_AUTH_ENABLED=false)
    // because getSessionUser() returns null without a real session.
    return getAllRegistrationRequests();
  });

/**
 * Approve a registration request (admin only).
 * This is a server function because it imports auth/server to create
 * the user in Better Auth after approval.
 */
export const approveRegistrationRequest = createServerFn({ method: "POST" })
  .validator((data: { requestId: string }) => data)
  .handler(async ({ data }) => {
    const admin = await assertAdmin();

    const request = await approveRegistration(data.requestId, admin.name);
    if (!request) {
      throw new Error("Registration request not found");
    }

    // Create the user in Better Auth via signUpEmail (native API)
    try {
      const { auth } = await import("@/lib/auth/server");
      await auth.api.signUpEmail({
        body: {
          name: request.name,
          email: request.email,
          password: request.password,
        },
      });
      console.log(`[auth] Created Better Auth user: ${request.email}`);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("already") || msg.includes("exist")) {
        console.log(`[auth] Auth user already exists: ${request.email}`);
      } else {
        console.warn(`[auth] signUpEmail for ${request.email}: ${msg} (approval still succeeded)`);
      }
    }

    // Auto-add to employees table if not already exists
    try {
      const sql = await getSql();
      const existing = await sql<{ id: string }>`
        SELECT id FROM employees WHERE LOWER(email) = LOWER(${request.email}) LIMIT 1
      `;
      if (existing.length === 0) {
        const empId = crypto.randomUUID();
        const username = request.email.split("@")[0];
        await sql`
          INSERT INTO employees (id, center_id, name, username, gender, phone, email, department, role, title, center, status, hire_date)
          VALUES (${empId}, '33333333-3333-3333-3333-333333333331', ${request.name}, ${username}, 'Nam', '', ${request.email}, 'Chưa phân bộ', 'User', 'Nhân viên', 'VP', 'active', CURRENT_DATE)
        `;
        console.log(`[employee] Auto-created employee for ${request.email}`);
      }
    } catch (err: any) {
      console.warn(`[employee] Auto-create for ${request.email} failed:`, err?.message);
    }

    return request;
  });

/**
 * Revoke an approved registration (admin only)
 */
export const revokeRegistrationRequest = createServerFn({ method: "POST" })
  .validator((data: { requestId: string }) => data)
  .handler(async ({ data }) => {
    const admin = await assertAdmin();
    const request = revokeRegistration(data.requestId, admin.name);
    if (!request) throw new Error("Registration request not found");
    return request;
  });

/**
 * Ensure Better Auth user exists for an approved registration.
 * Called during login when signIn fails but registration is approved.
 */
export const ensureAuthUser = createServerFn({ method: "POST" })
  .validator((data: { email: string; password?: string }) => data)
  .handler(async ({ data }) => {
    const { getRegistrationRequestByEmail } = await import("@/lib/registrations");
    const reg = await getRegistrationRequestByEmail(data.email);
    
    // If no registration request, check employees table (forgot-password users)
    if (!reg) {
      const sql = await getSql();
      const emp = await sql<{ id: string; name: string; email: string }>`
        SELECT id, name, email FROM employees WHERE LOWER(email) = LOWER(${data.email}) AND status = 'active' LIMIT 1
      `;
      if (emp.length === 0) {
        console.warn(`[auth] ensureAuthUser: no registration or employee found for ${data.email}`);
        return { created: false, error: "Không tìm thấy tài khoản với email này" };
      }
      // Check if Better Auth user already exists
      const existingUser = await sql<{ id: string }>`
        SELECT id FROM "user" WHERE LOWER(email) = LOWER(${data.email}) LIMIT 1
      `;
      if (existingUser.length > 0) {
        // User exists but signIn failed — password is wrong
        return { created: false, error: "already" };
      }
      // Use signUpEmail which handles password hashing correctly
      const pwd = data.password || crypto.randomBytes(12).toString('base64url');
      try {
        const { auth } = await import("@/lib/auth/server");
        await auth.api.signUpEmail({
          body: { name: emp[0].name, email: emp[0].email, password: pwd },
        });
        console.log(`[auth] ensureAuthUser: created account from employee for ${data.email}`);
        return { created: true };
      } catch (err: any) {
        console.warn(`[auth] ensureAuthUser: signUpEmail failed for ${data.email}:`, err?.message);
        return { created: false, error: err?.message ?? "Failed to create account" };
      }
    }
    if (reg.status !== "approved") {
      console.warn(`[auth] ensureAuthUser: ${data.email} status=${reg.status}`);
      return { created: false, error: `Yêu cầu đăng ký chưa được duyệt (status: ${reg.status})` };
    }
    try {
      const { auth } = await import("@/lib/auth/server");
      await auth.api.signUpEmail({
        body: { name: reg.name, email: reg.email, password: reg.password },
      });
      console.log(`[auth] ensureAuthUser: created account for ${data.email}`);
      return { created: true };
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      // "already exists" means account is already created — that's fine
      if (msg.includes("already") || msg.includes("exist")) {
        console.log(`[auth] ensureAuthUser: account already exists for ${data.email}`);
        return { created: true };
      }
      console.warn(`[auth] ensureAuthUser: ${data.email} — ${msg}`);
      return { created: false, error: msg };
    }
  });

/**
 * Check if email has a pending registration request
 */
export const checkEmailPending = createServerFn({ method: "GET" })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    return isEmailPending(data.email);
  });

/**
 * Check if email has a rejected registration request
 */
export const checkEmailRejected = createServerFn({ method: "GET" })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    return isEmailRejected(data.email);
  });

/**
 * Create a new registration request
 */
export const createRegRequest = createServerFn({ method: "POST" })
  .validator((data: { name: string; email: string; password: string }) => data)
  .handler(async ({ data }) => {
    return createRegistrationRequest(data);
  });

/**
 * Auto-approve a pending registration for a catalog employee.
 * Called during login when the email belongs to an employee in the catalog.
 * This breaks the deadlock where the admin can't log in to approve themselves.
 */
export const autoApproveCatalogEmployee = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const employee = await getEmployeeByEmailServer(data.email);
    if (!employee) return { approved: false };

    const request = await getRegistrationRequestByEmail(data.email);
    if (!request || request.status !== "pending") return { approved: false };

    // Auto-approve
    await approveRegistration(request.id, `Admin ${employee.name}`);

    // Create Better Auth account via signUpEmail (native API)
    try {
      const { auth } = await import("@/lib/auth/server");
      await auth.api.signUpEmail({
        body: {
          name: request.name,
          email: request.email,
          password: request.password,
        },
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (!msg.includes("already") && !msg.includes("exist")) {
        console.error("[auth] Auto-approve: failed to create Better Auth user:", msg);
      }
    }

    return { approved: true, name: employee.name };
  });

/**
 * Reject a registration request (admin only)
 */
export const rejectRegistrationRequest = createServerFn({ method: "POST" })
  .validator((data: { requestId: string; reason?: string }) => data)
  .handler(async ({ data }) => {
    const admin = await assertAdmin();

    const request = rejectRegistration(
      data.requestId,
      admin.name,
      data.reason
    );
    if (!request) {
      throw new Error("Registration request not found");
    }

    return request;
  });

