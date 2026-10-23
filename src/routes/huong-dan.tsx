import { createFileRoute } from "@tanstack/react-router";
import { BookOpenCheck, HardDriveDownload, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isAdminRole } from "@/lib/catalog";
import { useAppStore } from "@/lib/store";
import { backupToDrive, getBackupConfigStatus } from "@/routes/api/backup-drive";
import { GUIDES, SUPPORT_ALT, SUPPORT_PHONE } from "@/lib/catalog";

export const Route = createFileRoute("/huong-dan")({ component: HuongDanPage });
// GUIDES/SUPPORT dùng ở dưới — BackupDriveCard chỉ isAdmin mới render.

/** GĐ 103: nút backup toàn bộ dữ liệu Neon ra Google Drive — CHỈ Admin. */
function BackupDriveCard() {
  const currentEmployee = useAppStore(
    (s) => s.employees.find((e) => e.id === s.currentUserId) ?? null,
  );
  const isAdmin = isAdminRole(currentEmployee?.role);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string>("");

  useEffect(() => {
    if (!isAdmin) return;
    getBackupConfigStatus()
      .then((r) => setConfigured(r.configured))
      .catch(() => setConfigured(false));
  }, [isAdmin]);

  if (!isAdmin) return null;

  async function runBackup() {
    setBusy(true);
    setLastResult("");
    try {
      const r = await backupToDrive();
      if (r.ok) {
        setLastResult(
          `✅ Đã lưu 2 file vào Drive: ${r.json.fileName} (${(r.json.totalBytes / 1024).toFixed(0)} KB — bản khôi phục) ` +
            `+ ${r.xlsx.fileName} (${(r.xlsx.totalBytes / 1024).toFixed(0)} KB — bản đọc Excel). ` +
            `Tổng: ${Object.values(r.counts).reduce((a, b) => a + b, 0)} dòng dữ liệu.`,
        );
        toast.success("Backup JSON + Excel lên Google Drive thành công");
      } else if (r.reason === "not-configured") {
        setLastResult("⚠️ Chưa cấu hình Google Drive (env GOOGLE_REFRESH_TOKEN / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_DRIVE_FOLDER_ID).");
        toast.warning("Chưa cấu hình Google Drive");
      } else {
        setLastResult(`❌ Lỗi Drive: ${r.message ?? "không xác định"}`);
        toast.error("Backup thất bại");
      }
    } catch (err: any) {
      setLastResult(`❌ Lỗi: ${err?.message || err}`);
      toast.error("Backup thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <HardDriveDownload className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">Sao lưu dữ liệu lên Google Drive</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Gom toàn bộ dữ liệu (chấm công, check-in, nhiệm vụ, đề nghị, ghi chú, chat, nhân sự,
            trung tâm...) thành 2 file lưu lên Google Drive: <b>.json</b> (bản khôi phục) +
            <b> .xlsx</b> (bản đọc Excel — mỗi bảng 1 sheet). Chạy tự động 1 tuần 1 lần
            (sáng thứ Hai) + bấm tay bất cứ lúc nào. File cũ không bị xóa, mỗi lần backup tạo
            1 cặp file theo ngày giờ.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={runBackup} disabled={busy || configured === false}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Đang backup...
                </>
              ) : (
                "Backup ngay"
              )}
            </Button>
            {configured === false ? (
              <span className="text-xs text-amber-600">
                ⚠️ Chưa cấu hình env Google Drive trên Vercel
              </span>
            ) : null}
          </div>
          {lastResult ? <p className="mt-3 text-xs leading-relaxed text-muted">{lastResult}</p> : null}
        </div>
      </div>
    </Card>
  );
}

/** GĐ 104: hướng dẫn đọc file backup + quy trình khôi phục — CHỈ Admin. */
function BackupRestoreGuideCard() {
  const currentEmployee = useAppStore(
    (s) => s.employees.find((e) => e.id === s.currentUserId) ?? null,
  );
  const isAdmin = isAdminRole(currentEmployee?.role);
  if (!isAdmin) return null;

  return (
    <Card className="mb-5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <BookOpenCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">Hướng dẫn đọc file backup & khôi phục dữ liệu</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Mỗi lần backup tạo 1 CẶP file trong thư mục <b>EC-HOLDINGS-Backup</b> trên Drive:
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
            <li>
              📄 <b>File .json</b> — bản đầy đủ để <b>khôi phục</b>. Cấu trúc: `{'{ meta, data }'}`
              — `meta.counts` cho biết số dòng từng bảng; `data` chứa 12 bảng (attendance,
              checkins, tasks, proposals, notes, messages, chat_groups, chat_group_members,
              documents, employees, centers, registration_requests). Mở bằng trình soạn thảo
              (VS Code) hoặc xem nhanh trên Drive.
            </li>
            <li>
              📊 <b>File .xlsx</b> — bản <b>đọc xem</b> bằng Excel/Google Sheets: sheet
              "Tổng quan" + mỗi bảng 1 sheet, dòng đầu là tên cột. KHÔNG dùng file này để
              khôi phục — chỉ để tra cứu, in ấn, thống kê.
            </li>
          </ul>
          <p className="mt-3 text-sm font-semibold text-ink">Quy trình khôi phục khi sự cố (Neon mất dữ liệu):</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted">
            <li>Tải file .json KHÓI PHỤC mới nhất từ folder EC-HOLDINGS-Backup về máy.</li>
            <li>
              Gửi file cho trợ lý lập trình — sẽ khôi phục bằng cách nạp từng bảng về Neon
              (chỉ nạp bảng bị mất, ghi đè theo `id`; dữ liệu hiện tại MỚI hơn file backup
              không bị mất).
            </li>
            <li>Đối chiếu số dòng từng bảng với sheet "Tổng quan" của file .xlsx cùng cặp.</li>
            <li>Mở app kiểm tra: dashboard, chấm công, check-in, nhiệm vụ, đề nghị, ghi chú, chat.</li>
          </ol>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Lịch tự động: 09:17 sáng thứ Hai hàng tuần. Nút "Backup ngay" chạy thêm bất cứ lúc nào.
          </p>
        </div>
      </div>
    </Card>
  );
}

function HuongDanPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Hệ thống"
        title="Giới thiệu & hướng dẫn"
        desc="EC-HOLDINGS thay bộ AppSheet rời bằng một ứng dụng dùng được trên máy tính, web, iOS và Android."
      />

      <BackupDriveCard />

      <BackupRestoreGuideCard />

      <Card className="mb-5 p-5">
        <p className="text-sm leading-relaxed text-ink">
          Khi vào ứng dụng, dashboard cho biết nhân sự, chấm công, nhiệm vụ mở và đề nghị chờ duyệt. Việc hàng ngày:
          chấm công, kiểm tra kế hoạch, vào module nghiệp vụ, ghi chú và góp ý.
        </p>
        <p className="mt-3 text-sm text-muted">
          Hỗ trợ: {SUPPORT_PHONE} hoặc {SUPPORT_ALT} (Zalo / điện thoại).
        </p>
      </Card>

      <ol className="grid gap-3">
        {GUIDES.map((g, i) => (
          <li key={g.id}>
            <Card className="p-4">
              <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-1 font-semibold text-ink">{g.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{g.body}</p>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
