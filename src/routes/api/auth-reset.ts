/**
 * Server function for password reset using createServerFn
 */

import { createServerFn } from "@tanstack/react-start";
import crypto from "crypto";
import { getSql } from "@/lib/db"
import { auth } from "@/lib/auth/server";

/**
 * Generate a random temporary password
 */
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const special = "!@#$%";
  let password = "";
  
  // Ensure at least one uppercase, one lowercase, one number, one special
  password += chars[Math.floor(Math.random() * 23)]; // uppercase
  password += chars[Math.floor(Math.random() * 23) + 23]; // lowercase
  password += chars[Math.floor(Math.random() * 10) + 46]; // number
  password += special[Math.floor(Math.random() * special.length)]; // special
  
  // Add more random characters
  for (let i = 0; i < 8; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}



/**
 * Send password reset - generates temporary password
 */
export const sendPasswordReset = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const { email } = data;
    
    // Find employee by email
    const emps = await sql<{ id: string; name: string; email: string }>`
      SELECT id, name, email FROM employees WHERE LOWER(email) = LOWER(${email}) AND status = 'active' LIMIT 1
    `;
    if (emps.length === 0) {
      throw new Error("Không tìm thấy tài khoản với email này");
    }
    const emp = emps[0];
    
    // Generate temporary password
    const tempPassword = generateTempPassword();
    
    // Use auth.api.signUpEmail — handles hashing correctly internally
    const { auth } = await import("@/lib/auth/server");
    try {
      await auth.api.signUpEmail({
        body: { name: emp.name, email: emp.email, password: tempPassword },
      });
    } catch (err: any) {
      // If user already exists, delete old account and recreate
      const msg = err?.message ?? String(err);
      if (msg.includes("already") || msg.includes("exist")) {
        // Delete old user + account completely, then recreate
        const existingUser = await sql<{ id: string }>`
          SELECT id FROM "user" WHERE LOWER(email) = LOWER(${email}) LIMIT 1
        `;
        if (existingUser.length > 0) {
          await sql`DELETE FROM "account" WHERE "userId" = ${existingUser[0].id}`;
          await sql`DELETE FROM "session" WHERE "userId" = ${existingUser[0].id}`;
          await sql`DELETE FROM "user" WHERE "id" = ${existingUser[0].id}`;
        }
        // Now create fresh
        await auth.api.signUpEmail({
          body: { name: emp.name, email: emp.email, password: tempPassword },
        });
      } else {
        throw new Error("Không thể tạo tài khoản: " + msg);
      }
    }
    
    console.log(`[Password Reset] User: ${emp.email}, Temp Password: ${tempPassword}`);
    
    return {
      success: true,
      tempPassword,
      message: `Mật khẩu tạm thời đã được tạo cho ${emp.name}`,
    };
  });
