/**
 * Web Push server functions (GĐ 100 — App Icon Badge "Cả khi app đóng").
 *
 * Lưu/xóa push subscription per thiết bị + gửi push (badge count) tới mọi
 * thiết bị của nhân sự khi có tin chat mới / đề nghị chờ duyệt.
 *
 * Env bắt buộc (set trên Vercel):
 *   VAPID_PUBLIC_KEY  — khóa public cho PushSubscriptionOptions.userVisibleKey
 *   VAPID_PRIVATE_KEY — khóa private ký JWT (web-push library)
 *   VAPID_SUBJECT     — mailto liên hệ (VD: mailto:tcmdx2026@gmail.com)
 *
 * KHÔNG cấu hình env → các function trả giá trị rỗng/no-op an toàn (app vẫn chạy,
 * chỉ không có badge khi app đóng). Badge-when-open (Gói A) không phụ thuộc env này.
 */
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";

/** Đọc env VAPID — thiếu thì coi như chưa cấu hình (no-op). */
function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "mailto:tcmdx2026@gmail.com";
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey) };
}

/** Public key cho client subscribe (rỗng = chưa cấu hình → client bỏ qua). */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: vapidConfig().publicKey };
});

/** Lưu subscription mới / cập nhật employee của endpoint đã có (UPSERT). */
export const savePushSubscription = createServerFn({ method: "POST" })
  .validator(
    (data: {
      endpoint: string;
      p256dh: string;
      auth: string;
      employeeId: string;
      employeeName: string;
      userAgent?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = `ps_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    await sql`
      INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, employee_id, employee_name, user_agent)
      VALUES (${id}, ${data.endpoint}, ${data.p256dh}, ${data.auth}, ${data.employeeId}, ${data.employeeName}, ${data.userAgent ?? ""})
      ON CONFLICT (endpoint) DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        employee_id = EXCLUDED.employee_id,
        employee_name = EXCLUDED.employee_name,
        user_agent = EXCLUDED.user_agent,
        updated_at = now()
    `;
    return { ok: true };
  });

/** Xóa subscription (hết hạn 410 / unsubscribed). */
export const deletePushSubscription = createServerFn({ method: "POST" })
  .validator((data: { endpoint: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${data.endpoint}`;
    return { ok: true };
  });

type PushTarget = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function loadTargets(employeeIds: string[]): Promise<PushTarget[]> {
  if (employeeIds.length === 0) return [];
  const sql = await getSql();
  // interface Sql KHÔNG ghép SQL qua ${} — dùng ANY($1) với mảng tham số (GĐ 96)
  const rows = await sql.query<PushTarget & { employee_id: string }>(
    `SELECT id, endpoint, p256dh, auth, employee_id FROM push_subscriptions WHERE employee_id = ANY($1::text[])`,
    [employeeIds],
  );
  return rows;
}

/**
 * Gửi push badge tới mọi thiết bị của danh sách employeeIds.
 * payload: { unreadTotal, kind, title, body, url }
 * Endpoint 404/410 (hết hạn) → xóa khỏi DB.
 */
export const sendPushBadge = createServerFn({ method: "POST" })
  .validator(
    (data: {
      employeeIds: string[];
      unreadTotal: number;
      kind: "chat" | "proposal";
      title: string;
      body: string;
      url: string;
      excludeEndpoint?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const cfg = vapidConfig();
    if (!cfg.configured || data.employeeIds.length === 0) return { sent: 0, removed: 0 };

    const targets = await loadTargets(data.employeeIds);
    if (targets.length === 0) return { sent: 0, removed: 0 };

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

    const payload = JSON.stringify({
      unreadTotal: data.unreadTotal,
      kind: data.kind,
      title: data.title,
      body: data.body,
      url: data.url,
    });

    let sent = 0;
    const removed: string[] = [];
    await Promise.all(
      targets.map(async (t) => {
        if (t.endpoint === data.excludeEndpoint) return; // thiết bị đang mở app tự set badge local
        try {
          await webpush.sendNotification(
            { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
            payload,
            { TTL: 3600 },
          );
          sent += 1;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) removed.push(t.endpoint);
        }
      }),
    );
    if (removed.length > 0) {
      const sql = await getSql();
      await sql.query(`DELETE FROM push_subscriptions WHERE endpoint = ANY($1::text[])`, [removed]);
    }
    return { sent, removed: removed.length };
  });
