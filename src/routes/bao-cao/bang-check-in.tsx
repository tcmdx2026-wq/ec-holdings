import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { Download, Layers, MapPin, Satellite, Map as MapIcon, X } from "lucide-react";
import { ClientOnly } from "@/components/client-only";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { findEmployeeByLooseText, isAdminRole, CENTERS } from "@/lib/catalog";
import { formatDate } from "@/lib/format";

/** Remove postal/zip codes from address strings */
function cleanAddress(addr: string): string {
  if (!addr) return addr;
  let cleaned = addr.replace(/,?\s*\d{4,6}\s*(?=,|$)/g, "");
  cleaned = cleaned.replace(/(\S)\s+\d{4,6}(?=,)/g, "$1");
  cleaned = cleaned.replace(/,\s*,/g, ",").replace(/^\s*,|,\s*$/g, "");
  return cleaned.trim();
}

/**
 * Load Leaflet from CDN at runtime.
 * `import("leaflet")` fails on production because vite.config.ts marks leaflet
 * as external — the browser cannot resolve the bare specifier. Loading via
 * <script> tag avoids the bundler entirely.
 */
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => resolve((window as any).L);
      script.onerror = () => {
        leafletPromise = null;
        reject(new Error("Không tải được Leaflet từ CDN"));
      };
      document.head.appendChild(script);
    });
  }
  return leafletPromise;
}

export const Route = createFileRoute("/bao-cao/bang-check-in")({
  component: BangCheckInReport,
});

/** Parse GPS string "lat, lng" to [lat, lng] */
function parseGps(gps: string): [number, number] | null {
  if (!gps) return null;
  const parts = gps.split(",").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  return null;
}

/** Leaflet map component with satellite/street toggle */
function CheckInMap({
  points,
  onSelect,
}: {
  points: Array<{
    name: string;
    address: string;
    gps: string;
    date: string;
    time: string;
    centerCode: string;
  }>;
  onSelect?: (p: {
    name: string;
    address: string;
    gps: string;
    date: string;
    time: string;
    centerCode: string;
  }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [layer, setLayer] = useState<"street" | "satellite">("street");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Fix Leaflet default marker icon + init map — load Leaflet from CDN
    loadLeaflet().then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        center: [21.0285, 105.8542],
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
      });
      // Dùng Esri World Street Map thay vì OSM — OSM chặn/throttle theo IP
      // khiến máy ở nhà + điện thoại không tải được tile (máy công ty thì được).
      const streetLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "&copy; Esri",
          maxZoom: 19,
        },
      );
      const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: '&copy; Esri',
          maxZoom: 18,
        },
      );
      streetLayer.addTo(map);
      (map as any)._streetLayer = streetLayer;
      (map as any)._satelliteLayer = satelliteLayer;

      const markers = [];
      for (const p of points) {
        const coords = parseGps(p.gps);
        if (!coords) continue;

        const related = findEmployeeByLooseText(p.name);
        const centerShort =
          CENTERS.find((c) => c.code === p.centerCode)?.short ?? p.centerCode;

        const marker = L.marker(coords).addTo(map);
        marker.bindPopup(
          `<div style="font-family:system-ui;min-width:180px">
            <p style="font-weight:600;margin:0 0 4px 0">${p.name}</p>
            <p style="font-size:12px;color:#666;margin:0 0 2px 0">${formatDate(p.date)} · ${p.time}</p>
            <p style="font-size:12px;color:#666;margin:0 0 2px 0">Trung tâm: ${centerShort}</p>
            ${p.address ? `<p style="font-size:12px;color:#666;margin:0 0 2px 0">${cleanAddress(p.address)}</p>` : ""}
            ${related?.title ? `<p style="font-size:11px;color:#999;margin:2px 0 0 0">${related.title}</p>` : ""}
          </div>`,
        );
        marker.on("click", () => onSelect?.(p));
        markers.push(marker);
      }

      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
      }

      setTimeout(() => map.invalidateSize(), 200);
      mapRef.current = map;
    }).catch(err => console.warn("[bang-check-in] map init failed", err));

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [points]);

  // Handle layer toggle — Leaflet loaded from CDN
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    loadLeaflet().then(L => {
      const streetMap = (map as any)._streetLayer;
      const satelliteMap = (map as any)._satelliteLayer;

      if (layer === "satellite") {
        if (streetMap && map.hasLayer(streetMap)) map.removeLayer(streetMap);
        if (!map.hasLayer(satelliteMap)) satelliteMap.addTo(map);
      } else {
        if (satelliteMap && map.hasLayer(satelliteMap)) map.removeLayer(satelliteMap);
        if (!map.hasLayer(streetMap)) streetMap.addTo(map);
      }
    }).catch(err => console.warn("[bang-check-in] layer toggle failed", err));
  }, [layer]);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <p className="text-sm font-semibold text-ink">
          Bản đồ Check-in ({points.length} vị trí)
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setLayer("street")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              layer === "street"
                ? "bg-accent text-accent-fg"
                : "bg-surface-2 text-muted hover:bg-surface"
            }`}
          >
            <MapIcon className="size-3" />
            Đường phố
          </button>
          <button
            type="button"
            onClick={() => setLayer("satellite")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              layer === "satellite"
                ? "bg-accent text-accent-fg"
                : "bg-surface-2 text-muted hover:bg-surface"
            }`}
          >
            <Satellite className="size-3" />
            Vệ tinh
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        style={{ height: "450px", width: "100%", position: "relative", zIndex: 0 }}
      />
    </Card>
  );
}

type ReportRow = {
  stt: number;
  name: string;
  title: string;
  center: string;
  date: string;
  weekday: string;
  time: string;
  address: string;
  gps: string;
  note: string;
  photo: string;
  /** GĐ 102: URL video check-in (nếu có) */
  video?: string;
};

function BangCheckInReport() {
  const checkins = useAppStore((s) => s.checkins);
  const employees = useAppStore((s) => s.employees);
  const currentEmployee = useAppStore(
    (s) => s.employees.find((e) => e.id === s.currentUserId) ?? null,
  );
  const canViewAll = currentEmployee
    ? isAdminRole(currentEmployee.role)
    : false;

  const [q, setQ] = useState("");
  const [center, setCenter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailRow, setDetailRow] = useState<ReportRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  // GĐ 80: lightbox phóng to ảnh — Radix Dialog modal khóa pointer-events ngoài portal
  // → bấm X/nền lightbox bị nuốt. Fix: đóng dialog khi mở lightbox, mở lại khi đóng.
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  function closeLightbox() {
    setLightboxPhoto(null);
    if (detailRow) setIsDetailOpen(true); // mở lại dialog chi tiết như cũ
  }

  const reportRows = useMemo(() => {
    const filtered = checkins.filter((c) => {
      if (!canViewAll) {
        const empName = currentEmployee?.name ?? "";
        if (c.name !== empName) return false;
      }
      const cc = c.centerCode ?? "VP";
      if (center !== "all" && cc !== center) return false;
      if (dateFrom && c.date < dateFrom) return false;
      if (dateTo && c.date > dateTo) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        const related = findEmployeeByLooseText(c.name);
        const searchText = [
          c.name,
          c.address,
          cc,
          c.note,
          related?.username ?? "",
          related?.dept ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchText.includes(s)) return false;
      }
      return true;
    });

    const rows: ReportRow[] = filtered
      .sort((a, b) =>
        b.date > a.date ? 1 : b.date < a.date ? -1 : b.time > a.time ? 1 : -1,
      )
      .map((c, i) => {
        const related = findEmployeeByLooseText(c.name);
        return {
          stt: i + 1,
          name: c.name,
          title: related?.title ?? "",
          center: c.centerCode ?? "VP",
          date: c.date,
          weekday: c.weekday,
          time: c.time,
          address: c.address || "—",
          gps: c.gps || "",
          note: c.note || "—",
          photo: c.photo || "",
          video: c.video || "",
        };
      });

    return rows;
  }, [checkins, currentEmployee, canViewAll, q, center, dateFrom, dateTo]);

  // Map points (only rows with valid GPS)
  const mapPoints = useMemo(() => {
    return reportRows
      .filter((r) => parseGps(r.gps))
      .map((r) => ({
        name: r.name,
        address: r.address,
        gps: r.gps,
        date: r.date,
        time: r.time,
        centerCode: r.center,
      }));
  }, [reportRows]);

  // Center stats
  const centerStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reportRows) {
      map.set(r.center, (map.get(r.center) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
  }, [reportRows]);

  function exportToCSV() {
    const BOM = "\uFEFF";
    const headers = [
      "STT",
      "Nhân sự",
      "Chức danh",
      "Trung tâm",
      "Ngày",
      "Thứ",
      "Giờ",
      "Địa điểm",
      "GPS",
      "Ghi chú",
    ];
    const csvRows = [headers.join(",")];

    for (const r of reportRows) {
      csvRows.push(
        [
          r.stt,
          `"${r.name}"`,
          `"${r.title}"`,
          `"${r.center}"`,
          r.date,
          r.weekday,
          r.time,
          `"${r.address}"`,
          `"${r.gps}"`,
          `"${r.note}"`,
        ].join(","),
      );
    }

    const csv = BOM + csvRows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bang-check-in-${dateFrom || "all"}-${dateTo || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Báo cáo"
        title="Bảng Check-in"
        desc="Tổng hợp lượt check-in theo ngày, người, trung tâm với bản đồ vị trí."
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên nhân sự..."
          className="w-56"
        />
        <select
          value={center}
          onChange={(e) => setCenter(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="all">Tất cả trung tâm</option>
          {CENTERS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.short}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
          />
          <span className="text-muted">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="size-4" />
            File Excel
          </Button>
        </div>
      </div>

      {/* Stats */}
      {centerStats.length > 0 && (
        <div className="mb-4 flex gap-3 overflow-x-auto">
          {centerStats.map((s) => (
            <div
              key={s.code}
              className="min-w-[140px] rounded-xl border border-line bg-surface p-3 text-sm"
            >
              <p className="font-medium text-ink">
                {CENTERS.find((c) => c.code === s.code)?.short ?? s.code}
              </p>
              <p className="text-muted">
                <strong>{s.count}</strong> lượt check-in
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Map */}
      {mapPoints.length > 0 && (
        <div className="mb-6">
          <ClientOnly>
            <CheckInMap
              points={mapPoints}
              onSelect={(p) => {
                const row = reportRows.find(
                  (r) => r.gps === p.gps && r.name === p.name && r.date === p.date && r.time === p.time,
                );
                if (row) {
                  setDetailRow(row);
                  setIsDetailOpen(true);
                }
              }}
            />
          </ClientOnly>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">STT</th>
              <th className="px-4 py-3">Nhân sự</th>
              <th className="px-4 py-3">Trung tâm</th>
              <th className="px-4 py-3">Ngày</th>
              <th className="px-4 py-3">Giờ</th>
              <th className="px-4 py-3">Địa điểm</th>
              <th className="px-4 py-3">Ảnh</th>
              <th className="px-4 py-3">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {reportRows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-muted"
                >
                  Chưa có dữ liệu check-in trong khoảng đã chọn.
                </td>
              </tr>
            ) : (
              reportRows.map((r) => (
                <tr
                  key={`${r.name}-${r.date}-${r.time}`}
                  className="cursor-pointer hover:bg-surface-2/50"
                  onClick={() => {
                    setDetailRow(r);
                    setIsDetailOpen(true);
                  }}
                >
                  <td className="px-4 py-3 tabular">{r.stt}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{r.name}</p>
                    {r.title && (
                      <p className="text-xs text-muted">{r.title}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {CENTERS.find((c) => c.code === r.center)?.short ??
                      r.center}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(r.date)}
                    <br />
                    <span className="text-xs text-muted">{r.weekday}</span>
                  </td>
                  <td className="px-4 py-3 tabular">{r.time}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-muted">
                    {cleanAddress(r.address)}
                  </td>
                  <td className="px-4 py-3">
                    {r.photo ? (
                      <img
                        src={r.photo}
                        alt="check-in"
                        className="size-8 rounded-md object-cover"
                      />
                    ) : (
                      <span className="text-xs text-faint">—</span>
                    )}
                  </td>
                  <td className="max-w-[150px] truncate px-4 py-3 text-muted">
                    {r.note}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {reportRows.length > 0 && (
            <tfoot className="bg-surface-2 font-medium">
              <tr>
                <td className="px-4 py-3" colSpan={7}>
                  Tổng cộng
                </td>
                <td className="px-4 py-3 tabular">
                  {reportRows.length} lượt
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          {detailRow && (
            <>
              <DialogTitle>Chi tiết Check-in</DialogTitle>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-line bg-surface-2 p-3">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Nhân sự</p>
                  <p className="mt-1 text-base font-semibold text-ink">{detailRow.name}</p>
                  {detailRow.title && <p className="text-xs text-muted">{detailRow.title}</p>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-surface-2 p-3">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Trung tâm</p>
                    <p className="mt-1 text-base font-semibold text-ink">
                      {CENTERS.find((c) => c.code === detailRow.center)?.short ?? detailRow.center}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-2 p-3">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Thời gian</p>
                    <p className="mt-1 text-base font-semibold text-ink">{detailRow.time}</p>
                    <p className="text-xs text-muted">{formatDate(detailRow.date)} · {detailRow.weekday}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-surface-2 p-3">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">GPS</p>
                  <p className="mt-1 text-sm font-medium text-ink">{detailRow.gps || "—"}</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-2 p-3">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Địa điểm</p>
                  <p className="mt-1 text-sm leading-5 text-ink">{cleanAddress(detailRow.address)}</p>
                </div>
                {detailRow.photo && (
                  <div className="rounded-xl border border-line bg-white p-2">
                    <img
                      src={detailRow.photo}
                      alt="Ảnh check-in"
                      className="h-40 w-auto mx-auto cursor-zoom-in rounded object-contain transition hover:opacity-90"
                      title="Bấm để phóng to"
                      onClick={() => {
                        setIsDetailOpen(false); // tắt Radix modal — lightbox ngoài portal mới bấm được
                        setLightboxPhoto(detailRow.photo!);
                      }}
                    />
                  </div>
                )}
                {/* GĐ 102: video check-in (nếu có) — phát ngay trong dialog */}
                {detailRow.video && (
                  <div className="rounded-xl border border-line bg-black p-2">
                    <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Video check-in</p>
                    <video
                      src={detailRow.video}
                      controls
                      playsInline
                      className="max-h-72 w-full rounded-lg object-contain"
                    />
                  </div>
                )}
                {detailRow.note && detailRow.note !== "—" && (
                  <div className="rounded-xl border border-line bg-surface-2 p-3">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Ghi chú</p>
                    <p className="mt-1 text-sm text-ink">{detailRow.note}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* GĐ 80: Lightbox nền trắng (pattern GĐ 65) — render NGOÀI Radix portal nên phải
          đóng dialog khi mở (Radix modal khóa pointer-events ngoài portal, bấm X bị nuốt) */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-white/95 p-4"
          onClick={closeLightbox}
        >
          <img
            src={lightboxPhoto}
            alt="Ảnh check-in (phóng to)"
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            aria-label="Đóng"
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-black/10 text-ink transition hover:bg-black/20"
            onClick={closeLightbox}
          >
            <X className="size-6" />
          </button>
        </div>
      )}
    </div>
  );
}
