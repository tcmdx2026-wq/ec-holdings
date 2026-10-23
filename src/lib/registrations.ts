/**
 * Registration requests store - manages pending user approvals using PostgreSQL.
 *
 * When a new user registers, their request is saved to the database with status "pending".
 * Admin can then approve or reject the request.
 * Only approved users can login to the system.
 */

import { getSql } from "./db";

export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface RegistrationRequest {
  id: string;
  name: string;
  email: string;
  password: string;
  department?: string;
  center?: string;
  status: RegistrationStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

/**
 * Create a new registration request
 */
export async function createRegistrationRequest(
  data: Omit<RegistrationRequest, "id" | "status" | "requestedAt">
): Promise<RegistrationRequest> {
  const sql = await getSql();
  const id = `REG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const requestedAt = new Date().toISOString();

  await sql`
    INSERT INTO registration_requests (id, name, email, password, department, center, status, requested_at)
    VALUES (${id}, ${data.name}, ${data.email}, ${data.password}, ${data.department || null}, ${data.center || null}, 'pending', ${requestedAt})
  `;

  return {
    id,
    name: data.name,
    email: data.email,
    password: data.password,
    department: data.department,
    center: data.center,
    status: "pending",
    requestedAt,
  };
}

/**
 * Get all registration requests (admin only)
 */
export async function getAllRegistrationRequests(): Promise<RegistrationRequest[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    email: string;
    password: string;
    department: string | null;
    center: string | null;
    status: string;
    requested_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    rejection_reason: string | null;
  }>`
    SELECT * FROM registration_requests ORDER BY requested_at DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    department: row.department || undefined,
    center: row.center || undefined,
    status: row.status as RegistrationStatus,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    rejectionReason: row.rejection_reason || undefined,
  }));
}

/**
 * Get pending registration requests
 */
export async function getPendingRequests(): Promise<RegistrationRequest[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    email: string;
    password: string;
    department: string | null;
    center: string | null;
    status: string;
    requested_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    rejection_reason: string | null;
  }>`
    SELECT * FROM registration_requests WHERE status = 'pending' ORDER BY requested_at DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    department: row.department || undefined,
    center: row.center || undefined,
    status: row.status as RegistrationStatus,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    rejectionReason: row.rejection_reason || undefined,
  }));
}

/**
 * Get registration request by ID
 */
export async function getRegistrationRequestById(
  id: string
): Promise<RegistrationRequest | null> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    email: string;
    password: string;
    department: string | null;
    center: string | null;
    status: string;
    requested_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    rejection_reason: string | null;
  }>`
    SELECT * FROM registration_requests WHERE id = ${id}
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    department: row.department || undefined,
    center: row.center || undefined,
    status: row.status as RegistrationStatus,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    rejectionReason: row.rejection_reason || undefined,
  };
}

/**
 * Get registration request by email
 */
export async function getRegistrationRequestByEmail(
  email: string
): Promise<RegistrationRequest | null> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    email: string;
    password: string;
    department: string | null;
    center: string | null;
    status: string;
    requested_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    rejection_reason: string | null;
  }>`
    SELECT * FROM registration_requests WHERE LOWER(email) = LOWER(${email})
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    department: row.department || undefined,
    center: row.center || undefined,
    status: row.status as RegistrationStatus,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    rejectionReason: row.rejection_reason || undefined,
  };
}

/**
 * Approve a registration request
 */
export async function approveRegistration(
  id: string,
  reviewedBy: string
): Promise<RegistrationRequest | null> {
  const sql = await getSql();
  const reviewedAt = new Date().toISOString();

  await sql`
    UPDATE registration_requests 
    SET status = 'approved', reviewed_at = ${reviewedAt}, reviewed_by = ${reviewedBy}
    WHERE id = ${id}
  `;

  return getRegistrationRequestById(id);
}

/**
 * Reject a registration request
 */
export async function rejectRegistration(
  id: string,
  reviewedBy: string,
  reason?: string
): Promise<RegistrationRequest | null> {
  const sql = await getSql();
  const reviewedAt = new Date().toISOString();

  await sql`
    UPDATE registration_requests 
    SET status = 'rejected', reviewed_at = ${reviewedAt}, reviewed_by = ${reviewedBy}, rejection_reason = ${reason || null}
    WHERE id = ${id}
  `;

  return getRegistrationRequestById(id);
}

/**
 * Check if an email has an approved registration
 */
export async function isEmailApproved(email: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ count: number }>`
    SELECT COUNT(*) as count FROM registration_requests 
    WHERE LOWER(email) = LOWER(${email}) AND status = 'approved'
  `;
  return rows[0].count > 0;
}

/**
 * Check if an email has a pending registration
 */
export async function isEmailPending(email: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ count: number }>`
    SELECT COUNT(*) as count FROM registration_requests 
    WHERE LOWER(email) = LOWER(${email}) AND status = 'pending'
  `;
  return rows[0].count > 0;
}

/**
 * Check if an email was rejected
 */
export async function isEmailRejected(email: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ count: number }>`
    SELECT COUNT(*) as count FROM registration_requests 
    WHERE LOWER(email) = LOWER(${email}) AND status = 'rejected'
  `;
  return rows[0].count > 0;
}

/**
 * Revoke an approved registration (set back to pending)
 */
export async function revokeRegistration(
  id: string,
  revokedBy: string
): Promise<RegistrationRequest | null> {
  const sql = await getSql();
  await sql`
    UPDATE registration_requests 
    SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL
    WHERE id = ${id}
  `;
  return getRegistrationRequestById(id);
}
