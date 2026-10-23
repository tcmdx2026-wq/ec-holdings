import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { changePassword } from "@/routes/api/auth-change-password";

export const Route = createFileRoute("/change-password")({
  component: ChangePassword,
});

function ChangePassword() {
  const user = useCurrentUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <main className="grid min-h-[calc(100vh-6rem)] place-items-center px-4 py-10">
        <div className="text-center">
          <p className="text-muted">Vui lòng đăng nhập để đổi mật khẩu</p>
          <Link to="/login">
            <Button className="mt-4">Đăng nhập</Button>
          </Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu mới không khớp");
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error("Mật khẩu mới phải có ít nhất 8 ký tự");
      return;
    }
    
    setLoading(true);
    try {
      await changePassword({
        data: {
          currentPassword,
          newPassword,
        },
      });
      toast.success("Đổi mật khẩu thành công!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message ?? "Đổi mật khẩu thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-6rem)] place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="mb-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            EC-HOLDINGS
          </p>
          <h1 className="text-3xl font-semibold text-ink">
            Đổi mật khẩu
          </h1>
          <p className="text-sm text-muted">
            Nhập mật khẩu hiện tại và mật khẩu mới để thay đổi.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Nhập mật khẩu hiện tại"
              className="mt-1"
              required
              minLength={8}
            />
          </div>
          
          <div>
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ít nhất 8 ký tự"
              className="mt-1"
              required
              minLength={8}
            />
          </div>
          
          <div>
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="mt-1"
              required
              minLength={8}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đổi mật khẩu"}
          </Button>
        </form>

        <div className="mt-5 text-center text-sm text-muted">
          <Link to="/" className="text-accent hover:underline">
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
