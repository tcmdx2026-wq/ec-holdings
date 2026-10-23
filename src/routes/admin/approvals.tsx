import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { clearAttendance } from "@/routes/api/data";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDesc } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDesc } from "@/components/ui/dialog";
import {
  getRegistrationRequests,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  revokeRegistrationRequest,
} from "@/routes/api/registrations";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isAdminRole } from "@/lib/catalog";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/approvals")({
  component: AdminApprovals,
});

interface RegistrationRequest {
  id: string;
  name: string;
  email: string;
  department?: string;
  center?: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

function AdminApprovals() {
  const { user, isPending } = useCurrentUserState();
  const employees = useAppStore((s) => s.employees);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] =
    useState<RegistrationRequest | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Admin check — same logic as app-shell (with fallback)
  const byEmail = user ? employees.find((e) => e.email === (user.primaryEmail ?? "")) : null;
  const byName = user ? employees.find((e) => e.name === (user.displayName ?? "")) : null;
  const byId = employees.find((e) => e.id === currentUserId) ?? employees[0];
  const employee = byEmail ?? byName ?? byId;
  const isAdmin = isAdminRole(employee?.role)
    || user?.primaryEmail === "tcmdx2026@gmail.com"
    || user?.primaryEmail === "cuongpk.giong02@gmail.com";

  // Load registration requests
  useEffect(() => {
    loadRequests();
  }, []);

  async function syncEmployees() {
    try {
      const { syncApprovedToEmployees } = await import("@/routes/api/employee-crud");
      const result = await syncApprovedToEmployees();
      if (result.created > 0) {
        toast.success(`Đã sync ${result.created} nhân sự từ danh sách duyệt`);
        // Reload store employees
        useAppStore.getState().hydrate();
      } else {
        toast.info("Tất cả nhân sự đã có trong danh sách");
      }
    } catch {
      toast.error("Lỗi khi sync nhân sự");
    }
  }

  async function loadRequests() {
    try {
      setLoading(true);
      const data = await getRegistrationRequests();
      // Fix old reviewed_by names client-side (migration can't run without DB_URL at build)
      const fixed = data.map((r) => {
        if (!r.reviewedBy) return r;
        let name = r.reviewedBy;
        if (name.includes("Auto-duyệt")) name = "Admin Phạm Kiên Cường";
        if (name === "Nguyễn Thị Thúy") name = "Admin Phạm Kiên Cường";
        return { ...r, reviewedBy: name };
      });
      setRequests(fixed);
    } catch {
      toast.error("Không thể tải danh sách đăng ký");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(request: RegistrationRequest) {
    try {
      setProcessing(true);
      await approveRegistrationRequest({ data: { requestId: request.id } });
      toast.success(`Đã duyệt đăng ký cho ${request.name}`);
      await loadRequests();
    } catch {
      toast.error("Lỗi khi duyệt đăng ký");
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!selectedRequest) return;

    try {
      setProcessing(true);
      await rejectRegistrationRequest({
        data: {
          requestId: selectedRequest.id,
          reason: rejectReason || undefined,
        },
      });
      toast.success(`Đã từ chối đăng ký của ${selectedRequest.name}`);
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectReason("");
      await loadRequests();
    } catch {
      toast.error("Lỗi khi từ chối đăng ký");
    } finally {
      setProcessing(false);
    }
  }

  async function handleRevoke(request: RegistrationRequest) {
    if (!confirm(`Thu hồi quyền đăng nhập của ${request.name}?`)) return;
    try {
      setProcessing(true);
      await revokeRegistrationRequest({ data: { requestId: request.id } });
      toast.success(`Đã thu hồi quyền đăng nhập của ${request.name}`);
      await loadRequests();
    } catch {
      toast.error("Lỗi khi thu hồi quyền đăng nhập");
    } finally {
      setProcessing(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return (
          <Badge tone="warn">
            Chờ duyệt
          </Badge>
        );
      case "approved":
        return (
          <Badge tone="ok">
            Đã duyệt
          </Badge>
        );
      case "rejected":
        return (
          <Badge tone="danger">
            Từ chối
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const handleClearAttendance = useCallback(async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    try {
      setClearing(true);
      await clearAttendance();
      useAppStore.setState({ attendance: [] });
      toast.success("Đã xóa trắng dữ liệu chấm công");
      setConfirmClear(false);
    } catch {
      toast.error("Lỗi khi xóa dữ liệu");
    } finally {
      setClearing(false);
    }
  }, [confirmClear]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  // Wait for session to resolve
  if (isPending) return null;

  if (!user || !isAdmin) {
    return (
      <main className="container mx-auto py-6 px-4">
        <Card className="p-8 text-center">
          <p className="text-lg font-semibold text-ink">Bạn không phải là Admin nên không có quyền truy cập</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Quản lý đăng ký</h1>
        <p className="text-muted">
          Duyệt hoặc từ chối yêu cầu đăng ký tài khoản mới
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">
              Chờ duyệt
            </CardTitle>
          </CardHeader>
          <div>
            <div className="text-2xl font-bold text-yellow-600">
              {pendingCount}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">
              Đã duyệt
            </CardTitle>
          </CardHeader>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {approvedCount}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">
              Từ chối
            </CardTitle>
          </CardHeader>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {rejectedCount}
            </div>
          </div>
        </Card>
      </div>

      {/* Danger zone */}
      <Card className="mb-6 border-danger/30">
        <CardHeader>
          <CardTitle className="text-danger">Vùng nguy hiểm</CardTitle>
          <CardDesc>Các thao tác không thể hoàn tác</CardDesc>
        </CardHeader>
        <div className="px-6 pb-4">
          <Button
            variant="danger"
            size="sm"
            onClick={handleClearAttendance}
            disabled={clearing}
          >
            {clearing ? "Đang xóa..." : confirmClear ? "Nhấn lại để xác nhận xóa WHITE" : "Xóa trắng dữ liệu chấm công"}
          </Button>
          {confirmClear && (
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => setConfirmClear(false)}
            >
              Hủy
            </Button>
          )}
        </div>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Danh sách yêu cầu</CardTitle>
            <CardDesc>
              {loading ? "Đang tải..." : `Tổng cộng ${requests.length} yêu cầu`}
            </CardDesc>
          </div>
          <Button size="sm" variant="outline" onClick={syncEmployees}>
            Sync nhân sự từ duyệt
          </Button>
        </CardHeader>
        <div>
          {loading ? (
            <div className="text-center py-8 text-muted">Đang tải dữ liệu...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted">
              Chưa có yêu cầu đăng ký nào
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left py-3 px-4 font-medium text-muted">Họ tên</th>
                    <th className="text-left py-3 px-4 font-medium text-muted">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-muted">Phòng ban</th>
                    <th className="text-left py-3 px-4 font-medium text-muted">Trung tâm</th>
                    <th className="text-left py-3 px-4 font-medium text-muted">Trạng thái</th>
                    <th className="text-left py-3 px-4 font-medium text-muted">Ngày yêu cầu</th>
                    <th className="text-right py-3 px-4 font-medium text-muted">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-b border-line hover:bg-surface-2">
                      <td className="py-3 px-4 font-medium">{request.name}</td>
                      <td className="py-3 px-4">{request.email}</td>
                      <td className="py-3 px-4">{request.department || "-"}</td>
                      <td className="py-3 px-4">{request.center || "-"}</td>
                      <td className="py-3 px-4">{getStatusBadge(request.status)}</td>
                      <td className="py-3 px-4">{formatDate(request.requestedAt)}</td>
                      <td className="py-3 px-4 text-right">
                        {request.status === "pending" && (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:bg-green-50"
                              onClick={() => handleApprove(request)}
                              disabled={processing}
                            >
                              Duyệt
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setSelectedRequest(request);
                                setRejectDialogOpen(true);
                              }}
                              disabled={processing}
                            >
                              Từ chối
                            </Button>
                          </div>
                        )}
                        {request.status === "approved" && (
                          <div className="flex gap-2 justify-end items-center">
                            <span className="text-sm text-muted">
                              Duyệt bởi {request.reviewedBy}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-600 hover:bg-orange-50 whitespace-nowrap"
                              onClick={() => handleRevoke(request)}
                              disabled={processing}
                            >
                              Hủy duyệt
                            </Button>
                          </div>
                        )}
                        {request.status === "rejected" && (
                          <span className="text-sm text-muted">
                            Từ chối bởi {request.reviewedBy}
                            {request.rejectionReason &&
                              `: ${request.rejectionReason}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogTitle>Từ chối đăng ký</DialogTitle>
          <DialogDesc>
            Bạn có chắc chắn muốn từ chối đăng ký của{" "}
            <strong>{selectedRequest?.name}</strong>?
          </DialogDesc>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="rejectReason">Lý do từ chối (tùy chọn)</Label>
              <Input
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do từ chối..."
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setSelectedRequest(null);
                setRejectReason("");
              }}
              disabled={processing}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={processing}
            >
              {processing ? "Đang xử lý..." : "Từ chối"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
