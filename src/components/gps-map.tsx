import { useState } from "react";
import { ExternalLink, MapPin, Maximize2, X } from "lucide-react";

interface GpsMapProps {
  coords: [number, number] | null;
  address?: string;
  fallback?: React.ReactNode;
}

/**
 * GPS map component — styled preview with Google Maps link.
 * Guaranteed to render: no iframe, no external images, no library.
 * Click to open Google Maps in new tab.
 */
export function GpsMap({ coords, address, fallback }: GpsMapProps) {
  const [expanded, setExpanded] = useState(false);

  if (!coords) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm text-muted">
        {fallback ?? (
          <>
            <MapPin className="mr-2 size-4" />
            Đang tải bản đồ...
          </>
        )}
      </div>
    );
  }

  const [lat, lng] = coords;
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=17`;

  const MapPreview = ({ size }: { size?: "sm" | "lg" }) => {
    const isLg = size === "lg";
    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-line ${isLg ? "h-[400px]" : "h-44"}`}
        style={{
          background: `
            radial-gradient(circle at 30% 30%, rgba(38,99,87,0.18), transparent 25%),
            radial-gradient(circle at 70% 60%, rgba(38,99,87,0.10), transparent 30%),
            linear-gradient(135deg, #e8f0eb 0%, #d4e4da 40%, #c8dbd0 70%, #bcd3c5 100%)
          `,
        }}
      >
        {/* Grid lines (map-like) */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: isLg ? "40px 40px" : "24px 24px",
          }}
        />
        {/* Fake roads */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/60" />
        <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/50" />
        <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/40" />
        <div
          className="absolute left-[15%] right-[40%] top-[35%] h-px rotate-12 bg-white/30"
          style={{ transformOrigin: "left center" }}
        />

        {/* Red marker */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
          <div
            className="flex size-10 items-center justify-center rounded-full bg-red-500 shadow-lg"
            style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.3))" }}
          >
            <MapPin className="size-5 text-white" fill="white" />
          </div>
          <div className="h-0 w-0 -mt-px border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
        </div>

        {/* Coordinates label */}
        <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-mono text-white backdrop-blur-sm">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </div>

        {/* Open maps button */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2 bottom-2 flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-ink shadow-md backdrop-blur-sm transition hover:bg-white"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="size-3" />
          Google Maps
        </a>
      </div>
    );
  };

  return (
    <>
      <div className="relative">
        <MapPreview size="sm" />
        {/* Expand button */}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-lg bg-white/90 shadow-md transition hover:bg-white"
          title="Phóng to bản đồ"
        >
          <Maximize2 className="size-3.5 text-ink" />
        </button>
      </div>

      {/* Fullscreen overlay */}
      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg">
          <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Vị trí chấm công</p>
              {address && (
                <p className="truncate text-xs text-muted">{address}</p>
              )}
              <p className="font-mono text-xs text-faint">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:opacity-90"
              >
                <ExternalLink className="size-3" />
                Google Maps
              </a>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-2"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-surface-2 p-4">
            <MapPreview size="lg" />
          </div>
        </div>
      )}
    </>
  );
}
