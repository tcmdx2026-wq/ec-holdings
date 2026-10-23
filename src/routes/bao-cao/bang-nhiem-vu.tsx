import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { useAppStore } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { EMPLOYEES, isAdminRole } from "@/lib/catalog";
const COLS = ["Việc cần làm", "Quá hạn", "Đã xong"];

function TiếnĐộNhiệmVụ() {
  const tasks = useAppStore((s) => s.tasks);
  const [q, setQ] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterAssigner, setFilterAssigner] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mine, setMine] = useState(false);
  const currentUser = useAppStore((s) => s.employees.find((e) => e.id === s.currentUserId) ?? EMPLOYEES[0]);
  const isAdmin = isAdminRole(currentUser?.role);
  const vpEmployees = useAppStore((s) => s.employees).filter((e) => e.center === "VP" || e.center === "Văn phòng");

  // Filter tasks
  const filtered = useMemo(() => {
    const currentUserName = currentUser?.name?.toLowerCase() ?? "";
    return tasks.filter((t) => {
      if (mine) {
        if (t.assignee?.toLowerCase() !== currentUserName && t.createdBy?.toLowerCase() !== currentUserName) return false;
      }
      if (filterAssignee && t.assignee !== filterAssignee) return false;
      if (filterAssigner && t.assigner !== filterAssigner) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (dateFrom) {
        const taskDate = t.created.slice(0, 10);
        if (taskDate < dateFrom) return false;
      }
      if (dateTo) {
        const taskDate = t.created.slice(0, 10);
        if (taskDate > dateTo) return false;
      }
      if (q.trim()) {
        const s = q.toLowerCase();
        return t.title.toLowerCase().includes(s) || t.assignee.toLowerCase().includes(s);
      }
      return true;
    });
  }, [tasks, q, filterAssignee, filterAssigner, statusFilter, dateFrom, dateTo, mine, currentUser]);

  // Statistics by status
  const statusStats = useMemo(() => {
    const counts = { "Việc cần làm": 0, "Quá hạn": 0, "Đã xong": 0 };
    for (const t of filtered) {
      if (t.status === "Đã xong") counts["Đã xong"]++;
      else if (t.due) {
        const dueDate = new Date(t.due);
        const now = new Date();
        if (dueDate < now) counts["Quá hạn"]++;
        else counts["Việc cần làm"]++;
      } else {
        counts["Việc cần làm"]++;
      }
    }
    return counts;
  }, [filtered]);

  // Statistics by assignee
  const assigneeStats = useMemo(() => {
    const map = new Map<string, { name: string; total: number; done: number; overdue: number }>();
    for (const t of filtered) {
      const key = t.assignee || "Chưa gán";
      let entry = map.get(key);
      if (!entry) {
        entry = { name: t.assignee || "Chưa gán", total: 0, done: 0, overdue: 0 };
        map.set(key, entry);
      }
      entry.total++;
      if (t.status === "Đã xong") entry.done++;
      else if (t.due) {
        const dueDate = new Date(t.due);
        const now = new Date();
        if (dueDate < now) entry.overdue++;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Pie chart data
  const pieData = useMemo(() => {
    return [
      { name: "Đã xong", value: statusStats["Đã xong"], color: "#1c6b58" },
      { name: "Cần làm", value: statusStats["Việc cần làm"], color: "#b45309" },
      { name: "Quá hạn", value: statusStats["Quá hạn"], color: "#dc2626" },
    ];
  }, [statusStats]);

  // Bar chart — tasks per assignee
  const barData = useMemo(() => {
    return assigneeStats.slice(0, 10).map((a) => ({
      name: a.name.length > 12 ? a.name.substring(0, 12) + "…" : a.name,
      total: a.total,
      done: a.done,
      overdue: a.overdue,
    }));
  }, [assigneeStats]);

  return (
    <div>
      <PageHeader
        eyebrow="Báo cáo"
        title="Báo cáo nhiệm vụ"
        desc="Thống kê tiến độ kế hoạch theo người phụ trách và trạng thái."
        actions={
          <Button onClick={() => {}}>
            Export
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm việc, người phụ trách…"
          className="sm:max-w-sm"
        />
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)] sm:max-w-[200px]"
        >
          <option value="">Tất cả phụ trách</option>
          {vpEmployees.map((e) => (
            <option key={e.id} value={e.name}>{e.name}</option>
          ))}
        </select>
        <select
          value={filterAssigner}
          onChange={(e) => setFilterAssigner(e.target.value)}
          className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)] sm:max-w-[200px]"
        >
          <option value="">Tất cả người giao</option>
          {vpEmployees.map((e) => (
            <option key={e.id} value={e.name}>{e.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)]"
          />
          <span className="text-muted">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-11 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-card)]"
          />
        </div>
        <label className="flex h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isAdmin ? mine : true} onChange={(e) => isAdmin && setMine(e.target.checked)} disabled={!isAdmin} className="size-4 accent-accent" />
          {currentUser?.name} {!isAdmin && "(chỉ của bạn)"}
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pie chart — cấu trúc nhiệm vụ */}
        <Card>
          <CardHeader>
            <CardTitle>Cấu trúc nhiệm vụ</CardTitle>
          </CardHeader>
          <div className="flex h-56 items-center gap-6">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={3}>
                  {pieData.map((p) => (
                    <Cell key={p.name} fill={p.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <ul className="text-sm">
              {pieData.map((p) => (
                <li key={p.name} className="mb-2 flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                  {p.name}
                  <strong className="tabular">{p.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Bar chart — nhiệm vụ theo người phụ trách */}
        <Card>
          <CardHeader>
            <CardTitle>Nhiệm vụ theo người phụ trách</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#1c6b58" name="Tổng" radius={[4, 4, 0, 0]} />
              <Bar dataKey="done" fill="#16a34a" name="Đã xong" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bảng chi tiết nhiệm vụ */}
      <Card className="mt-4 overflow-hidden p-0">
        <CardHeader>
          <CardTitle>Danh sách nhiệm vụ</CardTitle>
        </CardHeader>
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-muted">Chưa có nhiệm vụ phù hợp trong báo cáo.</div>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.slice(0, 100).sort((a, b) => (b.created || "").localeCompare(a.created || "")).map((t) => {
              const isOverdue = t.status !== "Đã xong" && t.due && new Date(t.due) < new Date();
              return (
                <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${isOverdue ? "text-red-400" : t.status === "Đã xong" ? "text-green-700" : "text-ink"}`}>
                      {t.title}
                    </p>
                    <p className="text-sm text-muted">
                      {t.assignee || "Chưa gán"}: {formatDate(t.created)} — {formatDate(t.due || "")}
                      {t.assigner ? ` · Người giao: ${t.assigner}` : ""}
                      {t.support ? ` · Hỗ trợ: ${t.support}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {t.photo && <img src={t.photo} alt="Ảnh" className="h-10 w-10 rounded object-cover" />}
                    <StatusBadge value={isOverdue ? "Quá hạn" : t.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/bao-cao/bang-nhiem-vu")({ component: TiếnĐộNhiệmVụ });
