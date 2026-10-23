import { createFileRoute } from "@tanstack/react-router";
import { NotebookPen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";

// GĐ 315: module Biên bản họp (nhóm DỰ ÁN) — khung placeholder.
// Nội dung chi tiết (tạo/lưu/trình duyệt biên bản) sẽ được triển khai sau theo chỉ đạo của Đại ca.
// Phân quyền: nav + route guard chung chỉ cho Admin (app-shell GĐ 315) — trang không tự guard.
export const Route = createFileRoute("/bien-ban-hop")({ component: BienBanHopPage });

function BienBanHopPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="DỰ ÁN"
        title="Biên bản họp"
        desc="Lưu trữ và quản lý biên bản họp nội bộ công ty — đang được triển khai."
      />
      <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <NotebookPen className="size-10 text-accent/60" aria-hidden />
        <p className="text-base font-medium text-ink">Module đang được triển khai</p>
        <p className="max-w-md text-sm text-muted">
          Nội dung Biên bản họp (tạo mới, đính kèm, theo dõi thông qua) sẽ được cập nhật trong
          thời gian tới. Anh vui lòng quay lại sau.
        </p>
      </Card>
    </div>
  );
}
