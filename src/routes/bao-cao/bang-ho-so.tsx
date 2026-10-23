import { createFileRoute } from "@tanstack/react-router";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ClientOnly } from "@/components/client-only";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { DOC_CATEGORIES, type Document } from "@/lib/types";

export const Route = createFileRoute("/bao-cao/bang-ho-so")({
  component: BaoCaoHoSo,
});

const PIE_COLORS = ["#1c6b58", "#b45309", "#155647", "#8a9893", "#b42318", "#5a6b65"];

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs font-medium text-muted">{label}</span>
      <span className="min-w-0 text-right text-sm break-words text-ink">{value || "—"}</span>
    </div>
  );
}

function BaoCaoHoSo() {
  const documents = useAppStore((s) => s.documents);
  const centers = useAppStore((s) => s.centers);

  // ===== Filters =====
  const [q, setQ] = useState("");
  const [fCategory, setFCategory] = useState("all");
  const [fDept, setFDept] = useState("all");
  const [fCreator, setFCreator] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [detailRow, setDetailRow] = useState<Document | null>(null);

  const depts = useMemo(
    () => [...new Set(documents.map((d) => d.dept).filter(Boolean))].sort(),
    [documents],
  );
  const creators = useMemo(
    () => [...new Set(documents.map((d) => d.creator).filter(Boolean))].sort(),
    [documents],
  );

  const rows = useMemo(() => {
    return documents
      .filter((d) => {
        if (fCategory !== "all" && d.category !== fCategory) return false;
        if (fDept !== "all" && d.dept !== fDept) return false;
        if (fCreator !== "all" && d.creator !== fCreator) return false;
        if (q.trim()) {
          const s = q.toLowerCase();
          const hay = `${d.title} ${d.summary} ${d.category} ${d.dept} ${d.creator}`.toLowerCase();
          if (!hay.includes(s)) return false;
        }
        if (fFrom && d.date < fFrom) return false;
        if (fTo && d.date > fTo) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [documents, fCategory, fDept, fCreator, q, fFrom, fTo]);

  // ===== Thống kê theo loại (pie) =====
  const pie = useMemo(
    () =>
      DOC_CATEGORIES.map((c, i) => ({
        name: c,
        value: rows.filter((d) => d.category === c).length,
        color: PIE_COLORS[i % PIE_COLORS.length],
      })).filter((d) => d.value > 0),
    [rows],
  );

  // ===== Thống kê theo phòng ban =====
  const byDept = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of rows) {
      const key = d.dept || "Không rõ";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [rows]);

  function exportToCSV() {
    const BOM = "\uFEFF";
    const headers = [
      "STT",
      "Tên hồ sơ",
      "Loại",
      "Phòng ban",
      "Đơn vị",
      "Người tạo",
      "Ngày",
      "Mô tả",
      "Số tệp đính kèm",
    ];
    const csvRows = [headers.join(",")];
    rows.forEach((d, i) => {
      csvRows.push(
        [
          i + 1,
          `"${d.title.replace(/"/g, '""')}"`,
          `"${d.category}"`,
          `"${d.dept}"`,
          `"${d.center}"`,
          `"${d.creator}"`,
          d.date,
          `"${(d.summary || "").replace(/"/g, '""')}"`,
          d.attachments?.length ?? 0,
        ].join(","),
      );
    });
    const csv = BOM + csvRows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bang-ho-so-${fFrom || "all"}-${fTo || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Báo cáo"
        title="Hồ sơ tài liệu"
        desc="Tổng hợp hồ sơ theo loại, phòng ban, người tạo, thời gian + xuất CSV."
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
            placeholder="Tìm tên, mô tả, người tạo..."
            className="h-10 pl-10"
          />
        </div>
        <select
          value={fCategory}
          onChange={(e) => setFCategory(e.target.value)}
          className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
          title="Lọc loại hồ sơ"
        >
          <option value="all">Mọi loại</option>
          {DOC_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={fDept}
          onChange={(e) => setFDept(e.target.value)}
          className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
          title="Lọc phòng ban"
        >
          <option value="all">Mọi phòng ban</option>
          {depts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={fCreator}
          onChange={(e) => setFCreator(e.target.value)}
          className="h-10 rounded-md border border-line bg-surface px-2 text-sm"
          title="Lọc người tạo"
        >
          <option value="all">Mọi người tạo</option>
          {creators.map((c) => (
            <option key={c} value={c}>{c}</option>
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
          { label: "Tổng hồ sơ", value: rows.length },
          { label: "Loại hồ sơ", value: new Set(rows.map((d) => d.category)).size },
          { label: "Phòng ban", value: new Set(rows.map((d) => d.dept).filter(Boolean)).size },
          { label: "Có đính kèm", value: rows.filter((d) => (d.attachments?.length ?? 0) > 0).length },
        ].map((c) => (
          <Card key={c.label} className="px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular text-ink">{c.value}</p>
          </Card>
        ))}
      </div>

      <p className="mb-3 text-sm text-muted">
        Hiển thị <span className="font-medium text-ink">{rows.length}</span> / {documents.length} hồ sơ
      </p>

      {/* Bảng tổng hợp */}
      <Card className="overflow-hidden p-0 lg:overflow-visible">
        <div className="overflow-x-auto lg:overflow-x-visible">
          <table className="w-full text-sm">
            <thead className="sticky top-16 z-[5]">
              <tr className="border-b border-line bg-surface">
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">STT</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Tên hồ sơ</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Loại</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Phòng ban</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Đơn vị</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Người tạo</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Ngày</th>
                <th className="px-3 py-3 text-left font-medium whitespace-nowrap text-muted">Đính kèm</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted">
                    Không có hồ sơ nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                rows.map((d, idx) => (
                  <tr
                    key={d.id}
                    onClick={() => setDetailRow(d)}
                    className="cursor-pointer border-b border-line transition-colors hover:bg-surface-2/40"
                  >
                    <td className="px-3 py-3 text-faint tabular">{idx + 1}</td>
                    <td className="max-w-[280px] px-3 py-3">
                      <p className="truncate font-medium text-ink">{d.title}</p>
                      {d.summary ? <p className="truncate text-xs text-muted">{d.summary}</p> : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                        {d.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{d.dept || "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{d.center || "—"}</td>
                    <td className="px-3 py-3 font-medium whitespace-nowrap text-ink">{d.creator || "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted tabular">{formatDate(d.date)}</td>
                    <td className="px-3 py-3 text-center text-muted">{d.attachments?.length ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Biểu đồ + bảng phụ */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="p-4">
            <p className="font-semibold text-ink">Cơ cấu theo loại hồ sơ</p>
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
            <p className="font-semibold text-ink">Theo phòng ban</p>
            {byDept.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Chưa có dữ liệu.</p>
            ) : (
              <div className="mt-3 max-h-56 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="py-2">Phòng ban</th>
                      <th className="py-2 text-center">Số hồ sơ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDept.map((r) => (
                      <tr key={r.name} className="border-b border-line/60">
                        <td className="py-2 font-medium text-ink">{r.name}</td>
                        <td className="py-2 text-center tabular">{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Dialog chi tiết — chỉ xem */}
      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent>
          <DialogTitle>Chi tiết hồ sơ</DialogTitle>
          {detailRow ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                  {detailRow.category}
                </span>
              </div>
              <p className="mt-2 text-base leading-6 font-semibold text-ink">{detailRow.title}</p>
              <div className="mt-3 divide-y divide-line">
                <DetailRow label="Phòng ban" value={detailRow.dept} />
                <DetailRow label="Đơn vị" value={centers.find((c) => c.name === detailRow.center)?.name ?? detailRow.center} />
                <DetailRow label="Người tạo" value={detailRow.creator} />
                <DetailRow label="Ngày tạo" value={formatDate(detailRow.date)} />
                <DetailRow label="Mô tả" value={detailRow.summary} />
                <DetailRow label="Tệp đính kèm" value={String(detailRow.attachments?.length ?? 0)} />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
