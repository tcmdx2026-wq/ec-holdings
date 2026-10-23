/**
 * Static employee data for auth checks and tests.
 * This file has NO store dependency — safe to import in test environments.
 * For dynamic lookups in the app, use catalog.ts (which delegates to store).
 */

/** Approved employee emails for auth gating. */
export const APPROVED_EMAILS = new Set([
  "tcmdx2026@gmail.com",
]);

/** Check if email is in the approved list (synchronous, no store). */
export function isApprovedEmployeeEmail(email: string | null | undefined): boolean {
  const value = (email ?? "").trim().toLowerCase();
  if (!value) return false;
  return APPROVED_EMAILS.has(value);
}

/** Admin role check (pure function, no store). */
export function isAdminRole(role?: string | null): boolean {
  const normalized = (role ?? "").trim().toLowerCase();
  return [
    "superadmin",
    "super_admin",
    "admin",
    "regional_manager",
    "center_manager",
  ].includes(normalized);
}
