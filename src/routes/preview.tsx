import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Smartphone, QrCode, ExternalLink, Monitor, X, ShieldAlert, ArrowLeft } from "lucide-react";
import { ClientOnly } from "@/components/client-only";
import { useAppStore } from "@/lib/store";
import { isAdminRole } from "@/lib/catalog";

export const Route = createFileRoute("/preview")({ component: PreviewPage });

const PAGES = [
  { path: "/", label: "Dashboard", icon: "📊" },
  { path: "/cham-cong", label: "Chấm công", icon: "⏰" },
  { path: "/check-in", label: "Check-in", icon: "📍" },
  { path: "/nhiem-vu", label: "Nhiệm vụ", icon: "📋" },
  { path: "/de-nghi", label: "Đề nghị", icon: "📄" },
  { path: "/nhan-su", label: "Nhân sự", icon: "👥" },
  { path: "/trung-tam", label: "Trung tâm", icon: "🏢" },
  { path: "/ho-so", label: "Hồ sơ", icon: "📁" },
  { path: "/ghi-chu", label: "Ghi chú", icon: "📝" },
  { path: "/chat", label: "Chat", icon: "💬" },
  { path: "/bao-cao", label: "Báo cáo", icon: "📈" },
  { path: "/huong-dan", label: "Hướng dẫn", icon: "📖" },
];

function PreviewPage() {
  const currentEmployee = useAppStore((s) => s.employees.find((e) => e.id === s.currentUserId) ?? null);
  const isAllowed = isAdminRole(currentEmployee?.role);

  const [currentPath, setCurrentPath] = useState("/");
  const [baseUrl, setBaseUrl] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const iframeUrl = useMemo(() => {
    if (!baseUrl) return "";
    return `${baseUrl}${currentPath}`;
  }, [baseUrl, currentPath]);

  const qrUrl = useMemo(() => {
    if (!baseUrl) return "";
    // Use a reliable QR code API
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(baseUrl)}&bgcolor=ffffff&color=12211c`;
  }, [baseUrl]);

  const phoneQrUrl = useMemo(() => {
    if (!baseUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(iframeUrl)}&bgcolor=ffffff&color=12211c`;
  }, [baseUrl, iframeUrl]);

  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  const handleNavigate = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  return (
    <ClientOnly>
      {/* Access Denied for non-admin */}
      {!isAllowed ? (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-900/30">
              <ShieldAlert className="size-8 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Không có quyền truy cập</h1>
            <p className="text-gray-400 mb-6">
              Bạn không phải là Admin nên không có quyền truy cập trang Preview Mobile.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition"
            >
              <ArrowLeft className="size-4" />
              Về trang chủ
            </Link>
          </div>
        </div>
      ) : (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Smartphone className="size-5 text-emerald-400" />
              Mobile Preview
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Xem app trên mobile ngay trên desktop — hot reload hoạt động trong iframe
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition"
              title="Refresh iframe"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </button>
            <button
              onClick={() => setShowQr(!showQr)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
                showQr
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
              title="Toggle QR Code"
            >
              <QrCode className="size-3.5" />
              QR Code
            </button>
            <a
              href={iframeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition"
              title="Mở trong tab mới"
            >
              <ExternalLink className="size-3.5" />
              Mở tab
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 items-start justify-center">
          {/* Phone Mockup */}
          <div className="flex-shrink-0">
            <div className="relative">
              {/* Phone frame */}
              <div className="relative w-[390px] rounded-[48px] border-[10px] border-gray-800 bg-gray-800 shadow-2xl shadow-black/50">
                {/* Dynamic Island / Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <div className="w-[120px] h-[30px] bg-gray-800 rounded-b-2xl" />
                </div>

                {/* Screen */}
                <div className="relative overflow-hidden rounded-[38px] bg-white">
                  {/* Status bar (iOS style) */}
                  <div className="relative z-10 flex items-center justify-between px-8 pt-3 pb-1 bg-white/80 backdrop-blur-sm">
                    <span className="text-[13px] font-semibold text-black">
                      {new Date().toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                        timeZone: "Asia/Ho_Chi_Minh",
                      })}
                    </span>
                    <div className="flex items-center gap-1">
                      <svg className="size-3.5" viewBox="0 0 16 12" fill="black">
                        <rect x="0" y="6" width="3" height="6" rx="0.5" />
                        <rect x="4.5" y="4" width="3" height="8" rx="0.5" />
                        <rect x="9" y="2" width="3" height="10" rx="0.5" />
                        <rect x="13" y="0" width="3" height="12" rx="0.5" />
                      </svg>
                      <svg className="size-4" viewBox="0 0 24 12" fill="black">
                        <rect x="0" y="0.5" width="20" height="11" rx="2" stroke="black" strokeWidth="1" fill="none" />
                        <rect x="1.5" y="2" width="16" height="8" rx="1" fill="black" />
                        <rect x="21" y="3.5" width="2" height="5" rx="1" fill="black" />
                      </svg>
                    </div>
                  </div>

                  {/* Iframe */}
                  <iframe
                    ref={iframeRef}
                    key={iframeKey}
                    src={iframeUrl}
                    className="w-full border-0"
                    style={{
                      height: "calc(844px - 44px)",
                      width: "370px",
                    }}
                    title="Mobile Preview"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
                  />

                  {/* Home indicator */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[134px] h-[5px] bg-black/20 rounded-full" />
                </div>
              </div>

              {/* Page indicator */}
              <div className="mt-3 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-800/80 px-3 py-1 text-xs text-gray-300">
                  <Monitor className="size-3" />
                  {PAGES.find((p) => p.path === currentPath)?.icon}{" "}
                  {PAGES.find((p) => p.path === currentPath)?.label}
                  <span className="text-gray-500">·</span>
                  <span className="text-gray-500 font-mono text-[11px]">{currentPath}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Panel: QR + Page Nav */}
          <div className="flex flex-col gap-4 min-w-[260px]">
            {/* QR Code */}
            {showQr && (
              <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <QrCode className="size-4 text-emerald-400" />
                  Quét để mở trên điện thoại
                </h3>
                <div className="flex gap-3">
                  <div className="text-center">
                    <img
                      src={qrUrl}
                      alt="QR - Homepage"
                      className="rounded-lg bg-white p-1"
                      width={120}
                      height={120}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Trang chủ</p>
                  </div>
                  <div className="text-center">
                    <img
                      src={phoneQrUrl}
                      alt="QR - Current page"
                      className="rounded-lg bg-white p-1"
                      width={120}
                      height={120}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Trang hiện tại</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2 text-center">
                  Mở camera điện thoại → quét QR → app mở trên Safari/Chrome
                </p>
              </div>
            )}

            {/* Page Navigation */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
              <h3 className="text-sm font-medium text-white mb-3">
                Chuyển trang nhanh
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {PAGES.map((page) => (
                  <button
                    key={page.path}
                    onClick={() => handleNavigate(page.path)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                      currentPath === page.path
                        ? "bg-emerald-600/20 text-emerald-300 border border-emerald-600/30"
                        : "bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-transparent"
                    }`}
                  >
                    <span className="text-sm">{page.icon}</span>
                    <span className="truncate">{page.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
              <h3 className="text-sm font-medium text-white mb-2">💡 Tips</h3>
              <ul className="space-y-1.5 text-xs text-gray-400">
                <li>• Code → hot reload → iframe tự cập nhật</li>
                <li>• Quét QR để xem trên điện thoại thật</li>
                <li>• Nhấn "Refresh" nếu iframe không tự reload</li>
                <li>• Cookie auth sharing giữa iframe và tab chính</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      )}
    </ClientOnly>
  );
}
