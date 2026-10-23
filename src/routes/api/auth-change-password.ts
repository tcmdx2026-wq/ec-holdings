/**
 * Server function for changing password
 */

import { createServerFn } from "@tanstack/react-start";
import { randomBytes, scrypt } from "node:crypto";
import { getSql } from "@/lib/db";

// Exact same config as Better Auth
const config = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64
};

function generateKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      config.dkLen,
      {
        N: config.N,
        r: config.r,
        p: config.p,
        maxmem: 128 * config.N * config.r * 2
      },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await generateKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const targetKey = await generateKey(password, salt);
  return targetKey.toString("hex") === key;
}

/**
 * Change password - requires current password verification
 */
export const changePassword = createServerFn({ method: "POST" })
  .validator((data: { currentPassword: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const { currentPassword, newPassword } = data;
    
    // Get session directly from Better Auth (bypasses authConfigured check)
    const { getRequest } = await import("@tanstack/react-start/server");
    const { auth } = await import("@/lib/auth/server");
    const request = getRequest();
    if (!request) throw new Error("Không tìm thấy request");
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) throw new Error("Vui lòng đăng nhập");
    const userId = session.user.id;
    
    // Get current account
    const accounts = await sql<{ id: string; password: string; providerId: string }>`
      SELECT id, password, "providerId" FROM account WHERE "userId" = ${userId} AND password IS NOT NULL
    `;
    
    if (accounts.length === 0) {
      throw new Error("Không tìm thấy tài khoản");
    }
    
    const account = accounts[0];
    
    // Verify current password
    const isValid = await verifyPassword(account.password, currentPassword);
    if (!isValid) {
      throw new Error("Mật khẩu hiện tại không đúng");
    }
    
    // Hash new password
    const newHash = await hashPassword(newPassword);
    
    // Update password
    await sql`
      UPDATE account SET password = ${newHash}, "updatedAt" = NOW() 
      WHERE id = ${account.id}
    `;
    
    return { success: true, message: "Đổi mật khẩu thành công" };
  });
