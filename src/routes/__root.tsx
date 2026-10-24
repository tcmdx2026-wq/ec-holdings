import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/app-shell";
import { registerServiceWorker } from "@/lib/pwa/register-sw";
import appCss from "../styles.css?url";

// Register Service Worker for PWA offline support
if (typeof window !== "undefined") {
  registerServiceWorker();
}

const APP_NAME = "EC-HOLDINGS";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#12211c" },
      {
        name: "description",
        content: "Hệ thống điều hành Công ty EC-HOLDINGS",
      },
    ],
    links: [
      // GĐ 512: icon = logo EC-HOLDINGS (khung cam "EC" vuông — sinh lại từ LogoEC.jpg).
      // Cache-bust ?v=4 — ép trình duyệt bỏ icon logo GIONG cũ (?v=3).
      { rel: "icon", type: "image/png", href: "/icons/icon-192.png?v=4" },
      { rel: "shortcut icon", href: "/favicon.ico?v=4" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json?v=4" },
      { rel: "apple-touch-icon", href: "/icons/icon-180.png?v=4" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
      },
    ],
  }),
  component: Root,
});

function Root() {
  return (
    <html lang="vi" className="antialiased" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <HeadContent />
      </head>
      <body className="bg-bg text-ink" suppressHydrationWarning>
        <PreviewHostBridge />
        <AuthProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
