import { createFileRoute } from "@tanstack/react-router";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { ClientOnly } from "@/components/client-only";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { formatDate } from "@/lib/format";
import type { Proposal } from "@/lib/types";

export const Route = createFileRoute("/bao-cao/bang-de-nghi")({
  component: BaoCaoDeNghi,
});

const KINDS: Proposal["kind"][] = ["Nhân sự", "Thu chi", "Nhập xuất", "Góp ý"];
const STATUSES: Proposal["status"][] = ["Chờ duyệt", "Đã duyệt", "Từ chối"];

const PIE_COLORS: Record<string, string> = {
  "Chờ duyệt": "#b45309",
  "Đã duyệt": "#1c6b58",
  "Từ chối": "#b42318",
};

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs font-medium text-muted">{label}</span>
      <span className="min-w-0 text-right text-sm break-words text-ink">{value || "—"}</span>
    </div>
  );
}

function BaoCaoDeNghi() {
  const proposals = useAppStore((s) => s.proposals);

  // ===== Filters =====
  const [q, setQ] = useState("");
  const [fRequester, setFRequester] = useState("all");
  const [fApprover, setFApprover] = useState("all");
  const [fKind, setFKind] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  // Dialog chi tiết
  const [detailRow, setDetailRow] = useState<Proposal | null>(null);

  // ===== Danh sách người đề nghị / duyệt =====
  const requesters = useMemo(
    () => [...new Set(proposals.map((p) => p.requester).filter(Boolean))].sort(),
    [proposals],
  );
  const approvers = useMemo(
    () => [...new Set(proposals.map((p) => p.approver ?? "").filter(Boolean))].sort(),
    [proposals],
  );

  // ===== Lọc dữ liệu =====
  const rows = useMemo(() => {
    return proposals
      .filter((p) => {
        if (fStatus !== "all" && p.status !== fStatus) return false;
        if (fKind !== "all" && p.kind !== fKind) return false;
        if (fRequester !== "all" && p.requester !== fRequester) return false;
        if (fApprover !== "all" && (p.approver ?? "") !== fApprover) return false;
        if (q.trim()) {
          const s = q.toLowerCase();
          const hay = `${p.title} ${p.detail} ${p.kind} ${p.requester} ${p.approver ?? ""} ${p.dept}`.toLowerCase();
          if (!hay.includes(s)) return false;
        }
        if (fFrom && p.date < fFrom) return false;
        if (fTo && p.date > fTo) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [proposals, fStatus, fKind, fRequester, fApprover, q, fFrom, fTo]);

  // ===== Thống kê =====
  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((p) => p.status === "Chờ duyệt").length,
      approved: rows.filter((p) => p.status === "Đã duyệt").length,
      rejected: rows.filter((p) => p.status === "Từ chối").length,
    }),
    [rows],
  );

  // ===== Pie: cơ cấu theo trạng thái (theo dữ liệu đã lọc) =====
  const pie = useMemo(
    () =>
      STATUSES.map((s) => ({
        name: s,
        value: rows.filter((p) => p.status === s).length,
        color: PIE_COLORS[s],
      })).filter((d) => d.value > 0),
    [rows],
  );

  // ===== Thống kê theo người đề nghị (top cho bảng phụ) =====
  const byRequester = useMemo(() => {
    const map = new Map<string, { total: number; approved: number; pending: number; rejected: number }>();
    for (const p of rows) {
      const key = p.requester || "Không rõ";
      const e = map.get(key) ?? { total: 0, approved: 0, pending: 0, rejected: 0 };
      e.total += 1;
      if (p.status === "Đã duyệt") e.approved += 1;
      else if (p.status === "Chờ duyệt") e.pending += 1;
      else if (p.status === "Từ chối") e.rejected += 1;
      map.set(key, e);
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
  }, [rows]);

  // ===== Biểu đồ cột: đề nghị theo tháng (xếp lớp theo trạng thái) =====
  const byMonth = useMemo(() => {
    const map = new Map<string, { month: string; "Chờ duyệt": number; "Đã duyệt": number; "Từ chối": number }>();
    for (const p of rows) {
      // p.date dạng YYYY-MM-DD → lấy YYYY-MM, hiển thị MM/YYYY
      const ym = p.date.slice(0, 7);
      const label = `${ym.slice(5)}/${ym.slice(0, 4)}`;
      const e = map.get(ym) ?? { month: label, "Chờ duyệt": 0, "Đã duyệt": 0, "Từ chối": 0 };
      if (p.status === "Chờ duyệt") e["Chờ duyệt"] += 1;
      else if (p.status === "Đã duyệt") e["Đã duyệt"] += 1;
      else if (p.status === "Từ chối") e["Từ chối"] += 1;
      map.set(ym, e);
    }
    // Sort theo YYYY-MM tăng dần (tháng cũ bên trái)
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
  }, [rows]);

  // ===== Export CSV — pattern Bảng Check-in (BOM + escape quote) =====
  function exportToCSV() {
    const BOM = "\uFEFF";
    const headers = [
      "STT",
      "Người đề nghị",
      "Loại",
      "Tiêu đề",
      "Nội dung",
      "Đơn vị",
      "Ngày tạo",
      "Người duyệt",
      "Ngày duyệt",
      "Trạng thái",
      "Số tệp đính kèm",
    ];
    const csvRows = [headers.join(",")];
    rows.forEach((p, i) => {
      csvRows.push(
        [
          i + 1,
          `"${p.requester}"`,
          `"${p.kind}"`,
          `"${p.title.replace(/"/g, '""')}"`,
          `"${(p.detail || "").replace(/"/g, '""')}"`,
          `"${p.dept}"`,
          p.date,
          `"${p.approver || ""}"`,
          p.approvedAt ? p.approvedAt.slice(0, 10) : "",
          `"${p.status}"`,
          p.attachments?.length ?? 0,
        ].join(","),
      );
    });
    const csv = BOM + csvRows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bang-de-nghi-${fFrom || "all"}-${fTo || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Báo cáo"
        title="Đề nghị — Đề xuất"
        desc="Tổng hợp đề nghị theo người, loại, trạng thái, thời gian + xuất CSV."
        actions={
          <Button variant="outline" onClick={exportToCSV}>
            <Download />
            Xuất CSV
          </Button>
        }
      />

      {/* Bộ lọc */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tiêu đề, nội dung, người..."
            className="h-10 pl-10"
          />
        </div>
        <select
          value={fRequester}
          onChange={(e) => setFRequester(e.target.value)}
          className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
          title="Lọc người đề nghị"
        >
          <option value="all">Mọi người đề nghị</option>
          {requesters.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={fApprover}
          onChange={(e) => setFApprover(e.target.value)}
          className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
          title="Lọc người duyệt"
        >
          <option value="all">Mọi người duyệt</option>
          {approvers.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={fKind}
          onChange={(e) => setFKind(e.target.value)}
          className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
          title="Lọc loại"
        >
          <option value="all">Mọi loại</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <select
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
          title="Lọc trạng thái"
        >
          <option value="all">Mọi trạng thái</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Input
          type="date"
          value={fFrom}
          onChange={(e) => setFFrom(e.target.value)}
          className="h-10 w-[140px]"
          title="Từ ngày"
        />
        <span className="text-xs text-faint">—</span>
        <Input
          type="date"
          value={fTo}
          onChange={(e) => setFTo(e.target.value)}
          className="h-10 w-[140px]"
          title="Đến ngày"
        />
      </div>

      {/* 4 card thống kê */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Tổng đề nghị", value: stats.total, color: "text-ink" },
          { label: "Chờ duyệt", value: stats.pending, color: "text-warn" },
          { label: "Đã duyệt", value: stats.approved, color: "text-ok" },
          { label: "Từ chối", value: stats.rejected, color: "text-danger" },
        ].map((c) => (
          <Card key={c.label} className="px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">{c.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular ${c.color}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      <p className="mb-3 text-sm text-muted">
        Hiển thị <span className="font-medium text-ink">{rows.length}</span> / {proposals.length} đề nghị
      </p>

      {/* Bảng tổng hợp */}
      <Card className="overflow-hidden p-0 lg:overflow-visible">
        <div className="overflow-x-auto lg:overflow-x-visible">
          <table className="w-full text-sm">
            <thead className="sticky top-16 z-[5]">
              <tr className="border-b border-line bg-surface">
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">STT</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Người đề nghị</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Loại</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Tiêu đề</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Đơn vị</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Ngày tạo</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Người duyệt</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Trạng thái</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Đính kèm</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted">
                    Không có đề nghị nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                rows.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => setDetailRow(p)}
                    className="cursor-pointer border-b border-line transition-colors hover:bg-surface-2/40"
                  >
                    <td className="px-3 py-3 text-faint tabular">{idx + 1}</td>
                    <td className="px-3 py-3 font-medium whitespace-nowrap text-ink">{p.requester}</td>
                    <td className="px-3 py-3"><StatusBadge value={p.kind} /></td>
                    <td className="max-w-[280px] px-3 py-3">
                      <p className="truncate font-medium text-ink">{p.title}</p>
                      {p.detail ? <p className="truncate text-xs text-muted">{p.detail}</p> : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{p.dept || "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted tabular">{formatDate(p.date)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{p.approver || "—"}</td>
                    <td className="px-3 py-3"><StatusBadge value={p.status} /></td>
                    <td className="px-3 py-3 text-center text-muted">{p.attachments?.length ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Biểu đồ cột theo tháng — full chiều ngang */}
      <Card className="mt-5">
        <div className="p-4">
          <p className="font-semibold text-ink">Đề nghị theo tháng</p>
          <p className="mt-0.5 text-sm text-muted">Số phiếu theo trạng thái, cập nhật theo bộ lọc</p>
          <ClientOnly>
            {byMonth.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Chưa có dữ liệu.</p>
            ) : (
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byMonth} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#d3ddd8" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "#5a6b65", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#5a6b65", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "var(--shadow-card)" }}
                      labelStyle={{ color: "#12211c" }}
                    />
                    <Legend />
                    <Bar dataKey="Chờ duyệt" stackId="a" fill="#b45309" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Đã duyệt" stackId="a" fill="#1c6b58" />
                    <Bar dataKey="Từ chối" stackId="a" fill="#b42318" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ClientOnly>
        </div>
      </Card>

      {/* Biểu đồ + bảng phụ */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="p-4">
            <p className="font-semibold text-ink">Cơ cấu theo trạng thái</p>
            {pie.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Chưa có dữ liệu.</p>
            ) : (
              <div className="flex h-56 items-center gap-6">
                <ResponsiveContainer width="50%" height="100%">
                  <PieChart>
                    <Pie data={pie} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={3}>
                      {pie.map((p) => (
                        <Cell key={p.name} fill={p.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="text-sm">
                  {pie.map((p) => (
                    <li key={p.name} className="mb-2 flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                      {p.name}
                      <strong className="tabular">{p.value}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <p className="font-semibold text-ink">Theo người đề nghị</p>
            {byRequester.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Chưa có dữ liệu.</p>
            ) : (
              <div className="mt-3 max-h-56 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="py-2">Người đề nghị</th>
                      <th className="py-2 text-center">Tổng</th>
                      <th className="py-2 text-center">Chờ</th>
                      <th className="py-2 text-center">Đã duyệt</th>
                      <th className="py-2 text-center">Từ chối</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byRequester.map((r) => (
                      <tr key={r.name} className="border-b border-line/60">
                        <td className="py-2 font-medium text-ink">{r.name}</td>
                        <td className="py-2 text-center tabular">{r.total}</td>
                        <td className="py-2 text-center tabular text-warn">{r.pending}</td>
                        <td className="py-2 text-center tabular text-ok">{r.approved}</td>
                        <td className="py-2 text-center tabular text-danger">{r.rejected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Dialog chi tiết — chỉ xem (báo cáo không chỉnh sửa) */}
      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent>
          <DialogTitle>Chi tiết đề nghị</DialogTitle>
          {detailRow ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge value={detailRow.kind} />
                <StatusBadge value={detailRow.status} />
              </div>
              <p className="mt-2 text-base leading-6 font-semibold text-ink">{detailRow.title}</p>
              <div className="mt-3 divide-y divide-line">
                <DetailRow label="Người đề nghị" value={detailRow.requester} />
                <DetailRow label="Đơn vị" value={detailRow.dept} />
                <DetailRow label="Ngày tạo" value={formatDate(detailRow.date)} />
                <DetailRow label="Nội dung" value={detailRow.detail} />
                <DetailRow label="Người duyệt" value={detailRow.approver} />
                <DetailRow
                  label="Ngày duyệt"
                  value={detailRow.approvedAt ? formatDate(detailRow.approvedAt.slice(0, 10)) : ""}
                />
                <DetailRow label="Tệp đính kèm" value={String(detailRow.attachments?.length ?? 0)} />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
