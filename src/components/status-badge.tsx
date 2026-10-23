import { Badge } from "@/components/ui/badge";

export function StatusBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  let tone: "muted" | "accent" | "ok" | "warn" | "danger" = "muted";
  if (v.includes("từ chối") || v.includes("hủy") || v.includes("quá hạn")) tone = "danger";
  else if (v.includes("chờ") || v.includes("nháp") || v.includes("chưa") || v.includes("cần làm"))
    tone = "warn";
  else if (v.includes("tan ca"))
    tone = "warn";
  else if (v.includes("đang làm") || v.includes("giải ngân") || v.includes("mở l/c"))
    tone = "accent";
  else if (
    v.includes("xong") ||
    v.includes("đã duyệt") ||
    v.includes("làm việc") ||
    v.includes("vào ca") ||
    v.includes("hạn mức")
  )
    tone = "ok";
  return <Badge tone={tone}>{value.replace(/^⭕\s*/, "")}</Badge>;
}
