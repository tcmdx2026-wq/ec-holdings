/**
 * Backup Google Drive (GĐ 103 — phòng tràn Neon / cứu hộ dữ liệu).
 *
 * Gom TOÀN BỘ bảng nghiệp vụ từ Neon thành file backup rồi upload lên Google
 * Drive bằng OAuth refresh token của chủ tài khoản (quota 15GB của Đại ca —
 * Service Account Gmail thường KHÔNG có dung lượng riêng nên không dùng được).
 *
 * 2 định dạng (GĐ 104):
 *   - JSON  — giong-vn-backup-<stamp>.json        : bản đầy đủ để KHÔI PHỤC
 *   - XLSX  — giong-vn-backup-<stamp>.xlsx        : bản ĐỌC dễ (mỗi bảng 1 sheet)
 *
 * Env bắt buộc (set trên Vercel):
 *   GOOGLE_REFRESH_TOKEN — refresh token OAuth có scope drive (từ gcloud ADC)
 *   GOOGLE_CLIENT_ID     — client_id đi kèm refresh token
 *   GOOGLE_CLIENT_SECRET — client_secret đi kèm refresh token
 *   GOOGLE_DRIVE_FOLDER_ID — ID thư mục Drive "GIONG-VN-Backup"
 *
 * Thiếu env → trả { ok:false, reason:"not-configured" } — nút backup báo rõ,
 * app không bị ảnh hưởng. Không phụ thuộc package googleapis — thuần fetch
 * (nhẹ bundle serverless).
 */
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";

function driveConfig() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN ?? "";
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";
  return { refreshToken, clientId, clientSecret, folderId, configured: Boolean(refreshToken && clientId && clientSecret && folderId) };
}

async function getAccessToken(cfg: ReturnType<typeof driveConfig>): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(`Lấy access token thất bại: ${data.error_description ?? res.status}`);
  return data.access_token;
}

/** Upload 1 file (buffer) vào folder Drive — multipart 1 request. */
async function driveUpload(
  cfg: ReturnType<typeof driveConfig>,
  fileName: string,
  mimeType: string,
  content: Buffer,
): Promise<{ id: string; webViewLink: string }> {
  const accessToken = await getAccessToken(cfg);
  const boundary = "giong" + Date.now();
  const meta = { name: fileName, parents: [cfg.folderId], mimeType };
  const head =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(meta) +
    `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const body = Buffer.concat([Buffer.from(head, "utf8"), content, Buffer.from(`\r\n--${boundary}--`, "utf8")]);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: new Uint8Array(body),
  });
  const up = (await res.json()) as { id?: string; webViewLink?: string; error?: { message: string } };
  if (!res.ok || !up.id) throw new Error(up.error?.message ?? `Upload HTTP ${res.status}`);
  return { id: up.id ?? "", webViewLink: up.webViewLink ?? "" };
}

export const getBackupConfigStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: driveConfig().configured };
});

type TableSpec = { key: string; sql: string };

/** Danh sách bảng + cột cần backup — SELECT * để không sót cột mới tương lai. */
const TABLES: TableSpec[] = [
  { key: "attendance", sql: "SELECT * FROM attendance ORDER BY date DESC, time DESC LIMIT 50000" },
  { key: "checkins", sql: "SELECT * FROM checkins ORDER BY date DESC, time DESC LIMIT 50000" },
  { key: "tasks", sql: "SELECT * FROM tasks ORDER BY created DESC LIMIT 50000" },
  { key: "proposals", sql: "SELECT * FROM proposals ORDER BY date DESC LIMIT 50000" },
  { key: "notes", sql: "SELECT * FROM notes ORDER BY date DESC LIMIT 50000" },
  { key: "messages", sql: "SELECT * FROM messages ORDER BY at DESC LIMIT 50000" },
  { key: "chat_groups", sql: "SELECT * FROM chat_groups LIMIT 10000" },
  { key: "chat_group_members", sql: "SELECT * FROM chat_group_members LIMIT 50000" },
  { key: "documents", sql: "SELECT * FROM documents ORDER BY date DESC LIMIT 20000" },
  { key: "employees", sql: "SELECT * FROM employees LIMIT 10000" },
  { key: "centers", sql: "SELECT * FROM centers LIMIT 1000" },
  { key: "registration_requests", sql: "SELECT * FROM registration_requests LIMIT 10000" },
];

export type BackupData = {
  meta: { app: string; exportedAt: string; counts: Record<string, number> };
  data: Record<string, unknown[]>;
};

/** Load toàn bộ bảng từ Neon — dùng chung JSON + Excel. */
export async function collectBackupData(): Promise<BackupData> {
  const sql = await getSql();
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    try {
      const rows = await sql.query(t.sql);
      data[t.key] = rows;
      counts[t.key] = rows.length;
    } catch (err) {
      // Bảng chưa có (migration cũ mới) — ghi rỗng, không chặn bảng khác
      console.warn(`[backup] Bảng ${t.key} load lỗi (bỏ qua):`, (err as Error).message);
      data[t.key] = [];
      counts[t.key] = 0;
    }
  }
  const now = new Date();
  return { meta: { app: "GIONG VIETNAM", exportedAt: now.toISOString(), counts }, data };
}

export function backupStamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/** Sinh file Excel — mỗi bảng 1 sheet, dòng đầu là tên cột. */
async function buildExcel(data: BackupData): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "GIONG VIETNAM";
  wb.created = new Date();
  // Sheet tổng quan đầu tiên
  const summary = wb.addWorksheet("Tổng quan");
  summary.addRow(["Ứng dụng", data.meta.app]);
  summary.addRow(["Thời gian xuất", data.meta.exportedAt]);
  summary.addRow(["Ghi chú", "File NÀY CHỈ ĐỂ XEM. KHÔI PHỤC phải dùng file .json cùng thời điểm"]);
  summary.addRow([]);
  summary.addRow(["Bảng", "Số dòng"]);
  for (const [k, v] of Object.entries(data.meta.counts)) summary.addRow([k, v]);
  summary.getRow(1).font = { bold: true };
  const sumHeader = summary.getRow(5);
  sumHeader.font = { bold: true };
  summary.columns.forEach((c) => { c.width = 28; });

  for (const [key, rows] of Object.entries(data.data)) {
    const sheet = wb.addWorksheet(key.slice(0, 31));
    if (!rows.length) {
      sheet.addRow(["(trống)"]);
      continue;
    }
    const headers = Object.keys(rows[0] as Record<string, unknown>);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAD9" } };
    for (const r of rows) {
      sheet.addRow(
        headers.map((h) => {
          const v = (r as Record<string, unknown>)[h];
          if (v === null || v === undefined) return "";
          if (v instanceof Date) return v.toISOString();
          if (typeof v === "object") return JSON.stringify(v);
          return v as string | number | boolean;
        }),
      );
    }
    sheet.columns.forEach((c) => { if (c.width && c.width > 40) c.width = 40; });
  }
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

/**
 * Thực hiện 1 phiên backup: load data → sinh JSON + Excel → upload cả 2 lên Drive.
 * Dùng chung cho nút "Backup ngay" (server function) và cron tuần (route /api/cron/backup).
 */
export async function performBackup(): Promise<{
  ok: true;
  json: { fileName: string; fileId: string; webViewLink: string; totalBytes: number };
  xlsx: { fileName: string; fileId: string; webViewLink: string; totalBytes: number };
  counts: Record<string, number>;
}> {
  const cfg = driveConfig();
  if (!cfg.configured) throw new Error("not-configured");
  const data = await collectBackupData();
  const stamp = backupStamp();
  const jsonName = `giong-vn-backup-${stamp}.json`;
  const xlsxName = `giong-vn-backup-${stamp}.xlsx`;

  const json = JSON.stringify(data);
  const jsonUp = await driveUpload(cfg, jsonName, "application/json", Buffer.from(json, "utf8"));
  const xlsxContent = await buildExcel(data);
  const xlsxUp = await driveUpload(cfg, xlsxName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsxContent);

  return {
    ok: true,
    json: { fileName: jsonName, fileId: jsonUp.id, webViewLink: jsonUp.webViewLink, totalBytes: json.length },
    xlsx: { fileName: xlsxName, fileId: xlsxUp.id, webViewLink: xlsxUp.webViewLink, totalBytes: xlsxContent.length },
    counts: data.meta.counts,
  };
}

export const backupToDrive = createServerFn({ method: "POST" }).handler(async () => {
  const cfg = driveConfig();
  if (!cfg.configured) {
    return { ok: false as const, reason: "not-configured" as const };
  }
  try {
    const { ok, ...rest } = await performBackup();
    return { ok: true as const, ...rest };
  } catch (err) {
    console.error("[backup] Google Drive upload failed:", err);
    return { ok: false as const, reason: "drive-error" as const, message: (err as Error).message };
  }
});
