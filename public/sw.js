const CACHE_NAME = "giong-vn-v1";
// Bumped to v2: stale-while-revalidate strategy + cleanup of old v1 caches
const STATIC_CACHE = "giong-vn-static-v2";
const DYNAMIC_CACHE = "giong-vn-dynamic-v2";

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/offline",
  "/favicon.svg",
  "/giong-vina-logo.png",
  "/__grok/icon-180.png",
];

// Install: pre-cache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (name) =>
                name !== STATIC_CACHE &&
                name !== DYNAMIC_CACHE &&
                name !== CACHE_NAME
            )
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: implement caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith("http")) return;

  // API requests: network-only (no cache for auth/data)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: "Offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  // Static assets (CSS, JS, images): stale-while-revalidate
  // Serve the cached copy instantly, but ALWAYS re-fetch in the background
  // and update the cache — so new deployments reach devices without
  // requiring users to manually clear the browser cache.
  if (
    url.pathname.includes("/assets/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, clone);
              });
            }
            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (request.mode === "navigate") {
              return caches.match("/offline");
            }
            return new Response("", { status: 408 });
          });
        return cached || networkFetch;
      })
    );
    return;
  }

  // HTML pages: network-first with cache fallback
  if (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Fallback to offline page
            return caches.match("/offline");
          });
        })
    );
    return;
  }

  // Other requests: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response("", { status: 408 });
        });
      })
  );
});

// Listen for messages from the app
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});

// ── GĐ 100: Web Push — App Icon Badge "cả khi app đóng" ─────────────────────
// Server gửi payload JSON { unreadTotal, kind, title, body, url } qua VAPID.
// Badge icon: số 1→6, quá 6 vẫn hiển thị 6 (cap — Giống badge trong app GĐ 75).
// iOS PWA: badge chỉ hiện sau khi user cấp quyền thông báo; Android: hiện chấm
// thông báo (Badging API số KHÔNG được Chrome/Android hỗ trợ — MDN 8/2026).
self.addEventListener("push", (event) => {
  let data = null;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  if (!data) return;

  const unread = Number(data.unreadTotal) || 0;
  event.waitUntil(
    (async () => {
      // Badge số trên icon PWA (iOS 16.4+/desktop PWA) — quá 6 giữ nguyên 6
      const badgeCount = Math.min(unread > 0 ? Math.min(unread, 6) : 0, 6);
      try {
        if (badgeCount > 0 && self.navigator.setAppBadge) {
          await self.navigator.setAppBadge(badgeCount);
        } else if (badgeCount === 0 && self.navigator.clearAppBadge) {
          await self.navigator.clearAppBadge();
        }
      } catch {
        // Badge API không có trên Android — chấm thông báo tự hiện kèm notification
      }
      // Bắt buộc hiện notification khi nhận push (yêu cầu của Chrome + điều kiện
      // để badge iOS hoạt động). Bấm mở app đúng trang.
      if (unread > 0) {
        await self.registration.showNotification(data.title || "GIONG VIỆT NAM", {
          body: data.body || "",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-96.png",
          tag: data.kind || "giong-vn",
          data: { url: data.url || "/" },
        });
      }
    })(),
  );
});

// Bấm notification → mở/focus app đúng url trong payload
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              // trang không navigate được — giữ nguyên client hiện tại
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
