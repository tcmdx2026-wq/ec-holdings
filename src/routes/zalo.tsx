import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";

// GĐ 315: module Zalo (nhóm DỰ ÁN) — khung placeholder.
// Nội dung chi tiết (gửi tin / thông báo qua Zalo) sẽ được triển khai sau theo chỉ đạo của Đại ca.
// Phân quyền: nav + route guard chung chỉ cho Admin (app-shell GĐ 315) — trang không tự guard.
export const Route = createFileRoute("/zalo")({ component: ZaloPage });

function ZaloPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="DỰ ÁN"
        title="Zalo"
        desc="Tích hợp Zalo — đang được triển khai."
      />
      <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <MessagesSquare className="size-10 text-accent/60" aria-hidden />
        <p className="text-base font-medium text-ink">Module đang được triển khai</p>
        <p className="max-w-md text-sm text-muted">
          Nội dung Zalo (gửi thông báo, quản lý Zalo OA...) sẽ được cập nhật trong thời gian tới.
          Anh vui lòng quay lại sau.
        </p>
      </Card>
    </div>
  );
}
