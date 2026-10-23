import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { ClientOnly } from "@/components/client-only";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { seedDaily } from "@/data";
import { REPORTS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/bao-cao")({ component: BaoCaoPage });

function BaoCaoPage() {
  const location = useRouterState({ select: (s) => s.location });
  const isParentRoute = location.pathname === "/bao-cao";
  const tasks = useAppStore((s) => s.tasks);
  const pie = [
    { name: "Đã xong", value: tasks.filter((t) => t.status === "Đã xong").length, color: "#1c6b58" },
    { name: "Cần làm", value: tasks.filter((t) => t.status !== "Đã xong").length, color: "#b45309" },
  ];
  const busy = seedDaily.filter((d) => d.in + d.out >= 8);
  const avgIn = Math.round(busy.reduce((s, d) => s + d.in, 0) / Math.max(busy.length, 1));

  if (!isParentRoute) return <Outlet />;

  return (
    <div>
      <PageHeader
        eyebrow="Hệ thống"
        title="Báo cáo & biểu đồ"
        desc="Các view báo cáo từ AppSheet gốc, gom về một chỗ trên dashboard."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link
            key={r.id}
            to={r.href}
            className="group rounded-xl bg-surface p-4 shadow-[var(--shadow-card)] transition-[box-shadow] hover:shadow-[var(--shadow-card-hover)]"
          >
            <div className="flex items-start justify-between">
              <h2 className="font-semibold text-ink">{r.name}</h2>
              <ArrowUpRight className="size-4 text-faint group-hover:text-accent" />
            </div>
            <p className="mt-1 text-sm text-muted">{r.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cơ cấu nhiệm vụ</CardTitle>
          </CardHeader>
          <ClientOnly>
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
          </ClientOnly>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chấm công trung bình</CardTitle>
          </CardHeader>
          <p className="text-3xl font-semibold tabular">{avgIn}</p>
          <p className="mt-1 text-sm text-muted">Lượt vào ca / ngày làm việc đông (mẫu 2026)</p>

        </Card>
      </div>
    </div>
  );
}
