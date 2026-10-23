/**
 * Cron backup tuần (GĐ 104) — Vercel Cron gọi GET mỗi 1 tuần 1 lần.
 * vercel.json: { "crons": [{ "path": "/api/cron/backup", "schedule": "17 2 ? * 1" }] }
 *
 * Bảo mật: header `authorization: Bearer <CRON_SECRET>` — Vercel Cron tự gửi
 * giá trị env CRON_SECRET; request lạ không có secret đúng → 401.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/backup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.CRON_SECRET ?? "";
        const got = new Headers(request.headers).get("authorization") ?? "";
        if (!expected || got !== `Bearer ${expected}`) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        try {
          const { performBackup } = await import("@/routes/api/backup-drive");
          const r = await performBackup();
          console.log(
            `[cron-backup] OK — json ${r.json.fileName} (${(r.json.totalBytes / 1024).toFixed(0)}KB), ` +
              `xlsx ${r.xlsx.fileName} (${(r.xlsx.totalBytes / 1024).toFixed(0)}KB), ` +
              `attendance=${r.counts.attendance}, tasks=${r.counts.tasks}`,
          );
          return Response.json({ ok: true, json: r.json.fileName, xlsx: r.xlsx.fileName, counts: r.counts });
        } catch (err) {
          const msg = (err as Error).message ?? String(err);
          console.error("[cron-backup] FAIL:", msg);
          // not-configured → 200 để cron không retry nhiễu; còn lại 500 để thấy lỗi
          return Response.json(
            { ok: false, error: msg === "not-configured" ? "not-configured" : "backup-failed", message: msg },
            { status: msg === "not-configured" ? 200 : 500 },
          );
        }
      },
    },
  },
});
