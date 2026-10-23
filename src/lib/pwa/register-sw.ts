/**
 * Service Worker registration with automatic update detection.
 * Import this in __root.tsx to enable PWA offline support.
 */

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      console.log("[PWA] Service Worker registered:", registration.scope);

      // Check for updates periodically
      setInterval(
        () => {
          registration.update();
        },
        60 * 60 * 1000
      ); // Every hour

      // Listen for updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        console.log("[PWA] New Service Worker installing...");

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              // New content available, notify user
              console.log("[PWA] New content available! Refresh to update.");
              showUpdateNotification();
            } else {
              // Content is cached for first time
              console.log("[PWA] Content cached for offline use.");
            }
          }
        });
      });
    } catch (error) {
      console.error("[PWA] Registration failed:", error);
    }
  });

  // Listen for controlling service worker changes
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    console.log("[PWA] New Service Worker activated. Refreshing...");
    window.location.reload();
  });
}

function showUpdateNotification() {
  // Create a simple update notification
  const toast = document.createElement("div");
  toast.id = "pwa-update-toast";
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #1b2d26;
    color: #e8f5e9;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid rgba(255,255,255,0.1);
  `;
  toast.innerHTML = `
    <span>Có nội dung mới!</span>
    <button onclick="window.location.reload()" style="
      background: #2e7d32;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    ">Cập nhật</button>
  `;
  document.body.appendChild(toast);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    toast.remove();
  }, 10000);
}
