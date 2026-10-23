/**
 * Web Push client (GĐ 100 — App Icon Badge).
 *
 * - subscribePush(): xin quyền thông báo → lấy public key từ server → đăng ký
 *   pushSubscription → lưu vào Neon (push_subscriptions).
 * - setOsBadge(n)/clearOsBadge(): Badging API — badge số trên icon PWA khi app
 *   ĐANG mở (iOS 16.4+/desktop). Android không hỗ trợ → no-op an toàn.
 * - BADGE_CAP = 6: quá 6 vẫn hiển thị 6 (badge OS không hiện được "6+").
 */
import {
  deletePushSubscription,
  getPushPublicKey,
  savePushSubscription,
} from "@/routes/api/push";
import { useAppStore } from "@/lib/store";

export const BADGE_CAP = 6;

/** Badge số trên icon PWA — tổng (chat chưa đọc + đề nghị chờ), cap 6. */
export function applyOsBadge(total: number) {
  try {
    const n = Math.max(0, Math.min(Math.floor(total) || 0, BADGE_CAP));
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (n > 0) void nav.setAppBadge?.(n)?.catch(() => {});
    else void nav.clearAppBadge?.()?.catch(() => {});
  } catch {
    // trình duyệt không hỗ trợ — bỏ qua
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Xin quyền thông báo + đăng ký subscription.
 * Trả về "granted" | "denied" | "unsupported" | "not-configured" | "error".
 * Gọi 1 lần sau login (app-shell useEffect) — idempotent, gọi lại không đôi.
 */
export async function subscribePush(): Promise<string> {
  try {
    if (typeof window === "undefined") return "unsupported";
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
    if (!("Notification" in window)) return "unsupported";

    // Chưa từng hỏi quyền → hỏi; đã deny → dừng im (không quấy rầy)
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      if (result !== "granted") return result;
    } else if (Notification.permission !== "granted") {
      return Notification.permission;
    }

    const { publicKey } = await getPushPublicKey();
    if (!publicKey) return "not-configured"; // chưa set env VAPID trên Vercel

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    let sub =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "error";

    const s = useAppStore.getState();
    const me = s.employees.find((e) => e.id === s.currentUserId);
    await savePushSubscription({
      data: {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        employeeId: s.currentUserId,
        employeeName: me?.name ?? s.currentName(),
        userAgent: navigator.userAgent.slice(0, 250),
      },
    });
    return "granted";
  } catch (err) {
    console.warn("[push] subscribePush failed:", err);
    return "error";
  }
}

/** Hủy subscription (đăng xuất — gọi nếu cần). */
export async function unsubscribePush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription({ data: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
  } catch {
    // ignore
  }
}
