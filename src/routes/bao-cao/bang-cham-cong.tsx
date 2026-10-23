import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { findEmployeeByLooseText, isAdminRole } from "@/lib/catalog";
import { formatDate } from "@/lib/format";

/** Remove postal/zip codes from address strings */
function cleanAddress(addr: string): string {
  if (!addr) return addr;
  let cleaned = addr.replace(/,?\s*\d{4,6}\s*(?=,|$)/g, "");
  cleaned = cleaned.replace(/(\S)\s+\d{4,6}(?=,)/g, "$1");
  cleaned = cleaned.replace(/,\s*,/g, ",").replace(/^\s*,|,\s*$/g, "");
  return cleaned.trim();
}

export const Route = createFileRoute("/bao-cao/bang-cham-cong")({
  component: BangChamCongReport,
});

/** Parse time string "HH:MM:SS" or "HH:MM" to total seconds */
function timeToSeconds(time: string): number {
  if (!time) return 0;
  const parts = time.split(":").map(Number);
  if (parts.length >= 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  return 0;
}

/** Format seconds to "Xh Yp" */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m > 0 ? m + "p" : ""}`.trim();
}

type ReportRow = {
  stt: number;
  name: string;
  title: string;
  center: string;
  date: string;
  weekday: string;
  checkIn: string;
  checkOut: string;
  workSeconds: number;
  workDays: number;
};

function BangChamCongReport() {
  const attendance = useAppStore((s) => s.attendance);
  const employees = useAppStore((s) => s.employees);
  const currentEmployee = useAppStore(
    (s) => s.employees.find((e) => e.id === s.currentUserId) ?? null,
  );
  const canViewAll = currentEmployee
    ? isAdminRole(currentEmployee.role)
    : false;

  // Filters
  const [q, setQ] = useState("");
  const [center, setCenter] = useState("all");
  const [kind, setKind] = useState<"all" | "in" | "out">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Build report rows: group by name + date
  const reportRows = useMemo(() => {
    // Filter attendance
    const filtered = attendance.filter((a) => {
      if (!canViewAll) {
        const empName = currentEmployee?.name ?? "";
        if (a.name !== empName) return false;
      }
      const related = findEmployeeByLooseText(a.name);
      const workplace = related?.center ?? a.workplace ?? currentEmployee?.center ?? "VP";
      if (center !== "all" && workplace !== center) return false;
      if (dateFrom && a.date < dateFrom) return false;
      if (dateTo && a.date > dateTo) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        const searchText = [a.name, a.address, workplace, related?.username ?? "", related?.dept ?? ""]
          .join(" ").toLowerCase();
        if (!searchText.includes(s)) return false;
      }
      return true;
    });

    // Group by name + date
    const grouped = new Map<string, {
      name: string;
      date: string;
      weekday: string;
      workplace: string;
      title: string;
      checkIns: string[];
      checkOuts: string[];
    }>();

    for (const a of filtered) {
      const key = `${a.name}__${a.date}`;
      if (!grouped.has(key)) {
        const related = findEmployeeByLooseText(a.name);
        grouped.set(key, {
          name: a.name,
          date: a.date,
          weekday: a.weekday,
          workplace: related?.center ?? a.workplace ?? "VP",
          title: related?.title ?? "",
          checkIns: [],
          checkOuts: [],
        });
      }
      const g = grouped.get(key)!;
      if (a.status.includes("vào")) g.checkIns.push(a.time);
      if (a.status.includes("tan")) g.checkOuts.push(a.time);
    }

    // Build rows with computed columns
    const rows: ReportRow[] = [];
    let stt = 1;

    for (const g of grouped.values()) {
      // Sort times numerically (not lexicographic)
      const ins = g.checkIns.sort((a, b) => timeToSeconds(a) - timeToSeconds(b));
      const outs = g.checkOuts.sort((a, b) => timeToSeconds(a) - timeToSeconds(b));

      // Calculate work time: pair ins and outs chronologically
      let totalSeconds = 0;
      const pairs = Math.min(ins.length, outs.length);
      for (let i = 0; i < pairs; i++) {
        const inSec = timeToSeconds(ins[i]);
        const outSec = timeToSeconds(outs[i]);
        const shift = outSec > inSec ? outSec - inSec : 0;
        // Cap single shift at 12h (no valid shift exceeds 12h)
        totalSeconds += Math.min(shift, 12 * 3600);
      }
      // If more outs than ins, pair remaining outs with earliest ins
      if (outs.length > ins.length && ins.length > 0) {
        for (let i = pairs; i < outs.length; i++) {
          const inSec = timeToSeconds(ins[0]);
          const outSec = timeToSeconds(outs[i]);
          const shift = outSec > inSec ? outSec - inSec : 0;
          totalSeconds += Math.min(shift, 12 * 3600);
        }
      }
      // Cap total daily work time at 24h max
      totalSeconds = Math.min(totalSeconds, 24 * 3600);

      // GĐ 228h (yêu cầu Đại ca): ngày có công trừ CỐ ĐỊNH 1h30 nghỉ giữa ca
      // (12:00–13:30). Chặn ≥ 0 — ca quá ngắn không ra giờ âm.
      if (totalSeconds > 0) {
        totalSeconds = Math.max(0, totalSeconds - 90 * 60);
      }

      const workDays = totalSeconds > 0 ? Math.min(Math.round((totalSeconds / (8 * 3600)) * 100) / 100, 3.0) : 0;

      rows.push({
        stt: stt++,
        name: g.name,
        title: g.title,
        center: g.workplace,
        date: g.date,
        weekday: g.weekday,
        checkIn: ins[0] ?? "-",
        checkOut: outs[outs.length - 1] ?? "-",
        workSeconds: totalSeconds,
        workDays,
      });
    }

    // Sort by date desc, then name
    rows.sort((a, b) => {
      if (a.date !== b.date) return b.date > a.date ? 1 : -1;
      return a.name.localeCompare(b.name, "vi");
    });

    // Re-number STT
    rows.forEach((r, i) => (r.stt = i + 1));

    return rows;
  }, [attendance, currentEmployee, canViewAll, q, center, dateFrom, dateTo]);

  // Center stats
  const centerStats = useMemo(() => {
    const map = new Map<string, { total: number; days: number }>();
    for (const r of reportRows) {
      const c = map.get(r.center) ?? { total: 0, days: 0 };
      c.total += r.workDays;
      c.days += 1;
      map.set(r.center, c);
    }
    return [...map.entries()].map(([code, data]) => ({
      code,
      total: Math.round(data.total * 100) / 100,
      days: data.days,
    }));
  }, [reportRows]);

  // Export to CSV
  function exportToCSV() {
    const BOM = "\uFEFF"; // UTF-8 BOM for Excel
    const headers = ["STT", "Nhân sự", "Chức danh", "Trụ sở", "Ngày", "Thứ", "Giờ vào ca", "Giờ tan ca", "Thời gian làm việc", "Số công"];
    const csvRows = [headers.join(",")];

    for (const r of reportRows) {
      csvRows.push([
        r.stt,
        `"${r.name}"`,
        `"${r.title}"`,
        `"${r.center}"`,
        r.date,
        r.weekday,
        r.checkIn,
        r.checkOut,
        `"${formatDuration(r.workSeconds)}"`,
        r.workDays.toFixed(2),
      ].join(","));
    }

    const csv = BOM + csvRows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bang-cham-cong-${dateFrom || "all"}-${dateTo || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Báo cáo"
        title="Bảng chấm công"
        desc="Tổng hợp giờ vào/tan ca, thời gian làm việc và số công theo ngày."
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
          <option value="VP">Văn phòng</option>
          <option value="LB">Long Biên</option>
          <option value="SĐ">Sài Đồng</option>
          <option value="NL">Ngọc Lâm</option>
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
          {centerStats.map((c) => (
            <div key={c.code} className="min-w-[140px] rounded-xl border border-line bg-surface p-3 text-sm">
              <p className="font-medium text-ink">{c.code}</p>
              <p className="text-muted">Số công: <strong>{c.total}</strong></p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">STT</th>
              <th className="px-4 py-3">Nhân sự</th>
              <th className="px-4 py-3">Trụ sở</th>
              <th className="px-4 py-3">Ngày</th>
              <th className="px-4 py-3">Giờ vào ca</th>
              <th className="px-4 py-3">Giờ tan ca</th>
              <th className="px-4 py-3 text-right">Thời gian</th>
              <th className="px-4 py-3 text-right">Số công</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {reportRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  Chưa có dữ liệu chấm công trong khoảng đã chọn.
                </td>
              </tr>
            ) : (
              reportRows.map((r) => (
                <tr key={`${r.name}-${r.date}`} className="hover:bg-surface-2/50">
                  <td className="px-4 py-3 tabular">{r.stt}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{r.name}</p>
                    <p className="text-xs text-muted">{r.title}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{r.center}</td>
                  <td className="px-4 py-3">
                    {formatDate(r.date)}
                    <br />
                    <span className="text-xs text-muted">{r.weekday}</span>
                  </td>
                  <td className="px-4 py-3 tabular">{r.checkIn}</td>
                  <td className="px-4 py-3 tabular">{r.checkOut}</td>
                  <td className="px-4 py-3 text-right tabular">{formatDuration(r.workSeconds)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular">
                    {r.workDays.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {reportRows.length > 0 && (
            <tfoot className="bg-surface-2 font-medium">
              <tr>
                <td className="px-4 py-3" colSpan={7}>Tổng cộng</td>
                <td className="px-4 py-3 text-right tabular">
                  {reportRows.reduce((s, r) => s + r.workDays, 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
